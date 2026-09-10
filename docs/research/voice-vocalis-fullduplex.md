# Voice Pipeline Research: Vocalis + full_duplex_assistant

Analyzed for Jarvis Phase 4 (Pipecat voice pipeline). Constraint: **no local inference** — cloud APIs only (Groq STT, ElevenLabs TTS, Gemini/Groq LLM).

---

## 1. Vocalis (Lex-au/Vocalis)

### VAD
- **Not server-side** — VAD is handled in the browser JS frontend before sending audio
- Whisper's built-in `vad_filter=False` is disabled; Vocalis relies on client-side gating
- Config: `VAD_THRESHOLD=0.5`, `VAD_BUFFER_SIZE=30`, `AUDIO_SAMPLE_RATE=48000`
- **For Jarvis**: use Pipecat's built-in SileroVAD (server-side, no local model weight needed in inference sense — it's tiny ~1MB)

### Barge-in / Interruption
**Reusable pattern** — `asyncio.Event` on the WebSocket manager:
```python
self.interrupt_playback = asyncio.Event()

# When new audio arrives while TTS is playing:
if self.tts_client.is_processing:
    self.interrupt_playback.set()
    if self.current_audio_task and not self.current_audio_task.done():
        await self.current_audio_task  # wait for clean cancel

# During TTS send — check before each chunk:
if self.interrupt_playback.is_set():
    return  # abort TTS

# Client can also send {"type": "interrupt"} → sets the event immediately
```

### STT
- Uses `faster-whisper` locally — **NOT reusable** for Jarvis (local inference)
- Batch (not streaming): receives WAV, calls `model.transcribe()`, returns full text
- Replace with: **Groq STT** (`whisper-large-v3-turbo`) via Pipecat's `GroqSTTService`

### LLM Integration
- `llm_client.get_response(transcript, system_prompt)` — synchronous, blocks
- TTS starts only AFTER full LLM response — adds latency
- **For Jarvis**: Pipecat pipelines LLM token streaming → TTS starts on first sentence boundary

### TTS Streaming
- Calls local OpenAI-compatible endpoint (`/v1/audio/speech`) — batch request, whole file returned
- Encodes as base64, sends as single `tts_chunk` WS message
- `chunk_size = 4096` bytes used for fake-chunked streaming fallback
- **For Jarvis**: replace with ElevenLabs streaming (`pqHfZKP75CvOlQylNhV4` Bill voice) via Pipecat's `ElevenLabsTTSService`

### WebSocket Message Schema — **REUSE THIS**
```python
# Message types (all have "type" + "timestamp" fields):
"audio"               # client → server: {"type":"audio","audio_data":"<b64>"}
"transcription"       # server → client: {"type":"transcription","text":"...","metadata":{}}
"llm_response"        # server → client: {"type":"llm_response","text":"...","metadata":{}}
"tts_start"           # server → client: signals TTS about to begin
"tts_chunk"           # server → client: {"type":"tts_chunk","audio_chunk":"<b64>","format":"wav"}
"tts_end"             # server → client: TTS complete
"status"              # server → client: {"type":"status","status":"transcribing|processing_llm|...","data":{}}
"error"               # server → client: {"type":"error","error":"...","details":{}}
"interrupt"           # client → server: stop current TTS
"greeting"            # client → server: trigger greeting on mic open
"silent_followup"     # client → server: {"type":"silent_followup","tier":0|1|2}
```

---

## 2. full_duplex_assistant (leo007-htun)

### VAD
- Uses **OpenAI Realtime API server_vad** — cloud-side VAD, no local processing
- Config (directly reusable as reference):
```python
"turn_detection": {
    "type": "server_vad",
    "threshold": 0.5,
    "prefix_padding_ms": 300,
    "silence_duration_ms": 500
}
```
- **For Jarvis**: Pipecat SileroVAD with same threshold/timing defaults

### Barge-in / Interruption
**Best pattern** — OpenAI Realtime fires `input_audio_buffer.speech_started` event:
```python
if etype == "input_audio_buffer.speech_started":
    tts_player.stop()  # immediately clears queue + sets stop flag
```
`StreamingTTSPlayer.stop()`:
```python
def stop(self):
    self._stop_flag.set()
    self._queue.put(None)   # unblocks consumer thread
    sd.stop()               # stops sounddevice playback
```
**For Jarvis**: Pipecat handles barge-in natively via its `VADAnalyzer` + `InterruptiblePipelinePart`.

### STT
- OpenAI Realtime streaming transcription — **NOT reusable** (requires OpenAI key, paid)
- Streaming deltas via `conversation.item.input_audio_transcription.delta` events
- Replace with: **Groq Whisper** (`whisper-large-v3-turbo`, <300ms latency for short utterances)

### LLM Integration
```python
# Non-streaming gpt-4o-mini call, fires TTS as asyncio.create_task after full response:
reply = await ask_gpt(user_text)
asyncio.create_task(speak_tts_streaming(reply))
```
- Conversation history trimmed to last 40 messages to bound memory
- **For Jarvis**: already handled by brain planner; Phase 4 hooks Pipecat into brain's `/chat` endpoint

### TTS Streaming — **StreamingTTSPlayer pattern reusable**
```python
class StreamingTTSPlayer:
    # queue + threading.Event stop_flag + sounddevice output
    # plays PCM at 24kHz, float32
    # stop() clears queue, sets flag, calls sd.stop()
    async def play_pcm_stream(self, response):
        async for chunk in response.iter_bytes():
            if self._stop_flag.is_set(): break
            self._queue.put(chunk)
```
**For Jarvis**: adapt for browser delivery — instead of sounddevice, send PCM chunks over WebSocket. ElevenLabs streaming endpoint returns PCM if `output_format=pcm_24000`.

### Transport Layer
- Uses `websockets` lib directly + `pyaudio` for local mic capture (not browser)
- **For Jarvis**: browser sends raw PCM over WebSocket → Pipecat WebSocket transport receives it

### Docker / Deployment
```yaml
# Pattern: FastAPI on :8000 behind Traefik (TLS termination + WS upgrade)
# idleTimeout=0 on Traefik entrypoints — critical for persistent WS connections
- --entryPoints.websecure.transport.respondingTimeouts.idleTimeout=0
- --serversTransport.forwardingTimeouts.idleConnTimeout=0
```
Healthcheck: `curl -fsS http://127.0.0.1:8000/healthz`
Monitoring: Prometheus + Grafana with voice-specific dashboard.

---

## Decision for Jarvis Phase 4

**Recommended stack** (all cloud APIs, fits 8GB RAM):

| Component | Solution | Source |
|-----------|----------|--------|
| Transport | Pipecat WebSocket transport | Pipecat built-in |
| VAD | Pipecat SileroVAD (threshold=0.5, prefix_pad=300ms, silence=500ms) | full_duplex defaults |
| STT | Groq `whisper-large-v3-turbo` via `GroqSTTService` | replaces local whisper |
| Barge-in | `asyncio.Event` interrupt + Pipecat `VADAnalyzer` | Vocalis pattern |
| LLM | Brain's `/chat` endpoint (Groq/Gemini via LiteLLM) | existing brain |
| TTS | ElevenLabs Bill voice (`pqHfZKP75CvOlQylNhV4`) via `ElevenLabsTTSService` | existing config |
| WS schema | Vocalis message type set | Vocalis |
| Deployment | Traefik idleTimeout=0 trick for persistent WS | full_duplex |

**What NOT to take from these repos:**
- `faster-whisper` — local model, violates no-local-inference constraint
- OpenAI Realtime API — requires OpenAI key (not available)
- `sounddevice` / `pyaudio` — server-side audio output, not needed (browser plays audio)
- Vision service (SmolVLM) — local model

**Estimated latency budget with this stack:**
- VAD detection: ~50ms (SileroVAD server-side)
- Groq STT: ~200-300ms (`whisper-large-v3-turbo`)
- LLM first token: ~300-500ms (Groq llama-3.1-8b-instant)
- ElevenLabs first chunk: ~200-400ms (streaming)
- **Total to first audio**: ~750ms-1250ms — within Vocalis's <1.5s target
