import os
from typing import AsyncIterator

import httpx

from . import TTSProvider

_REFERENCE_ID = os.environ.get("FISH_AUDIO_REFERENCE_ID", "")  # voice model ID from Fish Audio
_API_URL = "https://api.fish.audio/v1/tts"


class FishAudioProvider(TTSProvider):
    """Fish Audio streaming TTS — set FISH_AUDIO_REFERENCE_ID to a JARVIS clone model."""

    @property
    def name(self) -> str:
        return "fish_audio"

    @property
    def sample_rate(self) -> int:
        return 44100

    async def synthesize(self, text: str) -> AsyncIterator[bytes]:
        api_key = os.environ["FISH_AUDIO_API_KEY"]
        ref_id = _REFERENCE_ID or os.environ.get("FISH_AUDIO_REFERENCE_ID", "")
        if not ref_id:
            raise ValueError("FISH_AUDIO_REFERENCE_ID env var not set — pick a voice at fish.audio")

        payload = {
            "text": text,
            "reference_id": ref_id,
            "format": "pcm",
            "mp3_bitrate": 128,
            "opus_bitrate": 64,
            "chunk_length": 200,
            "normalize": True,
            "latency": "optimized",
        }
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=60) as client:
            async with client.stream("POST", _API_URL, json=payload, headers=headers) as resp:
                resp.raise_for_status()
                async for chunk in resp.aiter_bytes(chunk_size=4096):
                    if chunk:
                        yield chunk
