# HuggingFace speech-to-speech — Jarvis Phase 4 Research

Repo: https://github.com/huggingface/speech-to-speech  
Cloned to: `refs/hf-speech2speech/`  
Version analyzed: v1.0.0

---

## Architecture Overview

Fully modular thread-per-stage pipeline with typed `PipelineMessage` queue messages between stages:

```
Browser/client (PCM16, base64 WebSocket or WebRTC media track)
  → AudioHandler (decode + resample to 16kHz, 512-sample chunks)
  → VADHandler (Silero VAD, emit VADAudio messages)
  → STTHandler (OpenAI-compatible POST /v1/audio/transcriptions)
  → LLMHandler (chat completions, streaming)
  → LMOutputProcessor (sentence splitting for TTS coalescing)
  → TTSHandler (OpenAI-compatible POST /v1/audio/speech, streaming PCM)
  → AudioOutput queue → encode + emit response.output_audio.delta events
```

Each stage is a `BaseHandler` subclass with a `process()` method that yields output messages. Stages run in their own threads; inter-stage communication is via `Queue[PipelineMessage]`.

---

## 1. OpenAI Realtime GA Event Schema (WebSocket)

Implements the full OpenAI Realtime GA protocol. Relevant client→server events:

| Event type | Payload key fields |
|---|---|
| `input_audio_buffer.append` | `audio`: base64 PCM16 |
| `input_audio_buffer.commit` | (empty) |
| `session.update` | `session`: VAD threshold, silence_duration_ms, voice, turn_detection |
| `response.create` | `response`: instructions, voice, tools |

Server→client events produced:

| Event type | When |
|---|---|
| `session.created` | On connect |
| `session.updated` | After session.update |
| `input_audio_buffer.speech_started` | VAD triggers, carries `audio_start_ms` + `item_id` |
| `input_audio_buffer.speech_stopped` | VAD end, carries `audio_end_ms` + `item_id` |
| `conversation.item.input_audio_transcription.delta` | Progressive STT partial |
| `conversation.item.input_audio_transcription.completed` | Final STT result |
| `response.created` | First TTS audio chunk |
| `response.output_audio.delta` | Audio chunk (base64 PCM16) |
| `response.output_audio.done` | TTS stream complete |
| `response.done` | Full response complete |
| `error` | Any pipeline failure |

WebRTC transport also supported — audio on media track, control events on data channel (same event schema).

---

## 2. VAD Module

**Library**: Silero VAD (`torch.hub.load("snakers4/silero-vad:master", "silero_vad")`)  
**Chunk size**: 512 samples at 16kHz (32ms) — matches CHUNK_SAMPLES in audio handler  
**Key config params** (all tunable via `session.update`):

```python
VADHandler.setup(
    thresh=0.6,                         # speech probability threshold
    sample_rate=16000,
    min_silence_ms=64,                  # silence before speech-end fires
    min_speech_ms=384,                  # min active speech to count as utterance
    speech_pad_ms=30,                   # pre/post padding
    smart_turn=True,                    # ML-based turn completion detection
    smart_turn_threshold=0.5,
    smart_turn_max_wait_ms=2000,
    speculative_reopen_ms=800,          # barge-in reopen window
    enable_realtime_transcription=False,# progressive STT while speaking
)
```

**Speech start/end events** (internal pipeline, not wire protocol):
- `SpeechStartedEvent(audio_start_ms, turn_id, turn_revision, reopened)`
- `SpeechStoppedEvent(audio_end_ms, turn_id, turn_revision, duration_s)`

Both flow to `AudioHandler.on_speech_started/stopped()` which produces the wire `input_audio_buffer.speech_started/stopped` events.

**Smart Turn**: A lightweight ML classifier decides if the user finished their sentence. If incomplete, delays response by up to `smart_turn_max_wait_ms` to avoid cutting off mid-sentence.

**⚠️ Silero VAD requires PyTorch** — ~200MB model download. On Jarvis's 8GB VM this is acceptable but needs a one-time `torch.hub` cache.

---

## 3. STT Module — Swapping in Groq Whisper

`OpenAICompatibleSTTHandler` hits any `/v1/audio/transcriptions` endpoint. Groq hosts Whisper at `https://api.groq.com/openai/v1`:

```python
stt_handler.setup(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.environ["GROQ_API_KEY"],
    model="whisper-large-v3-turbo",   # or whisper-large-v3
    language="en",
    response_format="json",
    timeout=30.0,
)
```

The handler:
- Encodes VAD audio to mono PCM16 WAV at 16kHz
- POSTs to `{base_url}/audio/transcriptions` with `multipart/form-data`
- Accepts JSON `{"text": "..."}` or plain text responses
- Cancels in-flight requests when a newer turn arrives (barge-in support)
- Two lanes: `progressive` (cumulative while speaking) + `final` (committed utterance)

**Groq Whisper latency**: ~200-400ms for typical utterances.

---

## 4. LLM Module — Swapping in Groq/Gemini

`ChatCompletionsLanguageModel` hits any OpenAI-compatible `/v1/chat/completions` endpoint:

```python
llm_handler.setup(
    base_url="https://api.groq.com/openai/v1",  # or Gemini-compatible URL
    api_key=os.environ["GROQ_API_KEY"],
    model="llama-3.1-8b-instant",
    stream=True,
)
```

For Gemini via LiteLLM proxy or Gemini's OpenAI-compatible endpoint:
```python
llm_handler.setup(
    base_url="https://generativelanguage.googleapis.com/v1beta/openai",
    api_key=os.environ["GEMINI_API_KEY"],
    model="gemini-1.5-flash",
    stream=True,
)
```

Tool calls are supported — `ChatCompletionToolParam` format, results fed back into the chat loop.

---

## 5. TTS Module — Swapping in ElevenLabs

`OpenAICompatibleTTSHandler` hits any `/v1/audio/speech` endpoint. ElevenLabs exposes an OpenAI-compatible API:

```python
tts_handler.setup(
    should_listen=stop_event,
    base_url="https://api.elevenlabs.io/v1",
    api_key=os.environ["ELEVENLABS_API_KEY"],
    model="eleven_turbo_v2_5",          # low-latency model
    voice="pqHfZKP75CvOlQylNhV4",       # Bill voice (MCU Jarvis)
    response_format="pcm",              # raw PCM for minimal decode overhead
    sample_rate=24000,                  # ElevenLabs native rate; handler resamples to 16kHz pipeline
    blocksize=512,
)
```

The handler streams PCM chunks, resamples to pipeline rate (16kHz) using an FIR filter, and yields `np.ndarray` blocks to the audio output queue. Barge-in cancellation is handled: when VAD fires `speech_started` mid-response, the TTS operation is cancelled via `CancelScope`.

**ElevenLabs streaming latency**: ~150-300ms time to first audio chunk with `eleven_turbo_v2_5`.

---

## 6. Pipeline Orchestration & Backpressure

```
s2s_pipeline.py → PipelineUnit (per connection) → thread per handler
```

- Each handler runs `while not stop_event.is_set(): process(queue_in.get())`
- `Queue[PipelineMessage]` with bounded maxsize provides backpressure (TTS output queue maxsize=2)
- Barge-in: `VADHandler` emits `SpeechStartedEvent` → `AudioHandler.on_speech_started()` calls `response.finish_response(conn_id, status="cancelled")` + cancels active TTS operation
- `SpeculativeTurnTracker` tracks turn_id + revision; older revisions are cancelled before new work starts
- Session end: all handlers call `on_session_end()` in reverse pipeline order, clearing queues

---

## 7. Latency Breakdown

From code instrumentation (`_log_first_audio_latency`):

```
User stops speaking
→ VAD fires speech_stopped:       ~32-64ms (1-2 Silero chunks at 32ms each)
→ STT request (Groq Whisper):     ~200-400ms
→ LLM first token (Groq):         ~100-300ms (llama-3.1-8b-instant ~120ms TTFT)
→ LM sentence split:              ~5ms
→ TTS first chunk (ElevenLabs):   ~150-300ms
                                  ─────────────
Total (speech→audio out):         ~500-1100ms
```

With `enable_realtime_transcription=True`, STT runs progressively while user speaks, so STT latency overlaps with speaking time — effectively eliminating STT from the critical path for normal-length utterances.

---

## Jarvis Phase 4 Integration Plan

This repo is the **best fit** for Jarvis Phase 4. All three cloud providers needed are drop-in via config:

1. **VAD**: Silero (runs locally, ~50MB model, no cloud cost)
2. **STT**: `OpenAICompatibleSTTHandler` → Groq `/v1/audio/transcriptions`
3. **LLM**: `ChatCompletionsLanguageModel` → Groq or Gemini
4. **TTS**: `OpenAICompatibleTTSHandler` → ElevenLabs (Bill voice)

The OpenAI Realtime GA WebSocket schema means the **existing Node.js gateway** can connect directly as a client without protocol changes — it speaks the same events it would send to OpenAI Realtime.

**Installation note**: Requires `torch` (CPU only is fine for Silero VAD, no GPU needed).

```bash
pip install "speech-to-speech[openai]" torch --index-url https://download.pytorch.org/whl/cpu
```

CPU torch (~600MB) is the main addition to Jarvis's RAM budget; Silero VAD itself uses ~50MB at runtime.
