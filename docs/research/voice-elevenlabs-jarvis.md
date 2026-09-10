# ElevenLabs — JARVIS Voice Research

## Pre-built voices closest to MCU JARVIS (no cloning needed)

No voice named "JARVIS" or "Paul Bettany" exists in ElevenLabs' premade library. Best matches:

| Voice | ID | Description | JARVIS fit |
|-------|----|-------------|-----------|
| **Daniel** | `onwK4e9ZLuTAKqWW03F9` | "Steady Broadcaster" — British accent, professional broadcast quality | ⭐⭐⭐⭐ Best free match |
| **George** | `JBFqnCBsd6RMkjVDRZzb` | "Warm, Captivating Storyteller" — British, middle-aged male | ⭐⭐⭐ Good |
| **Bill** (current) | `pqHfZKP75CvOlQylNhV4` | Deep, authoritative — configured in Jarvis already | ⭐⭐⭐ Good |
| **Brian** | `nPczCjzI2devNBz1zQrb` | "Deep, Resonant and Comforting" — American but very deep | ⭐⭐ Decent |

**Recommendation**: Try `Daniel` first — British broadcast voice is closest to JARVIS's calm authority.

## Voice Cloning Options

### Instant Voice Clone (IVC)
- **Cost**: Free on Starter ($6/mo) and above
- **Audio needed**: 1–10 minutes of clean speech (more = better)
- **Quality**: Good — captures timbre and accent well, some artefacts at <1 min
- **Steps**:
  1. Go to ElevenLabs → Voices → Add Voice → Instant Voice Clone
  2. Upload MP3/WAV clips of Paul Bettany as JARVIS (see audio sources below)
  3. Name it "JARVIS", add description "MCU JARVIS - Paul Bettany"
  4. Copy the generated voice ID into `.env` as `ELEVENLABS_VOICE_ID`

### Professional Voice Clone (PVC)
- **Cost**: Creator plan ($22/mo) + $99 one-time for the clone submission
- **Audio needed**: 30 minutes+ of clean speech, studio quality preferred
- **Quality**: Near-indistinguishable from original — best possible result
- **Turnaround**: 3–5 business days
- **Steps**: Submit via ElevenLabs → Voices → Professional Voice Clone

## Audio Sources for Paul Bettany JARVIS

Best YouTube sources for clean JARVIS speech (no music/SFX):
- Iron Man (2008) — lab scenes with Tony. JARVIS dialogue is clearest here, minimal background
- Iron Man 2 (2010) — "I need a moment to process that, sir."
- The Avengers (2012) — brief but clean lines in the tower
- Iron Man 3 (2013) — most JARVIS dialogue, some overlapping SFX

**Extraction pipeline**:
```bash
# Download audio from a YouTube clip
yt-dlp -x --audio-format wav "https://youtube.com/watch?v=<clip_id>" -o jarvis_raw.wav

# Isolate voice (remove music/SFX) using Demucs
pip install demucs
python -m demucs --two-stems=vocals jarvis_raw.wav
# Output: htdemucs/jarvis_raw/vocals.wav
```

Pre-extracted clean JARVIS audio packs are shared on various AI voice communities — search "JARVIS RVC dataset" on Weights.gg or CivitAI.

## Pricing for Jarvis Pipeline (Phase 4)

| Plan | Monthly cost | Characters/mo | Streaming |
|------|-------------|---------------|-----------|
| Free | $0 | 10,000 | ✅ |
| Starter | $6 | 30,000 | ✅ |
| Creator | $22 | 121,000 | ✅ + PVC |
| Pro | $99 | 600,000 | ✅ + unlimited PVC |

For a personal always-on assistant: **Starter ($6) is enough** for normal use (~30K chars = ~4 hours of speech/month at avg speaking rate). Creator unlocks Professional Clone.

Model cost: `eleven_turbo_v2_5` = 0.5 credits/char (half the standard rate). Use this for Phase 4.

## Current config in Jarvis
```
ELEVENLABS_VOICE_ID=pqHfZKP75CvOlQylNhV4  # Bill — swap for Daniel or your clone
ELEVENLABS_MODEL=eleven_turbo_v2_5          # lowest latency + half cost
```
