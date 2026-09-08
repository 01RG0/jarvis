import os

from dotenv import load_dotenv

load_dotenv()


def get_stt_service():
    provider = os.environ.get('STT_PROVIDER', 'deepgram')
    if provider == 'deepgram':
        api_key = os.environ.get('DEEPGRAM_API_KEY')
        assert api_key, 'DEEPGRAM_API_KEY is required when STT_PROVIDER=deepgram'
        from pipecat.services.deepgram import DeepgramSTTService
        return DeepgramSTTService(api_key=api_key)
    elif provider == 'whisper_openai':
        api_key = os.environ.get('OPENAI_API_KEY')
        assert api_key, 'OPENAI_API_KEY is required when STT_PROVIDER=whisper_openai'
        from pipecat.services.openai import OpenAISTTService
        return OpenAISTTService(api_key=api_key)
    elif provider == 'assemblyai':
        api_key = os.environ.get('ASSEMBLYAI_API_KEY')
        assert api_key, 'ASSEMBLYAI_API_KEY is required when STT_PROVIDER=assemblyai'
        from pipecat.services.assemblyai import AssemblyAISTTService
        return AssemblyAISTTService(api_key=api_key)
    else:
        raise ValueError(
            f'Unknown STT provider: {provider}. '
            'Set STT_PROVIDER to deepgram, whisper_openai, or assemblyai.'
        )
