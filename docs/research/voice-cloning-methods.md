# JARVIS Voice Cloning Methods

*How to get the closest possible MCU JARVIS (Paul Bettany) voice — free, cheap, and best quality options.*

---

## Pre-trained JARVIS models on HuggingFace (use immediately)

| Model | Type | Quality | How to use |
|-------|------|---------|------------|
| `DominicSchwantes/Xtts-JARVIS-voice-clone` | XTTS fine-tune | Good | Web UI / Docker / headless CLI |
| `ronangrant/rvc_jarvis` | RVC | Unknown (no card) | RVC inference pipeline |
| `iceTea911/JARVIS_voice_finetuned_orpheus_16bit` | 3B LM (Orpheus) | Speech-like | Transformers / vLLM |
| `suyashkrishangarg/Jarvis_Voice_1000e` | Unknown fine-tune | Unknown | Check model card |

**Start here**: `DominicSchwantes/Xtts-JARVIS-voice-clone` — ready to use XTTS-based JARVIS clone.

---

## Method 1 — XTTS v2 zero-shot clone (FREE, best free option)

**What**: Coqui XTTS v2 — zero-shot voice clone from 6+ seconds of reference audio.  
**Cost**: Free (Apache 2.0 model, runs locally)  
**RAM**: ~4–6 GB (CPU), ~2 GB (GPU)  
**CPU speed**: ~5–15s per sentence on modern CPU — viable for non-real-time, too slow for streaming  
**Streaming**: Not real-time on CPU — pre-generate then stream chunks  

```python
pip install TTS
```
```python
from TTS.api import TTS
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2")
tts.tts_to_file(
    text="Good morning, Sir. All systems are operational.",
    speaker_wav="jarvis_reference.wav",  # 6+ seconds clean JARVIS audio
    language="en",
    file_path="output.wav"
)
```

**OR use the pre-trained model directly:**
```bash
git clone https://huggingface.co/DominicSchwantes/Xtts-JARVIS-voice-clone
# Follow repo README for web UI or headless mode
```

---

## Method 2 — RVC (Retrieval-based Voice Conversion) (FREE, real-time capable)

**What**: Converts any TTS output into JARVIS voice in real-time.  
**Cost**: Free  
**Approach**: Run a base TTS (e.g., Kokoro "British male") → pipe through RVC JARVIS model  
**Real-time**: Yes — RVC inference is fast enough for streaming pipeline  

```
Base TTS (Kokoro British male) → PCM audio → RVC JARVIS model → JARVIS-sounding PCM
```

Pre-trained model: `ronangrant/rvc_jarvis` (check files tab for .pth weights)  
Also search: weights.gg for "JARVIS" or "Paul Bettany" — community RVC models  
RVC inference: `rvc-python` pip package or `Applio` web UI  

```python
pip install rvc-python
from rvc_python.infer import infer_file
infer_file(
    input_path="kokoro_output.wav",
    model_path="jarvis_rvc.pth",
    output_path="jarvis_output.wav",
    f0method="rmvpe"
)
```

---

## Method 3 — ElevenLabs Instant Voice Clone ($6/mo)

**What**: Upload 1 min of clean JARVIS audio → instant clone in ElevenLabs  
**Cost**: $6/mo (Starter plan)  
**Quality**: 9/10 — ElevenLabs cloning is state of the art  
**Streaming**: ✅ full streaming PCM support  
**TOS note**: Fictional character voice cloning is a grey area — use for personal/non-commercial  

Steps:
1. Extract clean JARVIS audio (see audio sources below)
2. ElevenLabs → Voices → Add Voice → Instant Clone
3. Upload 1+ min of clean dialogue (no music/SFX)
4. Get new voice ID → update `.env`: `ELEVENLABS_VOICE_ID=<new-id>`

---

## Method 4 — ElevenLabs Professional Voice Clone ($22/mo)

**What**: Highest quality clone — used by professional studios  
**Cost**: $22/mo Creator tier (includes 1 Pro Voice Clone)  
**Quality**: 10/10 — indistinguishable from source  
**Minimum audio**: 30 min recommended, 10 min minimum  
**Streaming**: ✅  

---

## Method 5 — Fish Audio clone (FREE tier)

**What**: Cloud-based cloning from 15-second clip  
**Cost**: Free personal tier  
**Quality**: Good for short reference audio  
**Steps**: fish.audio → Create Voice → Upload 15s+ clip → Use via API  

---

## Method 6 — Kokoro TTS British voice (FREE, zero latency)

**What**: Local model, no cloning needed — use built-in British male voice as approximation  
**Cost**: Free  
**Quality**: 7/10 JARVIS similarity (not a clone, just similar accent/tone)  
**CPU speed**: Fast (82M params)  

```python
from kokoro import KPipeline
pipeline = KPipeline(lang_code='b')  # 'b' = British English
generator = pipeline("Good morning, Sir.", voice='bm_lewis')  # British male
```

---

## JARVIS Audio Sources (for cloning)

**Best YouTube searches** (use yt-dlp to download):
- "JARVIS all voice lines Iron Man" 
- "JARVIS complete dialogue compilation Marvel"
- "Paul Bettany JARVIS voice Iron Man clean audio"

**Cleanest audio scenes** (least background music/SFX):
- Iron Man 1: lab scenes where Tony is alone working (lab diagnostic conversations)
- Iron Man 2: early Stark Expo scenes
- Iron Man 3: "Malibu" house scenes before the attack

**Extract pipeline:**
```bash
# Install: pip install yt-dlp
yt-dlp -x --audio-format wav --audio-quality 0 "YOUTUBE_URL" -o jarvis_raw.wav

# Clean: mono, 22kHz, normalize
ffmpeg -i jarvis_raw.wav -ac 1 -ar 22050 -af "loudnorm=I=-16:TP=-1.5:LRA=11" jarvis_clean.wav
```

**Minimum needed:**
- XTTS v2: 6 seconds  
- Fish Audio: 15 seconds  
- ElevenLabs Instant: 1 minute  
- ElevenLabs Professional: 10–30 minutes  
- RVC: ideally 10+ minutes of isolated voice  

---

## Recommended pipeline (get closest to real JARVIS for free)

```
1. Download JARVIS compilation from YouTube (yt-dlp)
2. Extract clean segments: ffmpeg silence detection + manual trim
3. Use DominicSchwantes/Xtts-JARVIS-voice-clone (pre-trained, immediate)
   — OR — XTTS v2 zero-shot with your extracted audio
4. For real-time: feed Kokoro British voice through ronangrant/rvc_jarvis RVC model
5. Once satisfied: pay $6/mo ElevenLabs Starter → Instant Clone for production quality
```

**Cheapest path to production-grade JARVIS voice**: $6/mo ElevenLabs Starter + 1 min YouTube audio extraction.
