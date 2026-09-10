# Voice Pipeline Low-Latency Survey — Phase 4 Reference

Jarvis constraints: Azure VM 2vCPU/8GB, **cloud APIs only** (Groq STT, ElevenLabs TTS,
Gemini/Groq LLM), Node.js gateway :8080, Python brain :8001, Phase 4 uses Pipecat.

---

## Repo Analysis

### 1. Ankur2606/Low-latency-AI-Voice-Assistant

**What it does**: Sequential pipeline — fixed 5s sounddevice recording → faster-whisper
(local CPU) → Groq LLM → Edge-TTS or Kokoro-82M (local).

**STT**: `WhisperModel("tiny", device="cpu", compute_type="int8")` — re-initialized per call,
fully local. **Not swappable without full rewrite.** Violates Jarvis no-local-inference rule.

**VAD**: Amplitude threshold only (`np.max(np.abs(audio)) > 0.01`). Fixed 5s recording window —
not true streaming VAD. `webrtcvad` is commented out of requirements.txt, not wired up.

**TTS**: Edge-TTS (cloud, Microsoft Azure, free) or Kokoro-82M (local model). Edge-TTS streams
via `edge_tts.Communicate` and saves to file before playback — not true streaming to speakers.

**LLM**: Groq API `llama-3.1-8b-instant` — cloud ✅. Already matches Jarvis provider.

**Latency**: No measurements in code. Bottlenecks: (a) 5s fixed record window before any
processing starts, (b) model re-init each turn, (c) full TTS file write before playback.
Realistic per-turn latency: 7–12s. Not suitable as-is.

**Barge-in**: None.

**Pipecat compatible**: No — monolithic sequential loop, no transport/service abstraction.

**Verdict**: ❌ Use only for reference on Groq LLM wiring and Edge-TTS streaming approach.
The VAD and STT must be replaced for Jarvis.

---

### 2. Lex-au/Vocalis (refs/vocalis)

Full speech-to-speech assistant with barge-in, AI follow-ups, <500ms latency claim.
Works with OpenAI-compatible endpoints → swappable to Groq. Streaming TTS, adaptive buffering.

**STT**: OpenAI-compatible endpoint (can point at Groq Whisper).
**TTS**: Streaming, OpenAI-compatible (can point at ElevenLabs or any streaming TTS).
**LLM**: OpenAI-compatible (Groq works).
**Barge-in**: ✅ Mid-speech interruption supported.
**Pipecat compatible**: Not natively, but transport layer is thin and extractable.

**Verdict**: ✅ Best reference for barge-in implementation and <500ms streaming architecture.
Extract the adaptive buffering + barge-in logic for Jarvis `src/voice/`.

---

### 3. huggingface/speech-to-speech (refs/hf-speech2speech)

Fully modular: VAD → STT → LLM → TTS, every component swappable. Exposes OpenAI Realtime
GA event set over WebSocket and WebRTC.

**STT**: Pluggable — Whisper, Groq, Deepgram etc.
**TTS**: Pluggable — ElevenLabs, Bark, Parler-TTS.
**Transport**: WebSocket + WebRTC with OpenAI Realtime event schema.
**Barge-in**: ✅ VAD-driven.
**Pipecat compatible**: Event schema is compatible with Pipecat's transport layer design.

**Verdict**: ✅ Best reference for WebSocket event protocol and modular service design.
The OpenAI Realtime event schema it uses maps cleanly to Pipecat transports.

---

### 4. leo007-htun/full_duplex_assistant (refs/full_duplex)

Production full-duplex assistant — simultaneous talk+listen, barge-in, streaming ASR+TTS+LLM
with tool calls. Docker Compose deploy (Traefik + Nginx + FastAPI). Web UI with waveforms.

**STT**: Streaming ASR (Deepgram or Whisper).
**TTS**: Streaming (ElevenLabs compatible).
**LLM**: Tool-call capable.
**Barge-in**: ✅ True full-duplex.
**Deploy**: Docker Compose single command — reference for Jarvis containerization.

**Verdict**: ✅ Best reference for true full-duplex architecture and Docker deploy.
Extract the FastAPI streaming handler pattern for Jarvis `src/voice/pipeline.py`.

---

## Awesome-Voice-Agents Highlights (yzfly/awesome-voice-agents)

### Pipecat Integrations
- **pipecat-ai/pipecat** — the core framework Jarvis Phase 4 will use
- **pipecat-ai/smart-turn** — turn detection, 23 languages, free Fal hosting
- **flowcat** — pipecat-compatible SIP/RTP pipeline (useful if phone support added later)

### OpenAI Realtime API
- **openai/openai-realtime-agents** — official multi-agent/handoff samples
- **langchain-ai/react-voice-agent** — ReAct-style tool-using voice agent on Realtime API

### ElevenLabs Streaming TTS
- **elevenlabs/elevenlabs-mcp** — official MCP server (TTS + transcription + voice cloning)
- Jarvis already uses ElevenLabs Bill voice (ID: `pqHfZKP75CvOlQylNhV4`) ✅

### Groq Whisper STT
- Groq serves `whisper-large-v3` and `whisper-large-v3-turbo` on LPUs — ultra-low-latency,
  high-throughput. Already in Jarvis `.env`. ✅

### Sub-300ms Latency Claims
| Model/Service | Latency claim | Type |
|---|---|---|
| Moshi (Kyutai) | ~160ms E2E | Local (not usable for Jarvis) |
| Chatterbox TTS turbo | ~75ms synthesis | Cloud/local |
| Rime TTS Mist v2 | 70–225ms TTFA | Cloud |
| Orpheus TTS | 100–200ms streaming | Cloud |
| SpeechGPT 2.0 | <200ms E2E | Local model |

Groq Whisper + ElevenLabs streaming + Groq LLM is the realistic cloud-only path to <500ms.

---

## Comparison Table

| Repo | Local vs Cloud | Barge-in | Pipecat Compatible | Est. E2E Latency | Jarvis Fit |
|---|---|---|---|---|---|
| **Ankur2606/Low-latency-AI-Voice-Assistant** | Local STT + TTS | ❌ | ❌ | 7–12s | ❌ Groq LLM reference only |
| **Lex-au/Vocalis** | Cloud-ready | ✅ | Partial | <500ms | ✅ Barge-in reference |
| **huggingface/speech-to-speech** | Pluggable | ✅ VAD | ✅ Event schema | 300–500ms | ✅ WebSocket/event protocol |
| **leo007-htun/full_duplex_assistant** | Pluggable | ✅ Full-duplex | ✅ FastAPI pattern | <500ms | ✅ Deploy + streaming handler |

---

## Recommended Architecture for Jarvis Phase 4

```
Browser mic (WebRTC/WS)
  → Node gateway :8080 (raw PCM chunks)
    → src/voice/pipeline.py (Pipecat pipeline)
        ├── VAD: pipecat-ai/smart-turn (cloud, free)
        ├── STT: Groq Whisper-large-v3-turbo (streaming)
        ├── LLM: Groq llama-3.1-8b-instant (already wired)
        └── TTS: ElevenLabs streaming (Bill voice pqHfZKP75CvOlQylNhV4)
  → Node gateway :8080
    → Browser speaker
```

Key patterns to extract:
- **Barge-in**: from Vocalis `interrupt_handler.py`
- **WebSocket event schema**: from hf-speech2speech (OpenAI Realtime events)
- **Streaming FastAPI handler**: from full_duplex_assistant
- **Turn detection**: pipecat-ai/smart-turn (free Fal endpoint, no local model)

Target latency: **300–450ms** E2E on Groq LPUs + ElevenLabs streaming.
