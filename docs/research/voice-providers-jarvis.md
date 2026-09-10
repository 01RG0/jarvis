# JARVIS Voice — All Provider Options & Comparison

## Cloud TTS Providers

### ElevenLabs (current default)
- **JARVIS voice**: No pre-built. Clone from audio or use Daniel (`onwK4e9ZLuTAKqWW03F9`)
- **Cloning**: Instant (Starter $6/mo) or Professional ($22/mo plan + $99 one-time)
- **Streaming**: ✅ PCM chunks, ~80ms first chunk
- **Cost**: ~$6–22/mo for personal use
- **Best voice**: Professional Clone of Paul Bettany audio = 10/10

### Cartesia AI (Sonic)
- **JARVIS voice**: No pre-built; instant voice clone from Pro ($5/mo)
- **Streaming**: ✅ ultra-low latency — claims sub-100ms
- **Cost**: Free tier 20K credits/mo; Pro $5/mo (100K credits); $0.06/min for voice agents
- **Cloning**: Instant from Pro, Professional from Startup ($49/mo)
- **Note**: Best streaming latency of any cloud provider tested

### OpenAI TTS
- **JARVIS voice**: `onyx` — deep, authoritative, slight American accent. Grade: 6/10
- **Streaming**: ✅ chunked streaming via API
- **Cost**: ~$15 per 1M chars (tts-1), ~$30 per 1M chars (tts-1-hd)
- **No cloning**: fixed voices only

### Google Cloud TTS / Gemini
- **JARVIS voice**: WaveNet `en-GB-Wavenet-D` or `en-GB-Wavenet-B` — British male, professional
- **Streaming**: ✅
- **Cost**: Free tier 1M chars/mo (Standard), 4M chars WaveNet free then $16/1M
- **Quality**: 7/10 — sounds professional but robotic compared to ElevenLabs

### Resemble.ai
- **Cloning**: Yes — instant + professional. 5 min audio for decent clone
- **Streaming**: ✅ real-time API
- **Cost**: $0.006/sec generated; free tier 10K credits

### Play.ht
- **Cloning**: Yes — instant clone from 30 seconds of audio
- **Streaming**: ✅ WebSocket streaming
- **Cost**: Creator $31.2/mo (unlimited generation); Ultra-realistic voices
- **Note**: DNS currently unreachable from this environment

## Audio Extraction Pipeline (for voice cloning)

Extract clean Paul Bettany JARVIS audio from Iron Man films:

```bash
# Step 1: Download YouTube clip (use a clean JARVIS dialogue scene)
yt-dlp -x --audio-format wav \
  --postprocessor-args "-ar 22050 -ac 1" \
  -o "jarvis_raw.%(ext)s" \
  "https://www.youtube.com/watch?v=<clip_id>"

# Step 2: Separate vocals from music/SFX using Demucs
pip install demucs
python -m demucs --two-stems=vocals --mp3 jarvis_raw.wav
# Clean vocals: htdemucs/jarvis_raw/vocals.mp3

# Step 3: Remove silence and normalize
pip install pydub
python -c "
from pydub import AudioSegment, silence
audio = AudioSegment.from_file('htdemucs/jarvis_raw/vocals.mp3')
chunks = silence.split_on_silence(audio, min_silence_len=500, silence_thresh=-40)
combined = sum(chunks)
combined.export('jarvis_clean.mp3', format='mp3', parameters=['-ar','22050'])
"

# Step 4: Upload jarvis_clean.mp3 to ElevenLabs / Cartesia / Resemble for cloning
```

**Best YouTube sources for clean JARVIS audio:**
- Iron Man (2008) lab scenes — Stark's workshop, minimal background noise
- Avoid: battle scenes, scenes with music score
- Search: "JARVIS Iron Man all dialogue compilation" — aggregated clean audio

**Pre-packaged datasets**: Search "JARVIS RVC dataset" on:
- weights.gg
- civitai.com/models (filter: voices)
- huggingface.co/datasets (search "jarvis voice")

## Final Comparison Table — All Options Ranked

| Option | Cost | JARVIS Quality | Streaming Latency | Cloning | Recommended |
|--------|------|---------------|-------------------|---------|------------|
| **ElevenLabs Pro Clone** | $22/mo + $99 | ⭐⭐⭐⭐⭐ 10/10 | ~80ms | ✅ from audio | Best overall |
| **ElevenLabs Instant Clone** | $6/mo | ⭐⭐⭐⭐ 8/10 | ~80ms | ✅ from audio | Best value |
| **Orpheus 3B JARVIS (HF)** | Free | ⭐⭐⭐⭐⭐ 9/10 | GPU: 200ms | Built-in | Best free (GPU) |
| **Cartesia + Instant Clone** | $5/mo | ⭐⭐⭐⭐ 8/10 | ~60ms | ✅ | Best latency |
| **XTTS v2 JARVIS clone** | Free | ⭐⭐⭐⭐ 7/10 | ~500ms CPU | ✅ from audio | Best free (CPU) |
| **Kokoro bm_george + RVC** | Free | ⭐⭐⭐⭐ 7/10 | ~300ms CPU | Via RVC | Good free pipeline |
| **ElevenLabs Daniel** | Free tier | ⭐⭐⭐ 7/10 | ~80ms | ❌ fixed | Best zero-cost |
| **Google WaveNet en-GB-D** | Free 4M/mo | ⭐⭐⭐ 6/10 | ~100ms | ❌ fixed | Free cloud backup |
| **OpenAI onyx** | Pay/use | ⭐⭐ 6/10 | ~100ms | ❌ fixed | Fallback |
| **Piper en_GB + RVC** | Free | ⭐⭐⭐ 6/10 | <100ms CPU | Via RVC | Fastest local |

## Recommended Multi-Path Strategy for Jarvis

Configure in order of priority, fall back automatically:

```bash
# .env
JARVIS_TTS_PROVIDER=elevenlabs          # Primary: best quality
ELEVENLABS_VOICE_ID=<your_clone_id>     # Use IVC clone; fallback Daniel onwK4e9ZLuTAKqWW03F9

# Free local fallback (no internet needed)
JARVIS_TTS_FALLBACK=kokoro
JARVIS_TTS_FALLBACK_VOICE=bm_george

# If you have a GPU: 
JARVIS_TTS_PROVIDER=orpheus             # iceTea911/JARVIS_voice_finetuned_orpheus_16bit
```

Pipeline checks provider order: elevenlabs → cartesia → kokoro/piper (local fallback).
