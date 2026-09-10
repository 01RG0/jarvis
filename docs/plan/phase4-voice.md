# Phase 4 — Voice Pipeline

## Decision

**Stack**: Pipecat + SileroVAD + Groq Whisper + ElevenLabs TTS (Bill)  
**Protocol**: OpenAI Realtime GA event schema (gateway already speaks it)  
**Target latency**: 400–800ms speech-to-first-audio  

All providers are cloud-only. No local inference. Fits 8GB budget (~200MB runtime for SileroVAD).

## Architecture

```
Browser mic (PCM16 @ 16kHz via WebRTC/WS)
  ↓  Vocalis typed event schema
Node.js gateway :8080
  ↓  WebSocket relay + auth
Voice pipeline :8050  (Python, Pipecat)
  ├─ SileroVAD  → speech_start / speech_end events
  │   config: threshold=0.5, prefix_pad=300ms, silence=500ms
  ├─ Groq STT   → whisper-large-v3-turbo  (streaming, cancel-on-barge-in)
  ├─ Brain :8001 → LLM (llama-3.1-8b-instant, streaming tokens)
  ├─ ElevenLabs TTS → Bill voice pqHfZKP75CvOlQylNhV4 (PCM chunks)
  └─ asyncio.Event interrupt_playback → barge-in cancels TTS mid-stream
  ↓  PCM16 chunks (Vocalis tts_chunk events)
Browser → plays audio
```

## Borrow from reference repos

| Source | What to take |
|--------|-------------|
| `refs/vocalis/` | WS message schema (typed events: audio/transcription/llm_response/tts_start/tts_chunk/tts_end/status/error/interrupt) |
| `refs/vocalis/` | Barge-in: `asyncio.Event interrupt_playback`, checked before each TTS chunk send; set on new audio arrival |
| `refs/full_duplex/` | StreamingTTSPlayer: queue + stop-flag pattern, adapted to send WS chunks instead of sounddevice |
| `refs/full_duplex/` | Traefik `idleTimeout=0` — required for always-on production WS |
| `docs/research/voice-hf-speech2speech.md` | OpenAI Realtime GA event schema for gateway ↔ pipeline protocol |

## Multi-Provider Architecture

All TTS and STT providers are pluggable. Switch via `JARVIS_TTS_PROVIDER` / `JARVIS_STT_PROVIDER` env vars — no code changes needed to try a different voice.

```
JARVIS_TTS_PROVIDER=elevenlabs   # or: piper | openai | cartesia | kokoro | playht
JARVIS_STT_PROVIDER=groq         # or: deepgram | whisper-local
JARVIS_VOICE_ID=pqHfZKP75CvOlQylNhV4   # ElevenLabs Bill, or piper model path
```

### TTS provider registry (all plugged in, switch anytime)

| Provider | Type | Cost | JARVIS quality | Latency | Streaming |
|----------|------|------|---------------|---------|-----------|
| **Piper** `jgkawell/jarvis` | Local CPU | Free | 7/10 | **0.2s** | Sentence |
| **XTTS v2** `DominicSchwantes/Xtts-JARVIS-voice-clone` | Local CPU | Free | 8/10 | ~1-2s CPU | Chunk |
| **Kokoro** `bm_george` | Local CPU | Free | 6/10 | <50ms | ✅ |
| **Google WaveNet** `en-GB-D` | Cloud | Free 4M/mo | 6/10 | ~200ms | ✅ |
| **ElevenLabs Daniel** `onwK4e9ZLuTAKqWW03F9` | Cloud | $6/mo | 7/10 | ~300ms | ✅ |
| **ElevenLabs Bill** `pqHfZKP75CvOlQylNhV4` | Cloud | $6/mo | 8/10 | ~300ms | ✅ |
| **Cartesia Sonic** | Cloud | $5/mo | TBD | **<60ms** | ✅ |
| **OpenAI onyx** | Cloud | Pay/use | 6/10 | ~300ms | ✅ |
| **ElevenLabs Instant Clone** | Cloud | $6/mo+audio | 7/10 | ~300ms | ✅ |
| **RVC + Kokoro** | Local CPU | Free | 8-9/10 | +300ms | ✅ |
| **ElevenLabs Pro Clone** | Cloud | $22/mo+$99 | **10/10** | ~300ms | ✅ |

**Cascade fallback** (set in .env):
```
JARVIS_TTS_PRIMARY=elevenlabs
JARVIS_TTS_FALLBACK=cartesia
JARVIS_TTS_LOCAL=piper        # always available, no API needed
```

## Files to create

```
src/voice/
  pipeline.py           Pipecat pipeline: VAD → STT → LLM → TTS
  transport.py          WebSocket transport (Pipecat FastAPIWebsocketTransport)
  barge_in.py           asyncio.Event interrupt logic from Vocalis
  tts_player.py         Streaming TTS queue+stop-flag from full_duplex
  ws_schema.py          Typed event dataclasses (Vocalis schema)
  server.py             FastAPI app, mounts /voice WS endpoint on :8050
  providers/
    __init__.py         VoiceTTSProvider ABC + factory(name) → provider
    elevenlabs.py       ElevenLabs streaming (Bill voice, configurable ID)
    piper.py            Piper TTS local (downloads HF JARVIS .onnx on first run)
    openai_tts.py       OpenAI TTS (onyx/fable)
    cartesia.py         Cartesia Sonic streaming
    kokoro.py           Kokoro TTS local CPU
  requirements.txt      pipecat-ai, elevenlabs, groq, silero-vad, torch (CPU), piper-tts
```

## Key implementation details

### SileroVAD config (from full_duplex)
```python
SileroVADAnalyzer(params=VADParams(
    threshold=0.5,
    min_speech_duration_ms=250,
    min_silence_duration_ms=500,
    speech_pad_ms=300,
))
```

### Groq STT (OpenAI-compatible)
```python
GroqSTTService(
    api_key=os.environ["GROQ_API_KEY"],
    model="whisper-large-v3-turbo",
    language="en",
)
```

### ElevenLabs TTS streaming
```python
ElevenLabsTTSService(
    api_key=os.environ["ELEVENLABS_API_KEY"],
    voice_id="pqHfZKP75CvOlQylNhV4",  # Bill
    model="eleven_turbo_v2_5",
    output_format="pcm_16000",
)
```

### Barge-in (from Vocalis)
```python
interrupt_event = asyncio.Event()

async def send_tts_chunks(chunks):
    for chunk in chunks:
        if interrupt_event.is_set():
            interrupt_event.clear()
            break
        await ws.send_bytes(chunk)

# On new audio input arriving:
interrupt_event.set()
```

### Gateway update
Add `/voice` WebSocket route that relays binary audio frames to `:8050` and forwards typed events back to the browser. No protocol change — gateway already speaks OpenAI Realtime GA events.

## Dependencies to add

```
# src/voice/requirements.txt
pipecat-ai[silero,groq,elevenlabs]>=0.0.40
torch  # CPU-only; for SileroVAD
torchaudio
fastapi
uvicorn
websockets
python-dotenv
```

CPU torch install: `pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu`
Runtime footprint: ~200MB (SileroVAD model loaded once).

## Latency budget

| Stage | Target |
|-------|--------|
| VAD speech_end detection | 50–100ms |
| Groq STT (Whisper LPU) | 150–300ms |
| Groq LLM first token | 100–200ms |
| ElevenLabs first chunk | 100–200ms |
| Network + WS relay | 20–50ms |
| **Total to first audio** | **420–850ms** |

## Deployment

- Voice pipeline runs as a 5th always-on process (watchdog supervises it)
- Port `:8050` (internal only, not exposed)
- Gateway gets new env var `VOICE_PIPELINE_URL=ws://localhost:8050/voice`
- Traefik / nginx: set `proxy_read_timeout 3600` and `idleTimeout=0` for persistent WS
