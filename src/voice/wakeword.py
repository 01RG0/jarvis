import logging
import os
import queue
import threading

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

WAKE_WORD_THRESHOLD = float(os.environ.get('WAKE_WORD_THRESHOLD', '0.7'))
WAKE_WORD_MODEL = os.environ.get('WAKE_WORD_MODEL', 'hey_jarvis')


class WakeWordDetector:
    def __init__(self):
        self._event_queue: queue.Queue = queue.Queue()
        self._running = False
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        logger.info(f'Wake word detector started (model={WAKE_WORD_MODEL}, threshold={WAKE_WORD_THRESHOLD})')

    def stop(self) -> None:
        self._running = False

    def wait_for_wake_word(self, timeout: float | None = None) -> bool:
        # Returns True when wake word detected, False on timeout
        try:
            self._event_queue.get(timeout=timeout)
            return True
        except queue.Empty:
            return False

    def _run(self) -> None:
        try:
            import openwakeword
            import pyaudio
            import numpy as np
            from openwakeword.model import Model as OWWModel

            openwakeword.utils.download_models()
            oww = OWWModel(wakeword_models=[WAKE_WORD_MODEL], inference_framework='onnx')
            pa = pyaudio.PyAudio()
            stream = pa.open(rate=16000, channels=1, format=pyaudio.paInt16, input=True, frames_per_buffer=1280)
            logger.info('Listening for wake word...')

            while self._running:
                audio = np.frombuffer(stream.read(1280, exception_on_overflow=False), dtype=np.int16)
                prediction = oww.predict(audio)
                for name, score in prediction.items():
                    if score > WAKE_WORD_THRESHOLD:
                        logger.info(f'Wake word detected: {name} (score={score:.2f})')
                        self._event_queue.put({'name': name, 'score': float(score)})

            stream.stop_stream()
            stream.close()
            pa.terminate()

        except ImportError as e:
            logger.warning(f'Wake word detection unavailable: {e}. Install openwakeword and pyaudio.')
            # Fall back: put a sentinel so wait_for_wake_word does not block forever
            while self._running:
                import time; time.sleep(1)
        except Exception as e:
            logger.error(f'Wake word detector error: {e}')


_detector: WakeWordDetector | None = None


def get_detector() -> WakeWordDetector:
    global _detector
    if not _detector:
        _detector = WakeWordDetector()
    return _detector
