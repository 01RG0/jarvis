# Research: Pipecat

**Verdict: Use it for Phase 4 (voice pipeline). Cloud-API-first, Python-native, composable.**

## What it is

Pipecat is a Python framework for building real-time voice and multimodal AI pipelines.
A pipeline is a sequence of stages (frames flowing through processors):

```
AudioInput → VAD → STT → LLM → TTS → AudioOutput
```

Each stage is a "processor" that transforms frames. Pipecat handles the async orchestration,
buffering, and WebSocket streaming between stages. All STT, LLM, and TTS are cloud API calls —
no local model weights.

## Key Providers

| Role | Options |
|------|---------|
| STT | Deepgram (streaming, low-latency), OpenAI Whisper API, AssemblyAI |
| TTS | ElevenLabs (highest quality), Cartesia (fast streaming), OpenAI TTS |
| LLM | Any via OpenAI-compatible API — use LiteLLM as the adapter |
| VAD | Silero VAD (included), WebRTC VAD |

## Basic Pipeline

```python
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.transports.network.websocket_server import WebsocketServerTransport
from pipecat.services.deepgram import DeepgramSTTService
from pipecat.services.openai import OpenAILLMService
from pipecat.services.elevenlabs import ElevenLabsTTSService
from pipecat.processors.aggregators.openai_llm_context import OpenAILLMContext

transport = WebsocketServerTransport(host="0.0.0.0", port=8765, params=WebsocketServerParams(audio_out_enabled=True))

stt = DeepgramSTTService(api_key=os.environ["DEEPGRAM_API_KEY"])
tts = ElevenLabsTTSService(api_key=os.environ["ELEVENLABS_API_KEY"], voice_id=os.environ["ELEVENLABS_VOICE_ID"])
llm = OpenAILLMService(api_key=os.environ["ANTHROPIC_API_KEY"], base_url="https://api.anthropic.com/v1", model="claude-haiku-4-5-20251001")

context = OpenAILLMContext(messages=[{"role": "system", "content": "You are Jarvis."}])
context_aggregator = llm.create_context_aggregator(context)

pipeline = Pipeline([
    transport.input(),
    stt,
    context_aggregator.user(),
    llm,
    tts,
    transport.output(),
    context_aggregator.assistant(),
])

runner = PipelineRunner()
await runner.run(pipeline)
```

## Wake Word Integration

openWakeWord runs in a separate thread, monitoring the raw audio stream. When it detects the
wake word, it signals the voice pipeline to start a new session:

```python
import openwakeword
from openwakeword.model import Model

oww_model = Model(wakeword_models=["hey_jarvis"], inference_framework="onnx")

def audio_callback(audio_chunk):
    prediction = oww_model.predict(audio_chunk)
    if prediction["hey_jarvis"] > 0.7:
        start_pipecat_session()
```

## Latency Targets

- VAD end-of-speech detection: ~100–200ms (Silero VAD)
- Deepgram streaming STT: ~200–400ms to first transcript word
- LLM first token: ~300–800ms (depends on model/provider)
- ElevenLabs streaming TTS: starts playing after ~200ms
- **Target first-audio latency:** ~800ms–1.5s from end of user speech

## Connecting to the Node Gateway

The Pipecat WebSocket server (`port 8765`) should only be reachable from the Node gateway
(not directly from the browser). The browser talks to the Node gateway over WebSocket; the
gateway proxies audio frames to Pipecat's WebSocket.

```
Browser ──WS:8080──► Node Gateway ──WS:8765──► Pipecat
```

## Gotchas

- Pipecat's API changes frequently (v0.x) — pin the version and check changelogs before upgrading
- ElevenLabs streaming TTS requires a websocket connection (not the REST API) — use `pipecat.services.elevenlabs.ElevenLabsTTSService` which handles this
- VAD is critical for turn-taking — without it, the pipeline will stream audio continuously and the LLM will receive partial utterances

## Resources

- Docs: https://docs.pipecat.ai
- GitHub: https://github.com/pipecat-ai/pipecat
- Examples: `pipecat/examples/` in the repo — start with `foundational/01-say-one-thing.py`
