# Jarvis — Implementation Plan Overview

Build order is designed so each phase is independently useful and unlocks the next.
No phase depends on anything not delivered by a prior phase.

## Phase Summary

| Phase | Name | Enables | Key deliverable |
|-------|------|---------|----------------|
| 0 | Skeleton | Everything | Python brain + Go watchdog + LiteLLM + SQLite logging |
| 1 | Text control loop | Phases 2–8 | Node gateway + basic chat website + awake task loop |
| 2 | Memory | Phases 3–8 | Mem0 + sqlite-vec hybrid; multi-session context recall |
| 3 | CLI dispatch | Phase 6 | Claude Code + other CLIs as sub-agents; risk-tier gate |
| 4 | Voice | Phase 5 | Pipecat + openWakeWord; full-duplex voice in website |
| 5 | UI polish | Phase 6 | Animated HUD/avatar; full dashboard |
| 6 | Proactive reporting | Phase 7 | PC worker; issue→A/B/C pipeline; phone push |
| 7 | Learning loop | Phase 8+ | Mistakes feed back into planning |

## Dependency Graph

```
Phase 0 (Skeleton)
    └── Phase 1 (Text loop)
            ├── Phase 2 (Memory)
            │       └── Phase 3 (CLI dispatch)
            │               └── Phase 6 (Proactive + PC worker)
            │                       └── Phase 7 (Learning loop)
            └── Phase 4 (Voice)
                    └── Phase 5 (UI polish)
```

## Rough Effort Estimates

These are relative, not time-boxed (solo project, no fixed deadline):

| Phase | Effort | Complexity driver |
|-------|--------|-------------------|
| 0 | S | Mostly integration of existing libraries |
| 1 | M | WebSocket session management + task state machine |
| 2 | S | Mem0 is a library; main work is schema design |
| 3 | M | Dispatcher + risk-tier gate logic |
| 4 | M–L | Pipecat pipeline + browser audio streaming |
| 5 | L | Custom animated UI is the bulk of the work |
| 6 | M | PC heartbeat + push notification integration |
| 7 | S | Schema additions + retrieval weighting |

## What "Done" Means Per Phase

Each phase doc includes specific acceptance criteria. High-level:
- **Phase 0 done:** `python brain/main.py "what time is it"` makes an LLM call, logs to SQLite, exits cleanly. Watchdog binary runs and restarts a killed dummy process.
- **Phase 1 done:** Open browser, send a text message, get a response. Watchdog restarts the brain if it crashes.
- **Phase 2 done:** After 3 sessions, Jarvis references something you said in session 1 without being reminded.
- **Phase 3 done:** Jarvis delegates a "write me a Python function" task to Claude Code CLI and returns the result.
- **Phase 4 done:** Say "Hey Jarvis, what's the weather?" and hear a spoken response back.
- **Phase 5 done:** Dashboard shows real-time task list, provider spend, and last 10 memory entries.
- **Phase 6 done:** Jarvis sends a phone notification with A/B/C options when a sub-agent task fails after retries.
- **Phase 7 done:** Jarvis avoids a previously-failed approach on a repeated task type.

## Open Decisions Blocking Specific Phases

| Decision | Blocks | Options |
|----------|--------|---------|
| Learning mechanism (§10) | Phase 7 | Structured postmortem table vs. weighted lessons table |
| Temporal vs. LangGraph+Watchdog | Phase 1+ | Wait to see if awake loop proves fragile in practice |
| LiteLLM SDK vs. proxy | Phases 0+ | Start SDK; upgrade if admin UI becomes important |
| CLI dispatcher: build vs. adapt sub-agent-cli-swarm | Phase 3 | The skill is already available in this environment |
