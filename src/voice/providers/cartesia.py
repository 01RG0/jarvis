import os
from typing import AsyncIterator

import httpx

from . import TTSProvider

_VOICE_ID = os.environ.get("CARTESIA_VOICE_ID", "")  # set after choosing voice in dashboard
_MODEL = os.environ.get("CARTESIA_MODEL", "sonic-english")
_API_URL = "https://api.cartesia.ai/tts/bytes"


class CartesiaProvider(TTSProvider):
    """Cartesia Sonic — sub-60ms cloud streaming TTS."""

    @property
    def name(self) -> str:
        return "cartesia"

    @property
    def sample_rate(self) -> int:
        return 16000

    async def synthesize(self, text: str) -> AsyncIterator[bytes]:
        api_key = os.environ["CARTESIA_API_KEY"]
        voice_id = _VOICE_ID or os.environ.get("CARTESIA_VOICE_ID", "")
        if not voice_id:
            raise ValueError("CARTESIA_VOICE_ID env var not set")

        payload = {
            "model_id": _MODEL,
            "transcript": text,
            "voice": {"mode": "id", "id": voice_id},
            "output_format": {"container": "raw", "encoding": "pcm_s16le", "sample_rate": 16000},
        }
        headers = {
            "X-API-Key": api_key,
            "Cartesia-Version": "2024-06-10",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=30) as client:
            async with client.stream("POST", _API_URL, json=payload, headers=headers) as resp:
                resp.raise_for_status()
                async for chunk in resp.aiter_bytes(chunk_size=4096):
                    if chunk:
                        yield chunk
