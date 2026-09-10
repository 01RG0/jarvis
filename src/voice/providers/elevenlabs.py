import os
from typing import AsyncIterator

from . import TTSProvider

_VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID", "pqHfZKP75CvOlQylNhV4")  # Bill
_MODEL = os.environ.get("ELEVENLABS_MODEL", "eleven_turbo_v2_5")


class ElevenLabsProvider(TTSProvider):
    """ElevenLabs streaming TTS — Bill voice by default."""

    @property
    def name(self) -> str:
        return "elevenlabs"

    @property
    def sample_rate(self) -> int:
        return 16000

    async def synthesize(self, text: str) -> AsyncIterator[bytes]:
        from elevenlabs.client import AsyncElevenLabs
        client = AsyncElevenLabs(api_key=os.environ["ELEVENLABS_API_KEY"])
        async for chunk in await client.text_to_speech.convert(
            text=text,
            voice_id=_VOICE_ID,
            model_id=_MODEL,
            output_format="pcm_16000",
        ):
            if chunk:
                yield chunk
