---
name: phase-runner
description: Knows the Jarvis build phase structure (0-7), reads the correct phase plan doc, decomposes into parallel tasks, and chains to the next phase automatically when done. Use this skill before starting any Jarvis build phase.
allowed-tools: Read, Glob
user-invocable: false
---

# Phase Runner Skill

## Phase Map
| Phase | Name | Plan Doc | Key Files |
|-------|------|----------|-----------|
| 0 | Skeleton | `docs/plan/phase-0-skeleton.md` | `src/brain/llm_router.py`, `src/brain/db.py`, `src/watchdog/` |
| 1 | LangGraph + API | `docs/plan/phase-1-langraph.md` | `src/brain/planner.py`, `src/brain/server.py`, `src/gateway/`, `src/website/` |
| 2 | Memory | `docs/plan/phase-2-memory.md` | `src/brain/memory.py`, `src/brain/memory_config.py` |
| 3 | CLI Dispatch | `docs/plan/phase-3-dispatch.md` | `src/dispatcher/`, risk_gate.py, cli_registry.py |
| 4 | Voice | `docs/plan/phase-4-voice.md` | `src/voice/`, wakeword.py, stt_factory.py, tts_factory.py |
| 5 | UI Polish | `docs/plan/phase-5-ui.md` | `src/website/` HUD + dashboard |
| 6 | Proactive | `docs/plan/phase-6-proactive.md` | Telegram push, PC worker, cron jobs |
| 7 | Learning Loop | `docs/plan/phase-7-learning.md` | Mistake postmortem → memory feedback |

## Before Starting Any Phase
1. Read the phase plan doc listed above
2. Check which sub-tasks are already done (look for ✅ markers)
3. Identify files to create/modify — cross-reference with existing files via Glob
4. Decompose into parallel tasks (aim for 3-5 independent sub-tasks max)

## After Completing a Phase
1. Add `✅ Completed: <ISO date>` at the top of the phase plan doc
2. Read the NEXT phase plan doc
3. Start that phase immediately — no confirmation needed

## Phase Chaining Rules
- Never skip phases — build in order 0→1→2→3→4→5→6→7
- A phase is complete when ALL its key files exist AND tests/smoke-checks pass
- If a phase plan doc doesn't exist yet, create it from `docs/architecture.md` context
