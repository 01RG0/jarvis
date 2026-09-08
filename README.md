# Jarvis

> "Sometimes you gotta run before you can walk." — Tony Stark

A single, persistent, always-on personal AI operator. Jarvis lives on your Azure VM, talks to
you full-duplex through a custom animated HUD, dispatches work to AI CLIs as sub-agents, and
never silently gets stuck.

---

## Vision

Jarvis is not a chatbot. It's an **operator** — a system that stays awake, tracks tasks, routes
work to the right tool, and surfaces problems with a diagnosis and a fix-recommendation before
you even notice something went wrong.

It dispatches coding tasks to Claude Code and other installed CLIs as specialized sub-agents,
routes LLM calls through LiteLLM to whichever provider is cheapest/fastest for the job, and
remembers context across sessions so you never have to re-explain yourself.

The voice UI isn't an afterthought — it's the primary interface. Full-duplex, streaming
STT→LLM→TTS with a custom Iron-Man-inspired animated avatar running in the browser.

---

## Goals

| # | Goal |
|---|------|
| G1 | Full-duplex live voice via custom web UI with real-time animation |
| G2 | Dispatch tasks to local AI CLIs (Claude Code, others) as sub-agents |
| G3 | Multi-provider LLM routing with automatic fallback and per-task model selection |
| G4 | Continuous "awake" loop tracking open tasks to completion without manual polling |
| G5 | Resilience: retry with a different strategy/tool before escalating to the user |
| G6 | Proactive reporting: issue → root cause → 2–3 fix options → web + phone |
| G7 | Hybrid memory improving recall and personalization over time |
| G8 | Fast-path for simple queries; slow-path (plan→search→act→verify) for complex ones |
| G9 | Runs smoothly within 2 vCPU / 8 GB RAM |
| G10 | Tiered autonomy — acts freely on low-risk, confirms before high-risk |
| G11 | Single-user secured web dashboard (tasks, providers, spend, memory, alerts) |

---

## Architecture

```
                     ┌────────────────────────────────────┐
                     │       Website (Next.js/React)        │
                     │  Animated HUD voice UI + Dashboard   │
                     │  (task list, provider spend, alerts, │
                     │   memory browser, risk-tier log)      │
                     └────────────────┬───────────────────┘
                                      │ WebSocket / REST
                     ┌────────────────▼───────────────────┐
                     │  Gateway / Channel Layer (Node/TS)   │
                     │  - auth (single user, JWT)           │
                     │  - WebSocket session management      │
                     │  - routes voice + text + push notifs │
                     └────────────────┬───────────────────┘
                                      │
       ┌──────────────────────────────┼──────────────────────────────┐
       │                              │                              │
┌──────▼──────┐           ┌───────────▼──────────┐       ┌──────────▼──────────┐
│ Go Watchdog  │           │   Python Brain        │       │  Voice Pipeline     │
│ always-on    │◄─────────►│   (LangGraph)         │◄─────►│  (Pipecat)          │
│ daemon       │           │  - plan→select→exec   │       │  STT → LLM → TTS    │
│ - heartbeat  │           │  - retry/fallback     │       │  full-duplex         │
│ - restarts   │           │  - risk-tier gate     │       └─────────────────────┘
│ - res. caps  │           └───────────┬──────────┘
└─────────────┘                        │
                        ┌──────────────┼──────────────────────┐
                        │              │                      │
             ┌──────────▼──┐  ┌────────▼──────┐  ┌──────────▼──────────────┐
             │ Memory Layer │  │ AI Gateway    │  │ CLI Sub-Agent Dispatcher  │
             │ Mem0 +       │  │ (LiteLLM SDK) │  │ - Claude Code             │
             │ SQLite-vec   │  │ 100+ providers│  │ - other installed CLIs    │
             │              │  │ fallback/cost │  │ - PC worker offload       │
             └─────────────┘  └───────────────┘  └──────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Orchestration | Python + LangGraph | Explicit state machines with checkpointing; retry/fallback as literal graph edges |
| Voice pipeline | Python + Pipecat | Composable STT→LLM→TTS stages, cloud-API-first, no local model weights |
| Memory | Mem0 + SQLite/sqlite-vec | Hybrid vector+structured, single-file, near-zero always-on overhead |
| AI gateway | LiteLLM (SDK mode) | 100+ providers behind one interface, in-process router, cost tracking |
| Watchdog daemon | Go | Single static binary, ~few MB RAM, survives all other crashes |
| Gateway / channels | Node.js / TypeScript | Always-on WebSocket routing, push notifications |
| Website | Next.js / React | Live animated HUD, WebSocket voice client, control dashboard |
| Wake word | openWakeWord | ONNX-based, trainable custom wake word, no cloud dependency |
| CLI dispatch | Custom dispatcher | Treats installed CLIs (Claude Code, etc.) as callable sub-agents |

---

## Phased Roadmap

| Phase | Name | What it delivers |
|-------|------|-----------------|
| 0 | Skeleton | Go watchdog + Python brain making a single LLM call via LiteLLM + SQLite logging |
| 1 | Text control loop | Node gateway + basic website (chat) + awake task loop + retry/fallback |
| 2 | Memory | Mem0 + SQLite-vec; verify multi-session context recall actually works |
| 3 | CLI dispatch | Claude Code + other CLIs as sub-agents; risk-tier gate before Tier 2 actions |
| 4 | Voice | Pipecat STT→LLM→TTS + openWakeWord; full-duplex voice in website |
| 5 | UI polish | Animated HUD/avatar; full dashboard (spend, tasks, memory browser, alerts) |
| 6 | Proactive reporting | PC worker heartbeat; issue→A/B/C fix pipeline; phone push notifications |
| 7 | Learning loop | Mistake-memory mechanism; retry outcomes feed back into planning |
| 8+ | Expansion | Monitoring/managing other active projects |

See [`docs/plan/`](docs/plan/) for detailed per-phase specs.

---

## Project Structure

```
jarvis/
├── Jarvis-PRD.md              # Product requirements document
├── README.md
├── .env.example               # Environment variable template
├── docs/
│   ├── architecture.md        # Deep-dive architecture doc
│   ├── SETUP.md               # Dev environment setup
│   ├── plan/                  # Phase-by-phase implementation plans
│   │   ├── overview.md
│   │   ├── phase-0-skeleton.md
│   │   └── ...
│   ├── decisions/             # Architecture Decision Records (ADRs)
│   │   ├── ADR-001-language-split.md
│   │   └── ...
│   └── research/              # Tool evaluation notes
│       ├── litellm.md
│       ├── langgraph.md
│       └── ...
└── src/
    ├── brain/                 # Python orchestration (LangGraph)
    ├── watchdog/              # Go watchdog daemon
    ├── gateway/               # Node.js/TypeScript channel layer
    ├── website/               # Next.js voice UI + dashboard
    ├── voice/                 # Python Pipecat voice pipeline
    ├── memory/                # Mem0 + SQLite memory layer
    └── dispatcher/            # CLI sub-agent dispatcher
```

---

## Quick Start

See [`docs/SETUP.md`](docs/SETUP.md) for the full setup guide.

---

## Non-Goals (v1)

- **No multi-tenant** — single user only.
- **No local LLM inference** — cloud APIs only; 8 GB RAM can't spare it.
- **No full microVM sandbox** — process-level resource limits only for v1.
- **No enterprise billing/guardrails** — LiteLLM's free/self-hosted subset is enough.

---

## Autonomy Tiers

| Tier | Examples | Behavior |
|------|----------|----------|
| **Tier 0 — Autonomous** | Reading files, web search, drafting code, answering questions | Jarvis just does it |
| **Tier 1 — Notify-after** | Multi-step task completion, writing to memory, minor config | Does it, then reports |
| **Tier 2 — Confirm-first** | Deploy, push to production, delete data | Prepares and **asks first** |
| **Tier 3 — Always manual** | Spending money (API top-ups, etc.) | Explicitly deferred |

---

## License

MIT
