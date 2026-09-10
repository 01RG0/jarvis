# JARVIS Voice — Deep Research Report
*Generated: 2026-09-09*

## TL;DR — Ranked by Quality × Effort

| # | Method | Cost | Local/Cloud | Quality | Effort | Best for |
|---|--------|------|-------------|---------|--------|----------|
| 1 | **Piper TTS — jgkawell/jarvis** | Free | Local, CPU | ★★★☆☆ | 5 min | Instant, no GPU, no API key |
| 2 | **XTTS v2 instant clone** | Free | Local, GPU | ★★★★☆ | 30 min | Best free quality, needs GPU or Colab |
| 3 | **ElevenLabs Instant Voice Clone** | Free (3 samples) / $5/mo | Cloud | ★★★★★ | 15 min | Easiest high-quality option |
| 4 | **ElevenLabs Professional Clone** | $99/mo or one-time | Cloud | ★★★★★+ | 1 hr | Most authentic, Paul Bettany-level |
| 5 | **RVC model (ronangrant/rvc_jarvis)** | Free | Local, GPU | ★★★☆☆ | 1 hr | Real-time voice conversion |
| 6 | **Orpheus LoRA fine-tune** | Free | Local, 6GB VRAM | ★★★★☆ | varies | TTS with JARVIS personality baked in |

---

## Option 1 — Piper TTS: jgkawell/jarvis (FREE, CPU, instant)

**Best for Jarvis Phase 4 if you want zero cost and no GPU.**

- **HuggingFace**: https://huggingface.co/jgkawell/jarvis
- **Format**: ONNX (Piper TTS)
- **License**: MIT
- **Description**: Community-trained voice model emulating MCU JARVIS, English GB accent. Used in Home Assistant via Piper add-on. 3 Spaces on HuggingFace currently run this model.
- **Latency**: ~0.2s per sentence on M1 Mac; 2–5s on free-tier cloud VM. On Azure 2vCPU: ~0.5–1s.
- **Quality**: Good British accent, robotic warmth. Not indistinguishable from Paul Bettany but clearly JARVIS-inspired.

### Python usage
```bash
pip install piper-tts huggingface_hub
```

```python
from piper import PiperVoice
from huggingface_hub import hf_hub_download
import wave, io

model_path = hf_hub_download("jgkawell/jarvis", "en/en_GB/jarvis/medium/jarvis-medium.onnx")
config_path = hf_hub_download("jgkawell/jarvis", "en/en_GB/jarvis/medium/jarvis-medium.onnx.json")

voice = PiperVoice.load(model_path, config_path=config_path)

# Synthesize to WAV bytes
with io.BytesIO() as wav_io:
    with wave.open(wav_io, "wb") as wav_file:
        voice.synthesize("Welcome back, sir. All systems are operational.", wav_file)
    audio_bytes = wav_io.getvalue()
```

### Streaming note
Piper 1.x (OHF-Voice/piper1-gpl) supports streaming via HTTP server mode:
```bash
pip install piper-tts
python -m piper.http_server --model jarvis-medium.onnx --port 5000
# GET http://localhost:5000/synthesize?text=Hello+sir
```
Returns raw PCM audio stream. Can wrap as chunked response for real-time playback.

---

## Option 2 — XTTS v2 Instant Clone (FREE, needs GPU or Colab)

**Best free option that produces near-professional quality.**

XTTS v2 can clone a voice from just 6 seconds of reference audio. Use Paul Bettany's JARVIS clips as reference — no training required, just inference-time conditioning.

```bash
pip install TTS
```

```python
from TTS.api import TTS

tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2", gpu=True)

# reference_audio = 2-10 seconds of clean Paul Bettany JARVIS audio
tts.tts_to_file(
    text="The Mark IV is ready for deployment, sir.",
    speaker_wav="jarvis_reference.wav",
    language="en",
    file_path="output.wav"
)
```

**Streaming (real-time):**
```python
chunks = tts.tts_stream(
    text="All systems nominal.",
    speaker_wav="jarvis_reference.wav",
    language="en"
)
for chunk in chunks:
    # chunk is raw PCM bytes — send to websocket
    pass
```

**Requirements**: CUDA GPU recommended (runs on CPU but ~10x slower). On Azure VM without GPU: use Google Colab to generate a reference model file, then use Piper.

**Getting reference audio**: See "Clean Audio Sources" section below.

---

## Option 3 — ElevenLabs Instant Voice Clone (FREE tier: 3 clips)

**Easiest path to high quality.**

1. Go to https://elevenlabs.io/voice-lab → Add Voice → Instant Voice Clone
2. Upload 3–5 clean JARVIS audio clips (2–10 min total)
3. ElevenLabs returns a `voice_id`
4. Use that `voice_id` in the existing Pipecat/ElevenLabs integration

**Free tier**: 3 voice clones, 10k characters/month
**Creator plan ($22/mo)**: unlimited clones, 100k chars/month
**No existing JARVIS voice** found in ElevenLabs public voice library (searched).

```python
# After cloning, just update ELEVENLABS_VOICE_ID in .env:
# ELEVENLABS_VOICE_ID=<your-cloned-voice-id>
# The rest of the Pipecat pipeline stays identical.
```

---

## Option 4 — ElevenLabs Professional Voice Clone

**Most authentic. Requires ~30 min of clean audio.**

- Professional Voice Clone plan: $99/mo (or one-time via API)
- Upload 30 min+ of clean speech → high-fidelity clone
- Result is indistinguishable from the source

This is the "real JARVIS" path. Collect 30+ minutes of clean Paul Bettany JARVIS dialogue from the films, upload to ElevenLabs, get a voice_id that sounds exactly like MCU JARVIS.

---

## Option 5 — RVC Model: ronangrant/rvc_jarvis

- **HuggingFace**: https://huggingface.co/ronangrant/rvc_jarvis
- **Format**: RVC (Retrieval-based Voice Conversion)
- **Status**: No model card — unknown training data/quality. Worth testing.
- **How RVC works**: Takes any TTS output (or your voice) and converts it to sound like JARVIS in real-time.

```bash
pip install rvc-python
```

```python
from rvc_python.infer import RVCInference

rvc = RVCInference()
rvc.load_model("path/to/rvc_jarvis.pth")

# Convert any audio to JARVIS voice
rvc.infer_file(input_path="tts_output.wav", output_path="jarvis_output.wav")
```

**Pipeline with RVC**: Use any cheap TTS (edge-tts, pyttsx3) → pass through RVC → JARVIS voice. Low latency if running locally with GPU.

---

## Option 6 — Orpheus JARVIS Fine-tunes (TTS with personality)

These are TTS models fine-tuned to speak *as* JARVIS, not just sound like him:

- **iceTea911/JARVIS_voice_finetuned_orpheus_16bit** — 3B, BF16, Apache 2.0
  - https://huggingface.co/iceTea911/JARVIS_voice_finetuned_orpheus_16bit
  - Generates JARVIS-style speech from text. 6GB+ VRAM needed.
  
- **derekurban2001/orpheus-jarvis-voice-lora** — LoRA adapter on Orpheus 3B
  - https://huggingface.co/derekurban2001/orpheus-jarvis-voice-lora
  - Lighter weight than full fine-tune.

```python
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

base = AutoModelForCausalLM.from_pretrained("unsloth/orpheus-3b-0.1-ft")
model = PeftModel.from_pretrained(base, "derekurban2001/orpheus-jarvis-voice-lora")
tokenizer = AutoTokenizer.from_pretrained("derekurban2001/orpheus-jarvis-voice-lora")
```

**Note**: Orpheus-based models require 6GB+ VRAM — too heavy for the 8GB Azure VM running all other services. Use on a separate machine or Colab.

---

## Clean Audio Sources for Voice Cloning

To clone Paul Bettany's JARVIS voice, you need 30 sec–30 min of clean speech (no music, no SFX).

**Best film scenes with clean JARVIS dialogue:**
- Iron Man (2008): Workshop/garage scenes — JARVIS giving status updates with no music under them
- Iron Man 2 (2010): Suit-up sequences, Malibu mansion diagnostics
- Iron Man 3 (2013): "Starting Diagnostics" and system report scenes
- Avengers (2012): JARVIS briefing scenes on the helicarrier

**Extraction process:**
```bash
# 1. Download YouTube audio (ensure you have rights)
yt-dlp -x --audio-format wav "https://www.youtube.com/watch?v=VIDEO_ID" -o "raw.wav"

# 2. Isolate voice — remove music/SFX with Demucs
pip install demucs
python -m demucs --two-stems=vocals raw.wav
# Output: htdemucs/raw/vocals.wav (clean voice only)

# 3. Chunk into 2-10 second segments
python -c "
from pydub import AudioSegment
from pydub.silence import split_on_silence
audio = AudioSegment.from_wav('htdemucs/raw/vocals.wav')
chunks = split_on_silence(audio, min_silence_len=500, silence_thresh=-40)
for i, c in enumerate(chunks):
    if len(c) > 2000:  # >2 seconds
        c.export(f'chunk_{i:03d}.wav', format='wav')
"
```

---

## Recommended Stack for Jarvis

**Immediate (0 effort, free):**
→ Use Piper TTS `jgkawell/jarvis` model. CPU-only, MIT, ships in 5 minutes.

**Best quality, free:**
→ XTTS v2 instant clone with 10 sec of Paul Bettany audio. Use Google Colab for GPU, save reference embedding, deploy inference on CPU.

**Real MCU JARVIS voice:**
→ ElevenLabs Instant Clone (free tier) with 5–10 clean clips from the films.
→ For perfect fidelity: Professional Clone with 30+ minutes.

**Integration**: All options drop into the same Pipecat ElevenLabs slot — just swap `voice_id` for ElevenLabs options, or replace `ElevenLabsTTSService` with a `PiperTTSService` wrapper for local options.
