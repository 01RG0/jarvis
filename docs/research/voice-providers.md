# Research: Voice Providers (STT + TTS)

**Goal: Sound like Jarvis (MCU). Full-duplex, low-latency, multi-provider config so you can swap easily.**

---

## TTS — Sounding Like Jarvis

The MCU Jarvis (Paul Bettany) has a specific quality: calm, measured, slightly formal British
RP, warm but not emotional, authoritative without being cold.

### Recommended: ElevenLabs

ElevenLabs is the best option for hitting that Jarvis quality with an existing voice library.

**Best voice options to try:**
| Voice Name | Voice ID | Character |
|-----------|---------|-----------|
| **Bill** | `pqHfZKP75CvOlQylNhV4` | Deep, calm, British-adjacent — closest to MCU Jarvis |
| **Antoni** | `ErXwobaYiN019PkySvjV` | Warm, measured, slight UK accent |
| **George** | `JBFqnCBsd6RMkjVDRZzb` | Very calm, authoritative |
| **Daniel** | `onwK4e9ZLuTAKqWW03F9` | British, formal — great Jarvis feel |

Free tier: 10,000 characters/month. Very enough for personal use at typical conversation length.

```python
# In src/voice/config.py
TTS_CONFIG = {
    "provider": "elevenlabs",
    "voice_id": os.environ.get("ELEVENLABS_VOICE_ID", "pqHfZKP75CvOlQylNhV4"),
    "model": "eleven_turbo_v2",   # lowest latency model
    "stability": 0.5,             # lower = more expressive
    "similarity_boost": 0.75,
    "style": 0.0,                 # keep at 0 for consistency
    "use_speaker_boost": True,
}
```

**Custom Jarvis voice (advanced):** ElevenLabs lets you clone or fine-tune a voice with 1–30
minutes of audio. You could record yourself doing a Jarvis impression or use royalty-free
Jarvis audio clips. Requires a paid plan.

### Alternative: Cartesia

Faster streaming (lower time-to-first-audio), cheaper at scale. Voice quality is slightly
below ElevenLabs. Good backup if ElevenLabs quota runs out.

### Alternative: OpenAI TTS

`onyx` model voice is the deepest/most authoritative of OpenAI's options. Not as natural as
ElevenLabs but no extra account needed if you have an OpenAI key.

---

## STT — Streaming Speech Recognition

### Recommended: Deepgram

- Fastest streaming latency (~200ms to first word)
- Free tier: **200 hours/month** — effectively unlimited for personal use
- `nova-2` model: best accuracy, same price as nova-1
- Handles accents well, strong on technical vocabulary

```python
STT_CONFIG = {
    "provider": "deepgram",
    "model": "nova-2",
    "language": "en-US",
    "smart_format": True,   # adds punctuation, capitalizes proper nouns
    "vad_events": True,     # endpoint detection built-in
}
```

### Alternative: OpenAI Whisper API

Higher accuracy than Deepgram on noisy audio or heavy accents. But it's a batch API (not
streaming) — higher latency (~1–3s to full transcript). Good fallback if Deepgram quota runs
out.

### Alternative: AssemblyAI

Good free tier, supports streaming, competitive accuracy. Worth evaluating if Deepgram's
pricing changes.

---

## Multi-Provider Config Design

The voice pipeline should read provider from `.env` so you can swap without code changes:

```python
# src/voice/stt_factory.py
import os

def get_stt_service():
    provider = os.environ.get("STT_PROVIDER", "deepgram")
    if provider == "deepgram":
        from pipecat.services.deepgram import DeepgramSTTService
        return DeepgramSTTService(api_key=os.environ["DEEPGRAM_API_KEY"])
    elif provider == "whisper_openai":
        from pipecat.services.openai import OpenAISTTService
        return OpenAISTTService(api_key=os.environ["OPENAI_API_KEY"])
    elif provider == "assemblyai":
        from pipecat.services.assemblyai import AssemblyAISTTService
        return AssemblyAISTTService(api_key=os.environ["ASSEMBLYAI_API_KEY"])
    raise ValueError(f"Unknown STT provider: {provider}")

# src/voice/tts_factory.py
def get_tts_service():
    provider = os.environ.get("TTS_PROVIDER", "elevenlabs")
    if provider == "elevenlabs":
        from pipecat.services.elevenlabs import ElevenLabsTTSService
        return ElevenLabsTTSService(
            api_key=os.environ["ELEVENLABS_API_KEY"],
            voice_id=os.environ.get("ELEVENLABS_VOICE_ID", "pqHfZKP75CvOlQylNhV4"),
            model="eleven_turbo_v2",
        )
    elif provider == "cartesia":
        from pipecat.services.cartesia import CartesiaTTSService
        return CartesiaTTSService(
            api_key=os.environ["CARTESIA_API_KEY"],
            voice_id=os.environ["CARTESIA_VOICE_ID"],
        )
    elif provider == "openai":
        from pipecat.services.openai import OpenAITTSService
        return OpenAITTSService(
            api_key=os.environ["OPENAI_API_KEY"],
            voice=os.environ.get("OPENAI_TTS_VOICE", "onyx"),
        )
    raise ValueError(f"Unknown TTS provider: {provider}")
```

---

## APIs to Sign Up For (Priority Order)

| Priority | Service | Why | Free Tier | Signup |
|----------|---------|-----|-----------|--------|
| 1 | **Deepgram** | STT for Phase 4 | 200 hrs/month | deepgram.com |
| 2 | **ElevenLabs** | TTS, Jarvis voice | 10k chars/month | elevenlabs.io |
| 3 | **Groq** | Fast-path LLM, Phase 0 | Generous free tier | console.groq.com |
| 4 | Cartesia | TTS backup | Free trial | cartesia.ai |
| 5 | AssemblyAI | STT backup | 100 hrs free | assemblyai.com |

**For Phase 0 specifically you only need:** Groq key + Gemini key (you have both). Voice APIs
(Deepgram + ElevenLabs) are needed for Phase 4 — not urgent right now.
