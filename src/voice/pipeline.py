import asyncio
import json
import logging
import os
import traceback
import uuid
from typing import Callable

import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

VOICE_WS_PORT = int(os.environ.get('VOICE_WS_PORT', '8765'))
BRAIN_URL = os.environ.get('BRAIN_URL', 'http://localhost:8000')
SAMPLE_RATE = 16000

VALID_VOICES = {'autumn', 'diana', 'hannah', 'austin', 'daniel', 'troy'}


from pipecat.processors.frame_processor import FrameProcessor, FrameDirection
from pipecat.serializers.base_serializer import FrameSerializer
from pipecat.frames.frames import (
    Frame,
    InputAudioRawFrame,
    OutputAudioRawFrame,
    LLMContextFrame,
    LLMTextFrame,
    LLMFullResponseStartFrame,
    LLMFullResponseEndFrame,
)


class RawPCMSerializer(FrameSerializer):
    """Raw Int16 PCM bytes ↔ pipecat audio frames. Also handles voice-config JSON."""

    def __init__(self, on_voice_config: Callable[[str], None] | None = None) -> None:
        self._on_voice_config = on_voice_config

    async def serialize(self, frame: Frame) -> bytes | None:
        if isinstance(frame, OutputAudioRawFrame):
            return frame.audio
        return None

    async def deserialize(self, data: bytes | str) -> Frame | None:
        if isinstance(data, str):
            try:
                msg = json.loads(data)
                if msg.get('type') == 'config':
                    voice = msg.get('voice', '')
                    if voice in VALID_VOICES and self._on_voice_config:
                        self._on_voice_config(voice)
            except Exception:
                pass
            return None
        if isinstance(data, bytes):
            return InputAudioRawFrame(audio=data, sample_rate=SAMPLE_RATE, num_channels=1)
        return None


class BrainLLMProcessor(FrameProcessor):
    """Routes each LLM turn through the Jarvis brain API (LangGraph + memory + tools).

    The brain has full context: smart home, tasks, widgets, PC control, and memory.
    This replaces the direct Groq LLM call so voice JARVIS is the same brain as chat.
    """

    async def process_frame(self, frame: Frame, direction: FrameDirection) -> None:
        await super().process_frame(frame, direction)

        if isinstance(frame, LLMContextFrame):
            await self._handle_context(frame.context)
        else:
            await self.push_frame(frame, direction)

    async def _handle_context(self, context) -> None:
        user_text = self._extract_user_text(context)
        if not user_text.strip():
            return

        logger.info('Sending to brain: %r', user_text[:120])
        response_text = await self._call_brain(user_text)

        await self.push_frame(LLMFullResponseStartFrame())
        # Emit in small chunks so TTS can start speaking sooner
        chunk_size = 120
        for i in range(0, len(response_text), chunk_size):
            await self.push_frame(LLMTextFrame(text=response_text[i:i + chunk_size]))
        await self.push_frame(LLMFullResponseEndFrame())

    @staticmethod
    def _extract_user_text(context) -> str:
        """Get the latest user turn text from an LLMContext."""
        try:
            messages = context.get_messages()
        except Exception:
            return ''
        for msg in reversed(messages):
            if msg.get('role') != 'user':
                continue
            content = msg.get('content', '')
            if isinstance(content, str):
                return content
            if isinstance(content, list):
                for part in content:
                    if isinstance(part, dict) and part.get('type') == 'text':
                        return part['text']
        return ''

    async def _call_brain(self, text: str) -> str:
        payload = {'id': str(uuid.uuid4()), 'input': text, 'model': 'fast'}
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(f'{BRAIN_URL}/task', json=payload)
                resp.raise_for_status()
                return resp.json().get('result', '')
        except Exception as exc:
            logger.error('Brain API error: %s', exc)
            return "I'm sorry, sir. I'm having difficulty reaching my core systems right now."


async def _run_session() -> None:
    try:
        from pipecat.audio.vad.silero import SileroVADAnalyzer
        from pipecat.pipeline.pipeline import Pipeline
        from pipecat.pipeline.worker import PipelineParams, PipelineWorker
        from pipecat.workers.runner import WorkerRunner
        from pipecat.processors.aggregators.llm_context import LLMContext
        from pipecat.processors.aggregators.llm_response_universal import (
            LLMContextAggregatorPair,
            LLMUserAggregatorParams,
        )
        from pipecat.transports.websocket.server import (
            SingleClientWebsocketServerParams,
            SingleClientWebsocketServerTransport,
        )

        from tts_factory import get_tts_service

        tts_holder: list = []

        def _on_voice_config(voice: str) -> None:
            if not tts_holder:
                return
            try:
                from pipecat.services.groq.tts import GroqTTSService
                tts_holder[0].update_settings(GroqTTSService.Settings(
                    model=os.environ.get('GROQ_TTS_MODEL', 'canopylabs/orpheus-v1-english'),
                    voice=voice,
                ))
                logger.info('Voice switched to %s', voice)
            except Exception as exc:
                logger.warning('Failed to switch voice: %s', exc)

        transport = SingleClientWebsocketServerTransport(
            host='0.0.0.0',
            port=VOICE_WS_PORT,
            params=SingleClientWebsocketServerParams(
                audio_out_enabled=True,
                audio_in_enabled=True,
                serializer=RawPCMSerializer(on_voice_config=_on_voice_config),
            ),
        )

        from stt_factory import get_stt_service
        stt = get_stt_service()
        tts = get_tts_service()
        tts_holder.append(tts)

        brain = BrainLLMProcessor()

        # Empty context — system prompt lives in the brain, not here
        context = LLMContext()
        user_agg, assistant_agg = LLMContextAggregatorPair(
            context,
            user_params=LLMUserAggregatorParams(vad_analyzer=SileroVADAnalyzer()),
        )

        pipeline = Pipeline([
            transport.input(),
            stt,
            user_agg,
            brain,
            tts,
            transport.output(),
            assistant_agg,
        ])

        worker = PipelineWorker(pipeline, params=PipelineParams())
        runner = WorkerRunner(handle_sigint=False)
        await runner.add_workers(worker)
        await runner.run()

    except Exception:
        logger.error('Session crashed:\n%s', traceback.format_exc())
        raise


async def run_pipeline() -> None:
    try:
        from pipecat.transports.websocket.server import SingleClientWebsocketServerTransport  # noqa: F401
    except ImportError as e:
        logger.error('Pipecat not installed: %s', e)
        raise

    logger.info('Voice server starting on ws://0.0.0.0:%d — waiting for connections', VOICE_WS_PORT)
    while True:
        try:
            await _run_session()
        except Exception as e:
            logger.warning('Session ended (%s), restarting in 1s…', e)
        await asyncio.sleep(1)


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_pipeline())
