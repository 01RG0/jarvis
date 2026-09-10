# JARVIS Voice — Deep Research: Free & Multi-Method Guide

Research date: 2026-09-09. Goal: get MCU JARVIS voice (Paul Bettany) into Jarvis Phase 4.
Constraint: Azure VM 2vCPU/8GB RAM — CPU-only inference, no NVIDIA GPU.

---

## Pre-trained JARVIS Models Found on Hugging Face

| Model | Type | Quality | Status |
|-------|------|---------|--------|
| `DominicSchwantes/Xtts-JARVIS-voice-clone` | XTTS-v2 fine-tune WebUI | Unknown | No pre-trained weights — it's a training tool, not a model |
| `suyashkrishangarg/Jarvis_Voice_1000e` | Unknown | Unknown | No model card — untested, risky |
| `iceTea911/JARVIS_voice_finetuned_orpheus_16bit` | Orpheus 3B LoRA (text gen) | Low | Text generation, not TTS — wrong tool |
| `derekurban2001/orpheus-jarvis-voice-lora` | Orpheus 3B LoRA | Low | 41 downloads, no docs — skip |

**Verdict**: No production-ready pre-trained JARVIS TTS model exists publicly. You need to build one.

---

## Method 1 — RVC (Retrieval-based Voice Conversion) [FREE, CPU, ⭐⭐⭐⭐]

**Concept**: Train RVC on Paul Bettany JARVIS audio, then pipe ANY TTS output through it to convert to JARVIS timbre in real-time.

**Why it works**: RVC separates pitch/timbre from content — you keep the TTS quality and timing, just swap the voice character.

**Steps**:
```bash
# 1. Extract JARVIS audio from Iron Man 1/2/3 YouTube
pip install yt-dlp
yt-dlp -x --audio-format wav -o "jarvis_raw.wav" "https://www.youtube.com/watch?v=<iron-man-clip>"
# Search YouTube: "JARVIS Iron Man all scenes compilation" — gets ~15 min clean audio

# 2. Clean the audio (remove music, SFX, silence)
pip install demucs  # separates speech from background
python -m demucs --two-stems=vocals jarvis_raw.wav

# 3. Train RVC (takes ~30min on CPU with 10min audio)
git clone https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI
cd Retrieval-based-Voice-Conversion-WebUI
pip install -r requirements.txt
python infer-web.py  # use WebUI to train, or use CLI

# 4. Inference: pipe any TTS wav through RVC
python tools/infer_cli.py --f0method rmvpe --input_path tts_output.wav \
  --model_path jarvis_rvc.pth --index_path jarvis.index \
  --output_path jarvis_output.wav
```

**Specs**:
- Training: 10 min audio minimum, ~30–60 min on CPU
- Inference: ~200–500ms added latency on CPU (runs after TTS)
- CPU support: ✅ full (uses `rmvpe` pitch extractor, CPU mode)
- Quality: 8–9/10 JARVIS similarity with good training data
- Pipecat integration: run as post-processing step on TTS chunks (adds latency, best for non-streaming)
- License: MIT, free

**Best pipeline**: Kokoro TTS → RVC → audio out

---

## Method 2 — Kokoro-82M (British Male Voices) [FREE, CPU, ⭐⭐⭐]

**Concept**: Use Kokoro's built-in British male voices — no cloning needed.

```bash
pip install kokoro>=0.9.4 soundfile
```

```python
from kokoro import KPipeline
pipeline = KPipeline(lang_code='en-gb')

# Available British male voices:
# bm_george  — deep, formal British (most JARVIS-like)
# bm_fable   — narrative British
# bm_daniel  — crisp British  
# bm_lewis   — warm British

text = "All systems operational, sir. How may I assist?"
generator = pipeline(text, voice='bm_george', speed=0.9)
for samples, sample_rate, segment in generator:
    # stream audio chunks
    pass
```

**Specs**:
- No training needed — works immediately
- CPU inference: ✅ fast (~82M params, StyleTTS2 arch)
- Streaming: ✅ generator-based
- Quality: 6.5/10 JARVIS similarity (sounds British/deep but not specifically Paul Bettany)
- License: Apache 2.0, fully free
- Pipecat: wrap in custom `BaseTTSService`

---

## Method 3 — XTTS-v2 with Custom Voice Samples [FREE, CPU-slow, ⭐⭐⭐⭐]

**Concept**: Coqui XTTS-v2 can clone a voice from 6 seconds of reference audio. Give it Paul Bettany JARVIS clips.

```bash
pip install TTS
```

```python
from TTS.api import TTS
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2")

# Reference: any clean 6-30 sec JARVIS clip (extract from Iron Man)
tts.tts_to_file(
    text="Running diagnostics on the arc reactor, sir.",
    speaker_wav="jarvis_reference_clip.wav",
    language="en",
    file_path="output.wav"
)
```

**Specs**:
- Minimum reference audio: 6 seconds (longer = better, 30s optimal)
- CPU inference: ✅ but slow (~5-15x real-time on 2vCPU)
- Streaming latency: <200ms on GPU; ~2–5s on CPU — not viable for live voice
- Quality: 7–8/10 JARVIS similarity
- **Workaround for CPU latency**: Pre-generate common phrases offline; use Kokoro for live, XTTS for recorded greetings
- License: MPL-2.0 (open source but not MIT)

---

## Method 4 — ElevenLabs Instant Voice Clone [FREE TIER, Cloud, ⭐⭐⭐⭐⭐]

**Concept**: Upload 1–5 minutes of clean Paul Bettany JARVIS audio — get a clone usable via API immediately.

**Steps**:
1. Extract clean JARVIS audio from YouTube (yt-dlp, then demucs to remove music)
2. Go to elevenlabs.io → Voices → Add Voice → Instant Clone
3. Upload WAV clips (multiple files, total 1–5 min)
4. Get a voice ID → plug into existing `ELEVENLABS_API_KEY` + voice_id config
5. Already integrated in Phase 4 pipeline

**Tiers**:
| Tier | Cost | Audio needed | Quality |
|------|------|-------------|---------|
| Free (Instant Clone) | $0 | 1–5 min | 7/10 |
| Creator $22/mo (Instant) | $22/mo | 1–5 min | 7–8/10 |
| Pro Clone | ~$99 one-time | 30+ min | 9–10/10 |

**This is the easiest path** — no code changes, works with existing pipeline, just a voice_id swap.

---

## Method 5 — F5-TTS Zero-Shot Clone [FREE, GPU-preferred, ⭐⭐⭐⭐]

**Concept**: F5-TTS generates speech by matching a reference audio + reference text. No fine-tuning needed.

```bash
pip install f5-tts
f5-tts_infer-cli \
  --model F5TTS_Base \
  --ref_audio jarvis_reference.wav \
  --ref_text "All systems are fully operational." \
  --gen_text "Good morning, sir. Your schedule for today is clear." \
  --output_dir ./output
```

**Specs**:
- Reference: 5–15 sec clean audio
- CPU inference: possible but slow (transformer diffusion model)
- GPU latency: 253ms on L20; CPU: ~3–8s
- Quality: 8/10 zero-shot
- Best for: offline pre-generation of JARVIS audio clips

---

## Method 6 — OpenVoice V2 Zero-Shot [FREE, MIT, ⭐⭐⭐]

```bash
pip install openvoice
```

```python
from openvoice import se_extractor
from openvoice.api import ToneColorConverter

# Extract voice style from reference
reference_speaker = "jarvis_clip.wav"
tone_color_converter = ToneColorConverter(f'{ckpt_converter}/config.json', device="cpu")
source_se, _ = se_extractor.get_se(reference_speaker, tone_color_converter, vad=True)

# Generate with any TTS, then convert tone
# (used on top of MeloTTS output)
```

**Specs**:
- CPU: ✅ supported
- Quality: 6–7/10 (decent British clone)
- Latency: moderate on CPU (~1–3s)
- License: MIT, free for commercial use
- Best for: demo/offline use, not live streaming

---

## The Hybrid Strategy (Recommended for Jarvis)

**For live voice conversations (low latency priority)**:
```
Groq STT → LLM → Kokoro bm_george (fast CPU) → WebSocket to browser
```
Get JARVIS-like British deep voice immediately, zero setup.

**For high-quality JARVIS accuracy (best result)**:
```
1. Extract Paul Bettany audio from Iron Man 1/2/3 YT clips (yt-dlp)
2. Clean with demucs (remove music/SFX)
3. Upload to ElevenLabs Instant Clone (free tier)
4. Plug new voice_id into existing ElevenLabs config
→ ~7/10 JARVIS similarity, live streaming, 200ms latency
```

**For perfect JARVIS (maximum effort)**:
```
1. Extract ~10 min clean Paul Bettany audio
2. Train RVC model on it (30–60 min one-time)
3. Use Kokoro bm_george as base TTS (fast CPU)
4. Pipe through RVC for voice conversion
→ 8–9/10 JARVIS similarity, fully free, CPU-viable
Note: adds ~300ms latency for RVC step
```

---

## Comparison Table

| Method | Cost | CPU viable | Setup effort | JARVIS quality | Live streaming |
|--------|------|-----------|-------------|----------------|----------------|
| Kokoro bm_george | Free | ✅ fast | Zero — works now | 6/10 | ✅ |
| ElevenLabs Instant Clone | Free tier | N/A (cloud) | Low (upload clips) | 7/10 | ✅ |
| RVC + Kokoro | Free | ✅ 300ms extra | Medium (train RVC) | 8–9/10 | ⚠️ adds latency |
| XTTS-v2 reference | Free | ⚠️ slow | Low | 7–8/10 | ❌ too slow live |
| F5-TTS | Free | ⚠️ slow | Low | 8/10 | ❌ too slow live |
| OpenVoice V2 | Free | ✅ | Low | 6–7/10 | ⚠️ borderline |
| ElevenLabs Pro Clone | $99 one-time | N/A (cloud) | Medium (30 min audio) | 9–10/10 | ✅ |

---

## Recommended Build Order

1. **Today** — Switch to `Kokoro bm_george` as default TTS. British, deep, formal. Zero setup.
2. **This week** — Extract JARVIS audio from YouTube, upload to ElevenLabs Instant Clone (free). Plug voice_id in. 7/10 instantly.
3. **Optional** — Train RVC on that same audio. Route Kokoro → RVC for offline/non-live use. 9/10 quality.
4. **Long-term** — ElevenLabs Pro Clone if you collect 30+ min of clean Paul Bettany audio. 10/10.

## Audio Extraction Command

```bash
# Get clean Paul Bettany JARVIS audio from YouTube
pip install yt-dlp demucs

# Search terms that give clean JARVIS voice: "JARVIS Iron Man scenes no music"
yt-dlp -x --audio-format wav --audio-quality 0 \
  -o "raw/%(title)s.wav" \
  "ytsearch5:JARVIS Iron Man all scenes compilation"

# Separate voice from background music/SFX
python -m demucs --two-stems=vocals raw/*.wav
# Output: separated/htdemucs/<file>/vocals.wav

# Trim silence, split into segments
pip install pydub
python -c "
from pydub import AudioSegment, silence
audio = AudioSegment.from_wav('separated/htdemucs/jarvis_raw/vocals.wav')
chunks = silence.split_on_silence(audio, min_silence_len=500, silence_thresh=-40)
for i, chunk in enumerate(chunks):
    if len(chunk) > 2000:  # keep segments > 2s
        chunk.export(f'segments/jarvis_{i:03d}.wav', format='wav')
"
```
