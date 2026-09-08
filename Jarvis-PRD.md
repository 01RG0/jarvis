# Jarvis — Personal AI Operator
## Product Requirements Document (PRD)

**Status:** Draft v0.1 — living document, edit freely
**Owner:** Solo project (no team, no fixed deadline — evolving side project)
**Last updated:** 2026-09-08

> How to use this doc: it's organized so you can hack on any section independently. Anything marked `[DECIDED]` came from our planning conversation. Anything marked `[OPEN]` still needs a call. Anything marked `[RESEARCH]` is a repo/tool worth evaluating before committing.

---

## 1. Vision

A single, persistent, always-on AI "operator" — Jarvis — that:

- Lives primarily on a personal Azure VM, with a home PC as an optional secondary worker when it's powered on.
- Talks to you full-duplex, in real time, through a custom website with a distinctive animated UI (Iron-Man/HUD-inspired, not a generic chat window).
- Doesn't do all the thinking itself — it **dispatches** work to whatever AI CLIs are already installed on your machines (Claude Code, etc.), treating them as specialized sub-agents, while it stays the coordinating "leader."
- Talks to many LLM providers/APIs, not just one — for cost control, redundancy, and picking the right model for the right job.
- Remembers things efficiently (hybrid vector + structured memory), rather than re-explaining context every session.
- Never silently gets stuck: when a task fails, it tries another approach or tool before giving up, and if it truly can't proceed, it surfaces the problem to you with a diagnosis and 2–3 concrete fix options (an "A/B/C" recommendation), across both the website and your phone.
- Learns from its own mistakes over time instead of repeating them.
- Is fast and low-friction for simple questions (no heavyweight multi-agent reasoning for "what time is it"), but can go deep — plan, search, execute, verify — when a task actually needs it.
- Runs comfortably on a **2 vCPU / 8 GB RAM** box without falling over.

## 2. Goals

| # | Goal |
|---|------|
| G1 | Full-duplex live voice interaction via a custom web UI with real-time animation |
| G2 | Dispatch tasks to local AI CLIs (Claude Code, others) as sub-agents under a single coordinating "brain" |
| G3 | Multi-provider LLM routing with automatic fallback and per-task model selection |
| G4 | Continuous "awake" loop that tracks open tasks to completion, without manual polling |
| G5 | Resilience: on failure, retry with a different strategy/tool before escalating to the user |
| G6 | Proactive reporting: issue detected → root cause → 2–3 fix options → recommendation, pushed to web + phone |
| G7 | Hybrid memory (vector + structured) that improves recall and personalization over time |
| G8 | Fast-path answers for simple queries; slow-path (plan → search → act → verify) for complex ones |
| G9 | Runs smoothly within 2 vCPU / 8 GB RAM |
| G10 | Tiered autonomy — Jarvis acts freely on low-risk actions, confirms before high-risk ones (deploy, delete, spend money) |
| G11 | Single-user secured web dashboard to monitor/control everything (providers, APIs, tasks, CLIs, costs) |

## 3. Non-Goals (for v1)

- Not a multi-tenant / multi-user product — single-user only.
- Not running local LLM inference on the Azure box (too RAM-heavy for 8 GB) — cloud APIs only, at least until hardware changes.
- Not building a full microVM sandbox platform (Firecracker-style) on day one — the execution environment is treated as already disposable; only lightweight process-level isolation (resource limits, separate working dirs) is in scope initially.
- Not aiming for enterprise-grade multi-tenant billing/guardrails — those LiteLLM/Portkey features exist but are overkill here; use the free/self-hosted subset only.

## 4. Users / Personas

Just one: **you.** Jarvis is a personal operator, not a shared product. This simplifies auth (single login), simplifies memory (no multi-tenant isolation needed), and means UX choices can be tuned exactly to your habits rather than a general audience.

---

## 5. High-Level Architecture

```
                         ┌───────────────────────────────┐
                         │        Website (TS/Next.js)     │
                         │  Live voice UI + Dashboard      │
                         │  (animated avatar, task/API      │
                         │   monitor, provider spend, logs) │
                         └───────────────┬─────────────────┘
                                         │ WebSocket / REST
                         ┌───────────────▼─────────────────┐
                         │   Gateway / Channel Layer (Node)  │
                         │  - auth (single user)             │
                         │  - routes voice + text + push      │
                         │  - talks to phone (push notifs)    │
                         └───────────────┬─────────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        │                                │                                │
┌───────▼────────┐            ┌──────────▼──────────┐          ┌──────────▼──────────┐
│  Go Watchdog     │            │   Python Brain        │          │  Voice Pipeline (Py) │
│  "Awake" daemon  │◄──────────►│   Orchestrator/Planner │◄────────►│  STT → LLM → TTS     │
│  - task heartbeat │            │  - LangGraph/CrewAI    │          │  (Pipecat)            │
│  - restarts       │            │  - risk-tier gate      │          └──────────────────────┘
│  - resource caps  │            │  - retry/fallback logic │
│  - single static  │            └──────────┬─────────────┘
│    binary          │                       │
└─────────────────┘            ┌─────────────┼─────────────────────────┐
                                │             │                         │
                     ┌──────────▼───┐ ┌───────▼──────┐ ┌────────────────▼────────────────┐
                     │  Memory layer │ │ AI Gateway    │ │  CLI Sub-Agent Dispatcher         │
                     │  vector +     │ │ (LiteLLM)     │ │  - Claude Code                    │
                     │  structured   │ │ multi-provider│ │  - other installed CLIs           │
                     │  (Mem0/SQLite)│ │ fallback/cost │ │  - PC worker (heartbeat-registered)│
                     └───────────────┘ └───────────────┘ └────────────────────────────────┘
```

**Why this split:** the ecosystem of mature tools for agent orchestration, memory, and voice has converged hard on Python. The always-on gateway/website is naturally Node/TypeScript (same runtime as the browser, huge WebSocket/real-time ecosystem). The one component that must survive everything else failing — the watchdog — gets its own dedicated, minimal-footprint Go binary, because that's the one job where "never crashes, near-zero memory" matters more than ecosystem breadth.

---

## 6. Component Breakdown

### 6.1 The Brain (Python) — Orchestration, Planning, Retry Logic
**Owns:** task planning, tool/model selection, retry/fallback strategy, the "don't get stuck in a loop" logic, risk-tier gating before high-stakes actions.

- Framework candidates: **LangGraph** (explicit state machines with checkpointing — best fit for "if this fails, try a different path" since you build literal retry/fallback edges into the graph) or **CrewAI** (faster to prototype role-based delegation, coarser error handling).
- `[DECIDED]` Lean toward LangGraph for the core loop specifically because the loop-avoidance requirement (G5) needs explicit, inspectable state — not just implicit agent chatter.
- Implements the 4-stage HuggingGPT-style pipeline as a mental model: **task planning → tool/model selection → execution → response synthesis.**

### 6.2 The Watchdog (Go) — "Awake" System
**Owns:** uptime, task heartbeat-checking, process supervision, resource-limit enforcement.

- Single static binary, near-zero RAM footprint, no runtime dependency — the one process guaranteed to still be alive even if the Python brain crashes from a bad dependency or the Node gateway OOMs.
- Polls task state (I/O-bound, not CPU-bound — Go's concurrency model is a great fit but this is not a raw-performance requirement, it's a reliability one).
- Enforces OS-level resource caps (cgroups / `systemd` `MemoryMax=` / `CPUQuota=`, or `ulimit`) per task so one runaway job can't take down the box — this is the cheap substitute for full sandboxing given the "already a test zone" decision.
- Restarts crashed subprocesses; escalates to the proactive-reporting system if something can't self-heal.

### 6.3 Gateway / Channel Layer (Node/TypeScript)
**Owns:** the always-on front door — auth, WebSocket session management, routing between voice/text/web/phone channels, push notifications.
- Modeled loosely on OpenClaw's own architecture: Gateway → Agent Runtime → LLM → Tools.
- Keep this thin. Avoid heavy server-side rendering; serve mostly static assets + a slim API so it stays light on the 8 GB box.

### 6.4 Website (TypeScript / Next.js or similar)
**Owns:** the live voice UI (animated avatar/HUD), and the control dashboard.

Dashboard should surface, at minimum:
- Live task list + status (running / waiting / blocked / done)
- Provider/API health + current routing decisions + spend so far
- CLI sub-agent activity (what's dispatched where, to Azure vs PC worker)
- Memory browser (recent facts stored, searchable)
- Proactive alerts inbox (issue → cause → A/B/C fix options → your decision)
- Risk-tier log (what Jarvis did autonomously vs. what it asked permission for)

### 6.5 Voice Pipeline (Python)
**Owns:** full-duplex STT → LLM → TTS, wake/listening mode.
- `[RESEARCH]` **Pipecat** — pipeline-based, composable stages, huge provider library (Deepgram/Whisper for STT, ElevenLabs/Cartesia for TTS, any LLM in the middle), supports multi-agent handoff. Best starting point given it's Python-native and cloud-API-first (no local model weight, good for 8 GB constraint).
- `[RESEARCH]` **LiveKit Agents** — better if you outgrow Pipecat at scale/telephony; steeper ops overhead, probably not needed for a single-user system.
- Wake/listening mode is **configurable** (always-listening with wake word vs. push-to-talk vs. always-on session) — per your decision, this should be a toggle, not a fixed mode.
- `[RESEARCH]` **openWakeWord** (Apache 2.0, `dscripka/openWakeWord`) — open-source wake-word engine, ONNX-based, lightweight enough to run alongside everything else on modest hardware (a single Raspberry Pi 3 core reportedly runs 15–20 models in real time), ships pretrained models plus a Colab notebook to train a **custom wake word** (e.g. "Hey Jarvis"). No API key, no cloud dependency for this piece.
- `[RESEARCH]` **Picovoice Porcupine** — commercial-but-free-tier alternative, more accurate on constrained hardware, cross-platform (C core). Worth comparing against openWakeWord once you've got a prototype.

### 6.6 Memory Layer (Hybrid: vector + structured)
**Owns:** remembering — preferences, past conversations, project/task state — "in an optimized way."
- `[RESEARCH]` **Letta (formerly MemGPT)** — OS-inspired memory model (core memory = "RAM," archival = "disk"), the agent manages its own memory paging. Matches the "optimized remembering" instinct closely, but typically wants its own server process + Postgres — two more always-on services before you've built anything. Heavier than ideal for 8 GB.
- `[RESEARCH]` **Mem0** — lighter, mostly a client library, framework-agnostic, can point at a lightweight or hosted vector store. Better fit for the resource budget; you can graduate to Letta later if you outgrow it.
- `[RESEARCH]` **Graphiti (Zep)** — temporal knowledge-graph memory; better if structured facts/relationships-over-time matter more than raw embedding recall (e.g. "what changed about project X since June").
- `[DECIDED — budget-driven]` For v1 on 2 core/8GB: **Mem0 + SQLite/`sqlite-vec`** instead of standing up a separate vector DB (Qdrant/Milvus) or Postgres. Single-file storage, near-zero always-on overhead. Graduate to Letta or a real vector DB only if/when recall quality demands it.

### 6.7 AI Gateway / Multi-Provider Routing
**Owns:** talking to many LLM providers behind one interface, with cost tracking, load balancing, and automatic fallback — this directly answers "add multi AI providers/APIs" and "track control APIs and providers."
- `[RESEARCH]` **LiteLLM** (`BerriAI/litellm`) — the clear best fit. Open-source AI gateway, single OpenAI-compatible endpoint in front of 100+ providers (OpenAI, Anthropic, Gemini, Bedrock, Groq, Ollama, etc.), with a **Python SDK mode** (just a `Router` with retry/fallback logic — no extra server) and a **proxy/gateway mode** (a standalone service with virtual keys, spend tracking, an admin UI, caching). Rust core, Python SDK — fast and light.
  - For a single-user 8 GB box: start with the **SDK mode** (`litellm.Router`) inside the Python brain — gives you retry/fallback and cost tracking with zero extra always-on process. Move to the **self-hosted proxy** (Docker, optionally with SQLite/Postgres) only if you want the admin dashboard or want other processes (Go watchdog, Node gateway) to share one routing layer.
  - A pre-built Docker image exists (`hwdsl2/docker-litellm`) if you do want the standalone proxy — auto-generates a master key, no provider keys required to boot, supports 100+ providers out of the box.
- `[RESEARCH]` **OpenRouter** — a hosted alternative/complement to self-hosting a gateway; useful as one of the "providers" LiteLLM routes through rather than a replacement for LiteLLM itself.
- This component is also where "best model per task type" logic lives — e.g., route fast/cheap questions to a small/cheap model, route hard planning tasks to a stronger model, with LiteLLM's router handling the actual provider calls once your Python brain decides *which* tier a task needs.

### 6.8 CLI Sub-Agent Dispatcher
**Owns:** treating installed AI CLIs (Claude Code and others) as callable sub-agents, with Claude Code potentially acting as a "leader" for certain classes of work (e.g., dev tasks).
- `[RESEARCH]` The **sub-agent-cli-swarm** pattern (already present as a skill in this environment) — orchestrates free/cheap CLIs (Codex, Antigravity, Kilo Code, etc.) as sub-agents under a smarter planning model. Directly relevant prior art for this exact piece.
- `[RESEARCH]` **AgentBox** (referenced via `arjan/awesome-agent-sandboxes`) — specifically supports running Claude Code/Codex/OpenCode in parallel, each in its own sandboxed VM; relevant if you later want isolation per CLI dispatch even without full sandboxing today.
- Autonomy for delegated coding tasks is **tiered by risk**, not global (see §7) — matches your answer that hands-off level "depends," not a fixed mode.

### 6.9 Task Execution / "Sandbox"
- `[DECIDED]` No full sandbox layer for v1 — the execution environment itself is already treated as disposable. Isolation is limited to **process-level resource limits** (memory/CPU caps, separate working directories per task) enforced by the Go watchdog, protecting Jarvis's own state (memory DB, config) from a runaway task rather than protecting the host from malicious code.
- `[RESEARCH — for later, if isolation needs grow]` **E2B** (`e2b-dev/e2b`) — the standard reference for sandboxed code execution, self-hostable via Terraform. **agent-sandbox/agent-sandbox** — open-source, E2B-protocol-compatible, one-command Kubernetes deploy — a natural next step if the Azure setup ever grows into a small cluster.

### 6.10 Durable Task/Workflow Engine
- `[OPEN]` Do you want a formal durable-execution layer (survives crashes, resumes exactly where it left off, built-in retry policies) under the Python brain's task loop, or is the Go watchdog + LangGraph checkpointing enough?
- `[RESEARCH]` **Temporal** (`temporalio/temporal`) — the standard for durable execution: workflows as ordinary code, automatic retries/timeouts/versioning, survives process crashes. Genuinely excellent fit for G4/G5 (awake loop, no stuck loops). **Caveat for your hardware:** self-hosting a full Temporal cluster wants its own server + Postgres (+ optionally Elasticsearch, though a Postgres-only visibility store avoids that) — that's a non-trivial chunk of your 8 GB budget as a permanently-running service. Worth prototyping the awake-loop with LangGraph checkpointing + the Go watchdog first, and reaching for Temporal specifically if that combination proves fragile in practice, not as a starting assumption.

---

## 7. Autonomy / Risk Tiers

Rather than one global "how hands-off should Jarvis be" setting, actions are classified by risk, matching your answer that it "depends" on the task:

| Tier | Examples | Behavior |
|------|----------|----------|
| **Tier 0 — Autonomous** | Reading files, searching the web, drafting code on a feature branch, answering questions, checking status | Jarvis just does it, no confirmation |
| **Tier 1 — Notify-after** | Completing a multi-step task, writing to its own memory, minor config changes | Jarvis does it, then logs/reports it in the dashboard or a proactive message |
| **Tier 2 — Confirm-first** | Deploying code, pushing to production, deleting data, modifying another live project | Jarvis prepares the action and *asks* before executing |
| **Tier 3 — Always manual (for now)** | Spending money (API credit top-ups, etc.) | `[OPEN]` — explicitly undecided; revisit once real API costs are visible |

`[OPEN]` Exact boundary rules per tier — worth writing as an explicit table once you've used the system for a few weeks and see where the friction actually is.

---

## 8. Proactive Reporting System

When Jarvis hits a problem it can't resolve on its own (after exhausting retry/fallback options per §9):

1. Detect issue.
2. Diagnose root cause (best-effort).
3. Propose 2–3 concrete fix options (the "A/B/C" pattern you described).
4. Recommend one, with reasoning.
5. Push to **both** the website (dashboard alert) and your **phone** (push notification).
6. Log the outcome once you respond — this closes the loop for the "learns from mistakes" requirement (§10).

## 9. Failure Handling / "Never Stuck in a Loop"

This is an agentic **retry + circuit-breaker + tool-substitution** pattern:

- Each task attempt is bounded (max retries, max time).
- On failure, before retrying identically, the brain tries a **different strategy** — different tool, different provider/model, different approach to the same goal — rather than repeating the same failed action.
- If all reasonable alternatives are exhausted, escalate via the proactive reporting system (§8) instead of looping silently.
- `[RESEARCH]` Worth studying how LangGraph, CrewAI, and OpenHands implement this today — it's a known hard problem (infinite retry loops, tool-selection thrashing) and there's no need to reinvent the failure modes from scratch.

## 10. Learning From Mistakes

`[OPEN]` — mechanism not yet decided. Candidate approaches to evaluate:
- Simple: append a structured "postmortem" entry to memory (what failed, what fixed it) so future planning retrieves it as context.
- Richer: maintain a small "lessons" table in the structured half of the hybrid memory layer, weighted into future tool/strategy selection.

## 11. Fast vs. Slow Path

- **Fast path:** simple factual/direct questions get answered immediately by a single cheap/fast model call — no planning graph, no multi-tool loop.
- **Slow path:** anything requiring research, multi-step execution, or tool use goes through the full brain (plan → select → execute → verify).
- The Python brain's first job on any input is effectively a routing decision: fast-path or slow-path. This is also where LiteLLM's per-task model selection (§6.7) matters most — fast path should default to a cheap/quick model, slow path escalates as needed.

---

## 12. Resource Budget (2 vCPU / 8 GB RAM)

**Core principle: no local model inference, ever.** LLM, STT, and TTS are all API calls, never locally-loaded weights — a single local 7B model alone would consume most of the available RAM. Every recommended tool above (Pipecat, Mem0, LiteLLM SDK mode) is designed to call out to cloud APIs rather than run models in-process, so this isn't fighting the tools, it's the intended usage pattern.

| Always-on (must stay lean) | On-demand (spin up, exit when done) |
|---|---|
| Go watchdog daemon (a few MB RAM) | Voice session (Pipecat pipeline) |
| Node gateway + website (kept thin — avoid heavy SSR) | Python orchestration run, per task |
| Lightweight memory store (SQLite/`sqlite-vec`, or Mem0 client) | Code execution tasks |
| — | LiteLLM proxy, *if* you choose proxy mode over SDK mode |

- **Offload to the PC worker** for anything CPU/RAM-heavy — batch searches, embedding generation, larger code-execution tasks — whenever it's online (heartbeat-registered with the Azure leader). The Azure box's job is "always available, never falls over," not "does the heavy lifting."
- Prefer **SDK-mode LiteLLM** (in-process router) over the standalone proxy+Postgres deployment unless you specifically want the admin dashboard/spend UI as a separate service.
- Prefer **Mem0 + SQLite** over Letta+Postgres or a dedicated vector DB server, at least until you've measured that recall quality actually needs it.
- Apply OS-level resource caps (cgroups / `systemd` unit limits / `ulimit`) per dispatched task so nothing runaway can starve the watchdog or the gateway.

---

## 13. Tech Stack Summary

| Layer | Language/Framework | Why |
|---|---|---|
| Orchestration / planning | Python + LangGraph (or CrewAI) | Deepest ecosystem for agent tooling; explicit retry/fallback graphs |
| Voice pipeline | Python + Pipecat | Composable STT→LLM→TTS, cloud-API-first, no local model weight |
| Memory | Python + Mem0 + SQLite/`sqlite-vec` (upgrade path: Letta / Graphiti) | Hybrid vector+structured, minimal always-on footprint |
| Multi-provider gateway | LiteLLM (Python SDK or self-hosted proxy) | 100+ providers behind one interface, retry/fallback, cost tracking |
| Watchdog / awake daemon | Go | Single static binary, near-zero memory, survives everything else crashing |
| Gateway / channel layer | Node.js / TypeScript | Always-on WebSocket routing, matches OpenClaw's own architecture |
| Website (voice UI + dashboard) | TypeScript (Next.js/React) | Live animated UI, WebSocket client, dashboard |
| Wake word | openWakeWord (or Porcupine) | Local, lightweight, no cloud dependency for the always-listening piece |
| CLI dispatch | Custom, modeled on sub-agent-cli-swarm pattern | Treats installed CLIs as callable sub-agents |
| Task execution | Docker + resource caps (no full sandbox for v1) | Matches "already a disposable test zone" decision |
| Durable workflow (optional/later) | Temporal | If LangGraph checkpointing + Go watchdog prove insufficient |

---

## 14. Repos & Resources

### 14.1 Reference architectures for the whole system
- **`openclaw/openclaw`** — closest existing match to the overall concept: local-first control plane, multi-provider, multi-channel (voice + chat apps), plugin/skill system, wake-word and continuous voice modes already built. Study its Gateway → Agent Runtime → LLM → Tools architecture even if not used directly.
- **`open-jarvis/OpenJarvis`** — Stanford "Personal AI, On Personal Devices" project. Agents map closely onto this PRD: `monitor_operative` (continuous monitoring ≈ the "awake" system), `operative` (persistent autonomous agent ≈ the leader/dispatcher), `native_openhands` (CodeAct-style Python execution ≈ the execution layer). Ships a skills catalog importable from OpenClaw (~13,700 community skills) plus Hermes Agent skills. Default philosophy is local-model-first (Ollama) — reconfigure cloud-first for the 8 GB budget, or just reuse its agent/skill architecture.
- **`LHL3341/awesome-claws`** — curated list of OpenClaw-style alternatives at different weight classes (nanoclaw, zeroclaw, nanobot, AstrBot) — useful for seeing minimal vs. full implementations.
- **`microsoft/JARVIS`** (HuggingGPT) — unmaintained, needs 24GB+ VRAM/80GB RAM for full local deployment, not viable to run — but its 4-stage pipeline (task planning → model/tool selection → execution → response generation) is a clean mental model worth keeping.
- **`github.com/topics/jarvis?l=html`** — mostly toy logic, but a good mood board for the animated HUD/voice-orb UI layer specifically.
- `kishanrajput23/Jarvis-Desktop-Voice-Assistant` — skip; rule-based script with no LLM, not a useful foundation.

### 14.2 Multi-agent orchestration
- **LangGraph** — explicit, debuggable state machines with checkpointing.
- **CrewAI** — faster prototyping of role-based delegation.
- **sub-agent-cli-swarm** pattern (present in this environment as a skill) — orchestrating free/cheap CLIs as sub-agents under a planning model.

### 14.3 Voice (full duplex)
- **`pipecat-ai/pipecat`** — recommended starting point; pipeline-based, huge provider library.
- **LiveKit Agents** — fallback if you outgrow Pipecat's scale/telephony needs.
- **`dscripka/openWakeWord`** — open-source wake word detection, ONNX-based, trainable custom wake word, lightweight enough for modest hardware.
- **Picovoice Porcupine** — commercial-but-free-tier alternative, cross-platform, higher accuracy on constrained hardware.

### 14.4 Memory
- **`letta-ai/letta`** (MemGPT) — OS-inspired memory management; heavier (own server + Postgres).
- **Mem0** — lightweight, framework-agnostic memory client — recommended for v1 given the resource budget.
- **`getzep/graphiti`** — temporal knowledge-graph memory for structured facts/relationships over time.

### 14.5 Multi-provider LLM gateway
- **`BerriAI/litellm`** — recommended. Rust core + Python SDK, 100+ providers, OpenAI-compatible, SDK mode (in-process, zero extra service) or proxy mode (standalone gateway w/ admin UI, virtual keys, spend tracking).
- **`hwdsl2/docker-litellm`** — pre-built Docker image for the self-hosted proxy mode, auto-generates a master key, boots with zero providers configured.
- **OpenRouter** — hosted multi-model access, usable as one upstream behind LiteLLM rather than a replacement for it.
- **Portkey / Kong AI Gateway** — enterprise-grade alternatives; noted for completeness, likely overkill for a single-user 8 GB deployment.

### 14.6 Sandboxed / isolated execution (for later, if needed)
- **`e2b-dev/e2b`** — standard reference, self-hostable via Terraform.
- **`agent-sandbox/agent-sandbox`** — open-source, E2B-protocol-compatible, one-command Kubernetes deploy.
- **`arjan/awesome-agent-sandboxes`** — curated list; includes **AgentBox**, which specifically supports running Claude Code/Codex/OpenCode in parallel sandboxed VMs.

### 14.7 Durable execution / workflow engine (optional/later)
- **`temporalio/temporal`** — durable execution platform, automatic retries/timeouts/versioning, survives crashes. Consider once/if the LangGraph + Go watchdog combination proves insufficient for the "awake, never stuck" requirement — self-hosting the full cluster is a real chunk of the 8 GB budget, so this is a graduation step, not a v1 default.

---

## 15. Decision Log

### Decided
- Architecture split: Python (brain/voice/memory) + Go (watchdog) + TypeScript/Node (gateway/website).
- No full sandbox layer for v1 — process-level resource limits only.
- Runs primarily on Azure (2 core/8GB), PC as secondary worker when online.
- Full-duplex voice, configurable wake/listening mode.
- Hybrid memory (vector + structured), lightweight implementation (Mem0 + SQLite) for v1.
- Multi-provider routing for both cost/fallback *and* best-model-per-task.
- Proactive alerts delivered to both website and phone.
- Jarvis starts by managing only itself; expansion to other projects is a later phase.
- Single-user web dashboard with login.
- Solo project, no fixed deadline.

### Open / Needs a Decision
- Whether Jarvis can ever autonomously spend money (e.g., topping up API credit) — Tier 3, explicitly deferred until real costs are visible.
- Exact rules for what falls into which risk tier (§7) beyond the rough sketch.
- Mechanism for "learning from mistakes" (§10) — simple memory postmortem vs. a dedicated lessons table.
- Whether a formal durable-workflow engine (Temporal) is needed, or LangGraph checkpointing + Go watchdog is sufficient.
- LiteLLM: SDK-mode-only vs. also standing up the proxy for the admin dashboard.
- Whether to build the CLI dispatcher from scratch or adapt the sub-agent-cli-swarm pattern directly.

---

## 16. Non-Functional Requirements

- **Resource ceiling:** always-on processes together should leave comfortable headroom under 8 GB RAM at idle; on-demand components (voice sessions, task execution) may burst but must be capped.
- **Resilience:** the watchdog must survive a crash in any other component and be able to restart it.
- **Security:** single-user login on the dashboard; provider API keys stored server-side only, never exposed to the browser.
- **Latency:** fast-path answers should feel near-instant (single model call, no planning graph); voice round-trip should target low-latency streaming (Pipecat's streaming STT→LLM→TTS), not turn-based batch processing.
- **Observability:** every dispatched task, provider call, and CLI invocation should be visible in the dashboard — this *is* the "track control APIs and providers" requirement, not an afterthought.
- **Cost control:** provider spend should be visible per task/provider, ideally with soft budget alerts (LiteLLM's virtual-key spend tracking covers this if proxy mode is used).

---

## 17. Suggested Phased Roadmap

*(No fixed deadline — this is a suggested build order, not a schedule.)*

1. **Phase 0 — Skeleton:** Go watchdog + minimal Python brain that can make a single LLM call through LiteLLM (SDK mode) and log to SQLite. No voice, no UI yet.
2. **Phase 1 — Text-first control loop:** Node gateway + basic website (chat-style, no animation yet) talking to the brain; add the awake/task-tracking loop and basic retry/fallback.
3. **Phase 2 — Memory:** wire in Mem0 + SQLite hybrid memory; verify recall actually improves multi-session context.
4. **Phase 3 — CLI dispatch:** connect Claude Code (and other installed CLIs) as sub-agents; implement the risk-tier gate (§7) before anything Tier 2+.
5. **Phase 4 — Voice:** add Pipecat pipeline + openWakeWord; wire full-duplex voice into the website.
6. **Phase 5 — UI polish:** build the animated HUD/avatar layer (raid `github.com/topics/jarvis?l=html` for visual direction); flesh out the dashboard (provider spend, task monitor, memory browser, alerts inbox).
7. **Phase 6 — Proactive reporting + PC worker offload:** heartbeat-based PC worker registration; issue → cause → A/B/C fix-option pipeline; phone push notifications.
8. **Phase 7 — Learning loop:** implement the mistake-memory mechanism (§10) and start feeding retry outcomes back into planning.
9. **Phase 8+ — Expansion:** extend Jarvis's monitoring/management scope beyond itself to your other active projects, once the core is stable.

---

## 18. Glossary

- **Brain:** the Python orchestration/planning component (§6.1).
- **Watchdog:** the Go uptime/task-heartbeat daemon (§6.2).
- **Gateway:** the Node/TypeScript always-on routing layer (§6.3).
- **Sub-agent:** an installed AI CLI (e.g. Claude Code) that Jarvis dispatches a task to, rather than doing the work itself.
- **Fast path / slow path:** the routing decision between a single quick model call vs. the full plan-execute-verify loop (§11).
- **Risk tier:** the autonomy classification of an action (§7) — determines whether Jarvis acts alone, notifies after, or confirms first.
- **Awake system:** the continuous task-tracking loop that ensures nothing silently stalls (G4).
