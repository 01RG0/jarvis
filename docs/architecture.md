# Jarvis Architecture

## Philosophy

Three languages, each chosen for exactly one reason:

- **Python** — the AI/agent tooling ecosystem lives here. LangGraph, Pipecat, Mem0, LiteLLM SDK, openWakeWord are all Python-first. Fighting this would cost more than it saves.
- **Go** — the watchdog must survive everything else crashing. A single static binary with near-zero memory footprint and Go's proven reliability for long-running daemons fits perfectly. This is not a performance choice; it's a "stays alive" choice.
- **TypeScript/Node** — the website and gateway share a language with the browser, have the deepest WebSocket/real-time ecosystem, and stay thin. No heavy server-side rendering that would eat into the 8 GB budget.

---

## Component Reference

### 1. Python Brain (`src/brain/`)

**Responsibilities:**
- Task routing: fast-path vs. slow-path decision on every input
- 4-stage orchestration loop (HuggingGPT-inspired): plan → select → execute → verify
- Risk-tier classification before any action
- Retry/fallback strategy on failure (different tool, different model, different approach)
- LiteLLM Router in-process: routes each LLM call to the right provider/model

**Key interfaces:**
- Receives tasks from the Gateway over an internal queue/IPC
- Returns results + status to the Gateway
- Calls Memory layer for context retrieval before planning, stores results after
- Calls CLI Dispatcher to invoke sub-agent CLIs
- Notifies Watchdog of heartbeat / task status

**LangGraph model:**
```
[input] → [route: fast | slow]
               │                 │
           [fast: single     [slow: plan_node]
            LLM call]             │
               │            [select_tool_node]
               │                 │
               └──────────[execute_node]─────────┐
                                 │           [retry_node]
                           [verify_node]         │
                                 │         (different strategy)
                           [output_node]         │
                                 └───────────────┘
                                 (after N failures: escalate)
```

**Fast-path vs. slow-path:**
The brain's first job on any input is a routing decision. Fast-path = single cheap/quick model call, no planning graph, target <500ms. Slow-path = full graph traversal. The router itself is a lightweight LLM call to a small/fast model (e.g. Groq Llama or Gemini Flash).

### 2. Go Watchdog (`src/watchdog/`)

**Responsibilities:**
- Process supervision: restarts crashed subprocesses (brain, gateway, voice)
- Task heartbeat: each in-flight task emits heartbeats; watchdog escalates stalled tasks
- Resource caps: enforces OS-level limits per spawned task (systemd unit `MemoryMax`, `CPUQuota`, or `ulimit`)
- Health endpoint: exposes `/health` for external monitoring

**Why Go:**
Single static binary (~5–10 MB). Near-zero idle RAM. No runtime dependency. The one process that must still be alive after a Python OOM or Node segfault.

**Concurrency model:**
Go goroutines per watched process. Each goroutine polls `/proc/<pid>/status` or a heartbeat channel. I/O-bound polling — Go's lightweight threads are ideal but this is not a raw-throughput requirement.

**Escalation path:**
`task stalled → watchdog → notify gateway → gateway pushes alert to website + phone`

### 3. Node.js Gateway (`src/gateway/`)

**Responsibilities:**
- Single auth check (JWT, single-user)
- WebSocket session management (browser ↔ gateway ↔ brain/voice)
- Routes: voice stream, text messages, push notification dispatch, health status
- Phone push via ntfy.sh or Pushover (webhook)

**Keep this thin.** No heavy business logic here. Its job is routing, not processing.

**Protocols:**
- Browser → Gateway: WebSocket (voice audio frames + text messages)
- Gateway → Brain: internal HTTP or Unix socket IPC
- Gateway → Phone: outbound HTTP webhook (ntfy/Pushover)

### 4. Next.js Website (`src/website/`)

**Dashboard surfaces:**
- Live task list + status (running / waiting / blocked / done)
- Provider/API health + current routing decisions + spend so far
- CLI sub-agent activity (what's dispatched where)
- Memory browser (recent facts, searchable)
- Proactive alerts inbox (issue → cause → A/B/C options → your decision)
- Risk-tier log (autonomous vs. asked-permission)

**Voice UI:**
- Animated Iron-Man/HUD-inspired avatar (SVG/Canvas animation, WebGL optional)
- WebSocket audio streaming to gateway → voice pipeline
- Visual feedback: listening / thinking / speaking states
- Wake-word indicator (always-listening mode shows mic hot/cold)

### 5. Voice Pipeline (`src/voice/`)

**Stack:** Pipecat + openWakeWord

**Flow:**
```
microphone → VAD → openWakeWord → STT (Deepgram/Whisper) → Brain → TTS (ElevenLabs/Cartesia) → speaker
                        │ (wake detected)
                        └──────────────────────────────────────────────────────────────────────────────────┘
```

**Modes (configurable toggle):**
- Always-listening with wake word ("Hey Jarvis" → openWakeWord detects → activates STT)
- Push-to-talk (browser button held → STT active)
- Always-on session (no wake word, STT always active)

**Streaming:** Pipecat handles streaming STT→LLM→TTS — not turn-based batch. Audio starts playing before the LLM finishes generating. Target: <300ms first-audio latency from end of user speech.

**Resource model:** Voice pipeline is on-demand. It spins up when a voice session starts and exits when idle. Not always-on. Peak RAM estimate: ~150–300 MB for Pipecat + provider client libraries.

### 6. Memory Layer (`src/memory/`)

**Stack:** Mem0 + sqlite-vec

**What gets stored:**
- `vector`: conversation excerpts, facts, summaries — for semantic similarity retrieval
- `structured` (SQLite tables): user preferences, project state, task outcomes, postmortems

**Retrieval at query time:**
Before each planning step, the brain does a semantic search against the vector store (top-K relevant memories) and a structured lookup (e.g. "what did we try last time this tool failed?"). Both results are injected into the planning context.

**Write path:**
After each completed task or conversation turn, the brain writes a memory entry. For failures, it writes a structured postmortem (`what_failed`, `what_fixed_it`) for the learning loop (Phase 7).

**Why sqlite-vec instead of Qdrant:**
sqlite-vec is a single SQLite extension — one `.db` file, zero always-on service overhead. Qdrant is a separate server process that wants persistent RAM. At 8 GB, every always-on process is a budget item.

**Upgrade path:** swap sqlite-vec for Qdrant (or Letta for OS-inspired memory paging) once recall quality actually demands it.

### 7. AI Gateway / LiteLLM (`src/brain/llm_router.py`)

**Not a separate service** — runs as a `litellm.Router` instance inside the Python brain process. No extra Docker container, no extra RAM budget.

**Provider configuration:**
```python
router = litellm.Router(model_list=[
    {"model_name": "fast", "litellm_params": {"model": "groq/llama3-8b-8192"}},
    {"model_name": "smart", "litellm_params": {"model": "anthropic/claude-opus-5"}},
    {"model_name": "balanced", "litellm_params": {"model": "anthropic/claude-sonnet-5"}},
    {"model_name": "vision", "litellm_params": {"model": "openai/gpt-4o"}},
])
```

**Routing logic:**
- Fast-path router call → `fast` model
- Planning / complex reasoning → `smart` model
- Default tasks → `balanced` model
- Fallback chain per model: `smart` → `balanced` → `fast` if providers are unavailable

**Cost tracking:** LiteLLM tracks token usage and cost per call in its callback system. Logged to SQLite, surfaced in dashboard.

**Proxy mode (future):** If the admin UI / virtual keys / separate-service cost tracking become important, switch to `hwdsl2/docker-litellm` — auto-generates a master key, Docker image, Postgres-backed. Not for v1.

### 8. CLI Sub-Agent Dispatcher (`src/dispatcher/`)

**Responsibilities:**
- Risk-tier gate: checks tier before dispatch (Tier 2 → confirm first)
- Invokes installed CLIs non-interactively with a self-contained prompt
- Captures stdout/stderr, parses structured output
- Timeout enforcement (default 5 min per sub-agent call)
- Logs every dispatch event

**CLI invocation patterns:**
```bash
# Claude Code (Codex CLI)
codex exec --skip-git-repo-check -s workspace-write "prompt"

# agy (Claude / Anthropic CLI)
agy --dangerously-skip-permissions --print "prompt"

# kilo
kilo run "prompt" --dir /workspace

# freebuff (if available on platform)
freebuff run "prompt"
```

**Structured output:** Dispatcher passes a JSON schema to the sub-agent CLI and parses the response. Falls back to free-text if the CLI doesn't support schemas.

---

## Deployment Topology

| Component | Where | Always-on? | RAM budget |
|-----------|-------|-----------|-----------|
| Go Watchdog | Azure VM | Yes (systemd) | ~5 MB |
| Node Gateway | Azure VM | Yes (systemd) | ~50–80 MB |
| Python Brain | Azure VM | No — triggered by task | ~200–400 MB peak |
| Next.js Website | Azure VM | Yes (static + slim API) | ~50 MB |
| Voice Pipeline | Azure VM | No — per session | ~150–300 MB |
| Memory (SQLite) | Azure VM | n/a (file) | ~10–50 MB |
| PC Worker | Home PC | When PC is on | burst |

**Azure VM idle budget:** Watchdog (~5 MB) + Gateway (~80 MB) + Website (~50 MB) + SQLite (embedded) ≈ **~135–200 MB always-on.** Leaves >7.5 GB headroom for on-demand components.

---

## Inter-Component Communication

```
Browser ──WebSocket──► Gateway ──IPC/HTTP──► Brain
                                       └──► Voice Pipeline (WebSocket audio)
Gateway ──────────────────────────────────► Push (ntfy/Pushover)
Brain ─────────────────────────────────────► Memory (direct Python call)
Brain ─────────────────────────────────────► LiteLLM Router (in-process)
Brain ─────────────────────────────────────► CLI Dispatcher (subprocess)
Watchdog ◄─────────────────────────────────► Brain (heartbeat over TCP/Unix socket)
Watchdog ◄─────────────────────────────────► Gateway (health endpoint polling)
```

---

## Failure Handling Flow

```
Task fails
    │
    ▼
Brain: is this a transient error? (timeout, rate-limit, network)
    │ Yes → retry same strategy, different provider (LiteLLM fallback)
    │ No  → try different tool/approach entirely
    │
    ▼ (after N attempts, still failing)
Escalate:
    1. Diagnose root cause (brief LLM call)
    2. Generate 2-3 fix options
    3. Recommend one
    4. Push to Gateway → Website alert + phone notification
    5. Log postmortem to memory (structured table)
    6. Wait for user response
```

---

## Upgrade Paths

| Current | Trigger to upgrade | Upgrade to |
|---------|--------------------|-----------|
| sqlite-vec | Recall quality degrades, search too slow | Qdrant (local) or hosted |
| Mem0 | Need OS-style memory paging or relationship graph | Letta (MemGPT) or Graphiti |
| LiteLLM SDK mode | Want admin dashboard + virtual keys + spend UI | LiteLLM proxy (Docker, Postgres) |
| LangGraph + Watchdog | Awake loop proves fragile in practice | Temporal (durable execution) |
| Process isolation | Need actual code execution sandboxing | E2B or agent-sandbox |
| Pipecat | Need telephony scale or multi-participant | LiveKit Agents |
