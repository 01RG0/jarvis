import asyncio
import io
import os
from pathlib import Path
from typing import AsyncIterator

from . import TTSProvider

_MODEL_REPO = "jgkawell/jarvis"
_MODEL_FILE = "en/en_GB/jarvis/medium/jarvis-medium.onnx"
_CONFIG_FILE = "en/en_GB/jarvis/medium/jarvis-medium.onnx.json"
_CACHE_DIR = Path(os.environ.get("JARVIS_DATA_DIR", "./data")) / "piper_models"


def _ensure_model() -> tuple[Path, Path]:
    model_path = _CACHE_DIR / "jarvis-medium.onnx"
    config_path = _CACHE_DIR / "jarvis-medium.onnx.json"
    if model_path.exists() and config_path.exists():
        return model_path, config_path
    _CACHE_DIR.mkdir(parents=True, exist_ok=True)
    from huggingface_hub import hf_hub_download
    hf_hub_download(repo_id=_MODEL_REPO, filename=_MODEL_FILE, local_dir=_CACHE_DIR, local_dir_use_symlinks=False)
    hf_hub_download(repo_id=_MODEL_REPO, filename=_CONFIG_FILE, local_dir=_CACHE_DIR, local_dir_use_symlinks=False)
    return model_path, config_path


class PiperProvider(TTSProvider):
    """Piper TTS with jgkawell/jarvis model — CPU, free, ~0.2s latency."""

    def __init__(self):
        self._voice = None

    def _get_voice(self):
        if self._voice is None:
            from piper.voice import PiperVoice
            model_path, _ = _ensure_model()
            self._voice = PiperVoice.load(str(model_path))
        return self._voice

    @property
    def name(self) -> str:
        return "piper"

    @property
    def sample_rate(self) -> int:
        return 22050

    async def synthesize(self, text: str) -> AsyncIterator[bytes]:
        loop = asyncio.get_event_loop()
        voice = self._get_voice()

        def _synth() -> bytes:
            buf = io.BytesIO()
            with voice.synthesize_stream_raw() as stream:
                for chunk in stream.synthesize(text):
                    buf.write(chunk)
            return buf.getvalue()

        pcm = await loop.run_in_executor(None, _synth)
        # Yield in 4KB chunks for streaming feel
        chunk_size = 4096
        for i in range(0, len(pcm), chunk_size):
            yield pcm[i:i + chunk_size]
            await asyncio.sleep(0)
