import asyncio
import os
from typing import AsyncIterator

from . import TTSProvider

_VOICE = os.environ.get("KOKORO_VOICE", "bm_george")
_SPEED = float(os.environ.get("KOKORO_SPEED", "0.95"))


class KokoroProvider(TTSProvider):
    """Kokoro TTS — CPU, free, <50ms, British male bm_george voice."""

    def __init__(self):
        self._pipeline = None

    def _get_pipeline(self):
        if self._pipeline is None:
            from kokoro import KPipeline
            self._pipeline = KPipeline(lang_code="b")  # 'b' = British English
        return self._pipeline

    @property
    def name(self) -> str:
        return "kokoro"

    @property
    def sample_rate(self) -> int:
        return 24000

    async def synthesize(self, text: str) -> AsyncIterator[bytes]:
        import numpy as np
        loop = asyncio.get_event_loop()
        pipeline = self._get_pipeline()

        def _synth():
            chunks = []
            for _, _, audio in pipeline(text, voice=_VOICE, speed=_SPEED):
                if audio is not None:
                    pcm = (audio * 32767).astype(np.int16).tobytes()
                    chunks.append(pcm)
            return chunks

        audio_chunks = await loop.run_in_executor(None, _synth)
        for chunk in audio_chunks:
            yield chunk
            await asyncio.sleep(0)
