import asyncio
import logging
import os

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

VOICE_WS_PORT = int(os.environ.get('VOICE_WS_PORT', '8765'))
VOICE_LLM_MODEL = os.environ.get('VOICE_LLM_MODEL', 'qwen/qwen3.8-27b')

JARVIS_SYSTEM = (
    "You are J.A.R.V.I.S. — Just A Rather Very Intelligent System, the personal AI of your user. "
    "You speak with calm precision and dry wit. Keep voice responses concise — 1-3 sentences. "
    "Address the user respectfully. Never break character."
)


async def run_pipeline() -> None:
    try:
        from pipecat.audio.vad.silero import SileroVADAnalyzer
        from pipecat.pipeline.pipeline import Pipeline
        from pipecat.pipeline.runner import PipelineRunner
        from pipecat.pipeline.task import PipelineParams, PipelineTask
        from pipecat.services.groq.llm import GroqLLMService
        from pipecat.processors.aggregators.llm_context import LLMContext
        from pipecat.processors.aggregators.llm_response_universal import (
            LLMUserAggregator,
            LLMAssistantAggregator,
            LLMUserAggregatorParams,
            LLMAssistantAggregatorParams,
        )
        from pipecat.transports.websocket.server import (
            WebsocketServerParams,
            WebsocketServerTransport,
        )
    except ImportError as e:
        logger.error('Pipecat not installed: %s. Run: pip install "pipecat-ai[groq,silero,websocket]"', e)
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
    llm = GroqLLMService(
        api_key=groq_key,
        settings=GroqLLMService.Settings(model=VOICE_LLM_MODEL),
    )

    context = LLMContext(messages=[{'role': 'system', 'content': JARVIS_SYSTEM}])
    user_agg = LLMUserAggregator(context, params=LLMUserAggregatorParams())
    assistant_agg = LLMAssistantAggregator(context, params=LLMAssistantAggregatorParams())

    pipeline = Pipeline([
        transport.input(),
        stt,
        user_agg,
        llm,
        tts,
        transport.output(),
        assistant_agg,
    ])

    task = PipelineTask(pipeline, params=PipelineParams(allow_interruptions=True, idle_timeout=86400))
    runner = PipelineRunner()
    logger.info('Voice pipeline starting on ws://0.0.0.0:%d', VOICE_WS_PORT)
    await runner.run(task)


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_pipeline())
