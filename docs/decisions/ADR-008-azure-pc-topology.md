# ADR-008: Azure VM as Primary, Home PC as Optional Secondary Worker

**Status:** Accepted  
**Date:** 2026-09-08

## Context

Jarvis needs to be always-on (G4: "continuous awake loop"), but the home PC isn't always powered on. Two hardware options: Azure VM (always-on cloud), home PC (more powerful but intermittent).

## Decision

**Azure VM** hosts all always-on components. **Home PC** registers itself as an optional burst-work worker when it's powered on, via a heartbeat protocol. The Azure brain dispatches heavy tasks to the PC when it's available.

## Consequences

**Positive:**
- Azure provides 24/7 uptime for the always-on core — watchdog, gateway, website never go down
- PC's extra RAM and CPU (vs. the 2 vCPU/8 GB Azure box) can handle heavy tasks: batch embedding, large code execution, CPU-intensive processing
- PC worker is purely additive — Jarvis degrades gracefully when the PC is off (tasks that need it are queued or redirected)

**Negative:**
- Tasks dispatched to the PC depend on the PC being on — no guarantee of availability
- The heartbeat registration protocol needs to be built (Phase 6)
- Network latency Azure → home PC (via internet) adds overhead for PC-dispatched tasks — acceptable for batch/async work, not for real-time

## PC Worker Architecture

```
Home PC
├── worker_register.py     # Sends heartbeat POST to Azure gateway every N seconds
├── task_executor.py       # Listens for task assignments, executes, returns results
└── (same CLIs installed)  # Claude Code, etc. available for sub-agent dispatch
```

The Azure brain knows which workers are "alive" via the heartbeat registry. When dispatching a heavy task, it checks the registry and routes to the PC if available and capable.

## Deployment Topology Summary

Always-on (Azure VM):
- Go watchdog, Node gateway, Next.js website, SQLite memory

On-demand (Azure VM):
- Python brain (per task), Voice pipeline (per voice session)

On-demand (Home PC, when on):
- Heavy batch tasks: embedding generation, large code execution, bulk processing
