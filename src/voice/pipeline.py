import asyncio
import json
import logging
import os
import re
import traceback
from typing import Callable

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

VOICE_WS_PORT = int(os.environ.get('VOICE_WS_PORT', '8765'))
VOICE_LLM_MODEL = os.environ.get('VOICE_LLM_MODEL', 'openai/gpt-oss-20b')
SAMPLE_RATE = 16000

# Pipecat 1.9: system_instruction goes on the LLM service, NOT in context messages.
# "J.A.R.V.I.S." with periods causes TTS to spell out each letter — use "JARVIS".
JARVIS_SYSTEM = (
    "You are JARVIS, the personal AI assistant. "
    "Speak naturally and conversationally, as if talking aloud — never write lists, "
    "bullet points, asterisks, or markdown. "
    "Be concise: one or two sentences maximum per response. "
    "Maintain calm confidence with a hint of dry wit. "
    "Address the user as 'sir' occasionally. "
    "Never break character. Never spell out acronyms or abbreviations letter by letter."
)

VALID_VOICES = {'autumn', 'diana', 'hannah', 'austin', 'daniel', 'troy'}

# Characters/patterns TTS reads aloud as noise — strip before sending to TTS
_TTS_STRIP = re.compile(r'[*_`#~|\\]|^\s*[-•]\s*', re.MULTILINE)


def _clean_for_tts(text: str) -> str:
    """Remove markdown symbols that TTS would speak literally."""
    return _TTS_STRIP.sub('', text).strip()


from pipecat.serializers.base_serializer import FrameSerializer
from pipecat.frames.frames import Frame, InputAudioRawFrame, OutputAudioRawFrame


class RawPCMSerializer(FrameSerializer):
    """Converts raw Int16 PCM bytes ↔ pipecat audio frames.
    Also handles the JSON voice-config message the browser sends on connect."""

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


async def _run_session() -> None:
    try:
        from pipecat.audio.vad.silero import SileroVADAnalyzer
        from pipecat.pipeline.pipeline import Pipeline
        from pipecat.pipeline.worker import PipelineParams, PipelineWorker
        from pipecat.workers.runner import WorkerRunner
        from pipecat.services.groq.llm import GroqLLMService
        from pipecat.processors.aggregators.llm_context import LLMContext
        from pipecat.processors.aggregators.llm_response_universal import (
            LLMContextAggregatorPair,
            LLMUserAggregatorParams,
        )
        from pipecat.transports.websocket.server import (
            SingleClientWebsocketServerParams,
            SingleClientWebsocketServerTransport,
        )

        from stt_factory import get_stt_service
        from tts_factory import get_tts_service

        groq_key = os.environ.get('GROQ_API_KEY', '')

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

        stt = get_stt_service()
        tts = get_tts_service()
        tts_holder.append(tts)

        # system_instruction on the LLM service (pipecat 1.9 — not in context messages)
        llm = GroqLLMService(
            api_key=groq_key,
            settings=GroqLLMService.Settings(
                model=VOICE_LLM_MODEL,
                system_instruction=JARVIS_SYSTEM,
            ),
        )

        # Empty context — no system message here (moved to LLM service above)
        context = LLMContext()
        user_agg, assistant_agg = LLMContextAggregatorPair(
            context,
            user_params=LLMUserAggregatorParams(vad_analyzer=SileroVADAnalyzer()),
        )

        pipeline = Pipeline([
            transport.input(),
            stt,
            user_agg,
            llm,
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
