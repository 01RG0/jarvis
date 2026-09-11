import os

from dotenv import load_dotenv

load_dotenv()

# Default voice: ElevenLabs Bill — closest MCU Jarvis match
_DEFAULT_VOICE_ID = 'pqHfZKP75CvOlQylNhV4'


def get_tts_service():
    provider = os.environ.get('TTS_PROVIDER', 'elevenlabs')
    if provider == 'elevenlabs':
        api_key = os.environ.get('ELEVENLABS_API_KEY')
        assert api_key, 'ELEVENLABS_API_KEY is required when TTS_PROVIDER=elevenlabs'
        from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
        return ElevenLabsTTSService(
            api_key=api_key,
            settings=ElevenLabsTTSService.Settings(
                voice=os.environ.get('ELEVENLABS_VOICE_ID', _DEFAULT_VOICE_ID),
                model=os.environ.get('ELEVENLABS_MODEL', 'eleven_turbo_v2_5'),
            ),
        )
    elif provider == 'cartesia':
        api_key = os.environ.get('CARTESIA_API_KEY')
        assert api_key, 'CARTESIA_API_KEY is required when TTS_PROVIDER=cartesia'
        voice_id = os.environ.get('CARTESIA_VOICE_ID')
        assert voice_id, 'CARTESIA_VOICE_ID is required when TTS_PROVIDER=cartesia'
        from pipecat.services.cartesia.tts import CartesiaTTSService
        return CartesiaTTSService(api_key=api_key, voice_id=voice_id)
    elif provider == 'openai':
        api_key = os.environ.get('OPENAI_API_KEY')
        assert api_key, 'OPENAI_API_KEY is required when TTS_PROVIDER=openai'
        from pipecat.services.openai.tts import OpenAITTSService
        return OpenAITTSService(
            api_key=api_key,
            voice=os.environ.get('OPENAI_TTS_VOICE', 'onyx'),
        )
    elif provider == 'groq':
        api_key = os.environ.get('GROQ_API_KEY')
        assert api_key, 'GROQ_API_KEY is required when TTS_PROVIDER=groq'
        from pipecat.services.groq.tts import GroqTTSService
        return GroqTTSService(
            api_key=api_key,
            settings=GroqTTSService.Settings(
                model=os.environ.get('GROQ_TTS_MODEL', 'canopylabs/orpheus-v1-english'),
                voice=os.environ.get('GROQ_TTS_VOICE', 'daniel'),
            ),
        )
    else:
        raise ValueError(
            f'Unknown TTS provider: {provider}. '
            'Set TTS_PROVIDER to elevenlabs, cartesia, openai, or groq.'
        )
