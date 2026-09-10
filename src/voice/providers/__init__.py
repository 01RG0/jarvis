from abc import ABC, abstractmethod
from typing import AsyncIterator
import os


class TTSProvider(ABC):
    """Base class for all TTS providers. Yields PCM16 audio chunks."""

    @abstractmethod
    async def synthesize(self, text: str) -> AsyncIterator[bytes]:
        """Yield raw PCM16 audio chunks as they become available."""
        ...

    @property
    @abstractmethod
    def sample_rate(self) -> int:
        ...

    @property
    @abstractmethod
    def name(self) -> str:
        ...


def get_provider(name: str | None = None) -> TTSProvider:
    """Factory — reads JARVIS_TTS_PROVIDER env var if name not given."""
    name = (name or os.environ.get("JARVIS_TTS_PROVIDER", "piper")).lower()
    match name:
        case "elevenlabs":
            from .elevenlabs import ElevenLabsProvider
            return ElevenLabsProvider()
        case "cartesia":
            from .cartesia import CartesiaProvider
            return CartesiaProvider()
        case "fish" | "fish_audio":
            from .fish_audio import FishAudioProvider
            return FishAudioProvider()
        case "kokoro":
            from .kokoro import KokoroProvider
            return KokoroProvider()
        case "piper" | _:
            from .piper import PiperProvider
            return PiperProvider()
