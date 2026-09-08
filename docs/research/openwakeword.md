# Research: openWakeWord

**Verdict: Use it for Phase 4. ONNX-based, trainable custom wake word, zero cloud dependency.**

## What it is

openWakeWord is an open-source Python library for wake word detection. It uses small ONNX
models (openwakeword uses a melspectrogram feature extractor + a tiny neural net) to detect
specific phrases in a continuous audio stream in real time.

Key properties:
- Apache 2.0 license
- ONNX runtime — fast, cross-platform, works on CPU
- Ships pretrained models for common wake words ("hey jarvis", "alexa", "hey siri", etc.)
- Includes a Colab notebook to train a **custom wake word** ("Hey Jarvis" with your specific pronunciation)
- Lightweight enough for a Raspberry Pi 3 — no problem on a 2-core VM

## Quick Start

```python
import openwakeword
from openwakeword.model import Model
import pyaudio
import numpy as np

# Download pretrained models on first run
openwakeword.utils.download_models()

# Load model (use pretrained or custom)
oww = Model(
    wakeword_models=["hey_jarvis"],  # pretrained model name
    # or: wakeword_models=["./my_custom_wake_word.onnx"]
    inference_framework="onnx",
)

# Audio stream (PyAudio)
pa = pyaudio.PyAudio()
stream = pa.open(
    rate=16000,
    channels=1,
    format=pyaudio.paInt16,
    input=True,
    frames_per_buffer=1280,  # 80ms at 16kHz
)

print("Listening for wake word...")
while True:
    audio = np.frombuffer(stream.read(1280), dtype=np.int16)
    prediction = oww.predict(audio)
    
    for name, score in prediction.items():
        if score > 0.7:
            print(f"Wake word detected: {name} (score: {score:.2f})")
            # Signal Pipecat to start a session
            start_voice_session()
```

## Custom Wake Word Training

To train "Hey Jarvis" with your own voice:
1. Open the Colab notebook: `notebooks/custom_wake_word.ipynb`
2. Record 10–30 sample clips of yourself saying "Hey Jarvis"
3. Training takes ~5–15 minutes on Colab GPU
4. Download the `.onnx` file and load it via `wakeword_models=["./hey_jarvis_custom.onnx"]`

Custom wake words significantly improve accuracy — the pretrained "hey_jarvis" model was trained
on generic voices; your own voice recordings reduce false negatives.

## Integration with Pipecat

openWakeWord runs in a separate thread from the Pipecat pipeline. It monitors the raw audio
stream and triggers session start:

```python
import threading
from queue import Queue

wake_event = Queue()

def wakeword_thread():
    oww = Model(wakeword_models=["hey_jarvis"])
    # ... (audio loop above)
    while True:
        # ... read audio chunk
        prediction = oww.predict(audio_chunk)
        if max(prediction.values()) > 0.7:
            wake_event.put(True)

# Start in background
threading.Thread(target=wakeword_thread, daemon=True).start()

# In voice mode loop:
while True:
    wake_event.get()  # blocks until wake word detected
    await run_pipecat_session()
```

## Comparison with Picovoice Porcupine

| | openWakeWord | Picovoice Porcupine |
|---|---|---|
| License | Apache 2.0 (free) | Free tier (1 wake word, non-commercial) |
| Custom wake words | Yes, open training | Yes, via Picovoice Console (commercial for prod) |
| Accuracy | Good, ~95% on pretrained | Higher (~98%) on constrained hardware |
| CPU usage | ~5–10% on 1 core | ~1–3% on 1 core |
| Privacy | 100% local | 100% local |

Recommendation: start with openWakeWord (no license friction). Evaluate Porcupine if false
positive/negative rates become annoying in daily use.

## Gotchas

- Audio must be 16kHz mono PCM (16-bit int) — if your microphone uses a different format, resample with `scipy.signal.resample` or PyAudio's conversion
- The pretrained "hey_jarvis" model will produce false positives on similar phrases ("hey harris", etc.) — tune the score threshold (0.7 is conservative, lower = more sensitive)
- On the Azure VM (no microphone): the openWakeWord listener runs on the client (browser/PC), not on the server. The server receives audio frames only after wake detection.

## Resources

- GitHub: https://github.com/dscripka/openWakeWord
- Training notebook: `notebooks/custom_wake_word.ipynb`
- Model zoo: `openwakeword/resources/models/`
