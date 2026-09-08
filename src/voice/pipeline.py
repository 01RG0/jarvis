import asyncio
import logging
import os

import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

BRAIN_URL = os.environ.get('BRAIN_INTERNAL_URL', 'http://localhost:8001')
VOICE_WS_PORT = int(os.environ.get('VOICE_WS_PORT', '8765'))
VOICE_LLM_MODEL = os.environ.get('VOICE_LLM_MODEL', 'llama-3.1-8b-instant')


async def call_brain(task_id: str, user_text: str) -> str:
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f'{BRAIN_URL}/task',
            json={'id': task_id, 'input': user_text, 'model': 'balanced'},
        )
        resp.raise_for_status()
        return resp.json().get('result', '')


async def run_pipeline() -> None:
    try:
        from pipecat.audio.vad.silero import SileroVADAnalyzer
        from pipecat.pipeline.pipeline import Pipeline
        from pipecat.pipeline.runner import PipelineRunner
        from pipecat.pipeline.task import PipelineParams, PipelineTask
        from pipecat.services.openai import OpenAILLMService
        from pipecat.processors.aggregators.openai_llm_context import OpenAILLMContext
        from pipecat.transports.network.websocket_server import (
            WebsocketServerParams,
            WebsocketServerTransport,
        )
    except ImportError as e:
        logger.error('Pipecat not installed: %s. Run: pip install "pipecat-ai[deepgram,elevenlabs,silero,websocket]"', e)
        raise

    from stt_factory import get_stt_service
    from tts_factory import get_tts_service

    groq_key = os.environ.get('GROQ_API_KEY', '')

    transport = WebsocketServerTransport(
        host='0.0.0.0',
        port=VOICE_WS_PORT,
        params=WebsocketServerParams(
            audio_out_enabled=True,
            vad_enabled=True,
            vad_analyzer=SileroVADAnalyzer(),
            vad_audio_passthrough=True,
        ),
    )

    stt = get_stt_service()
    tts = get_tts_service()
    llm = OpenAILLMService(
        api_key=groq_key,
        base_url='https://api.groq.com/openai/v1',
        model=VOICE_LLM_MODEL,
    )

    context = OpenAILLMContext(messages=[
        {'role': 'system', 'content': 'You are Jarvis, a personal AI assistant. Be concise and helpful.'},
    ])
    context_aggregator = llm.create_context_aggregator(context)

    pipeline = Pipeline([
        transport.input(),
        stt,
        context_aggregator.user(),
        llm,
        tts,
        transport.output(),
        context_aggregator.assistant(),
    ])

    task = PipelineTask(pipeline, params=PipelineParams(allow_interruptions=True))
    runner = PipelineRunner()
    logger.info('Voice pipeline starting on ws://0.0.0.0:%d', VOICE_WS_PORT)
    await runner.run(task)


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_pipeline())
