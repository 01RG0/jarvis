# CLAUDE.md — Jarvis Project

## Project Overview
Jarvis is a personal AI operator. Single user, always-on, Azure VM (2 vCPU/8GB RAM).
Do not run local LLM inference — cloud APIs only. See `docs/architecture.md` for full design.

## Current Build Status
- Phase 0 ✅ — Python brain skeleton + Go watchdog (`src/brain/`, `src/watchdog/`)
- Phase 1 ✅ — LangGraph planner, FastAPI server, Node gateway, Next.js chat UI
- Phase 2 ✅ — Memory layer (Mem0 + ChromaDB)
- Phase 3 ✅ — CLI sub-agent dispatcher with risk-tier gate
- Phase 4 ✅ — Voice pipeline (Pipecat STT→LLM→TTS + openWakeWord)
- Phase 5 ✅ — HUD dashboard (animated orb, spend/tasks/memory/alerts panels)
- Phase 6 ✅ — Proactive reporting (Telegram push + PC worker heartbeat)
- Phase 7 ✅ — Learning loop (retry outcomes → Mem0)
- Phase 8 ✅ — PC Agent (Windows remote control via WebSocket: screen/apps/browser/files/audio)
- Phase 9 ✅ — LLM management (16 providers, 65+ live-tested models, task routing)
- Phase 10 ✅ — Smart Context (active window + clipboard injected into every conversation)
- Phase 11 ✅ — Smart Home (Home Assistant REST API — lights/climate/locks/switches)
- Phase 12 ✅ — Multi-Agent Orchestration (parallel LangGraph planner + asyncio.gather fan-out)
- Phase 13 ✅ — Self-Improvement Agent (auto bug-fix + GitHub scout + MCP discovery, runs every 6h)

**All phases complete.** New capabilities: add to `src/brain/tools/` (auto-discovered) or run `python src/brain/tools/provider_admin.py add` for new LLM providers.

## Key Constraints
- **8 GB RAM budget**: always-on processes must stay lean; see `docs/architecture.md` deployment table
- **16 providers active** — use Groq (`groq/openai/gpt-oss-20b`) for fast-path, Alibaba Qwen for balanced/smart
- **No local model inference** — every LLM/STT/TTS call goes to a cloud API
- **SQLite only** — no Postgres, no standalone vector DB for v1

## Source Structure
```
src/brain/      Python orchestration (LangGraph, LiteLLM, Mem0)
src/watchdog/   Go daemon (supervisor, heartbeat)
src/gateway/    Node.js/TypeScript WebSocket gateway
src/website/    Next.js voice UI + dashboard
src/voice/      Pipecat voice pipeline (Phase 4)
src/memory/     Memory layer extras (Phase 2)
src/dispatcher/ CLI sub-agent dispatcher (Phase 3)
docs/plan/      Phase-by-phase implementation plans — read before coding a phase
docs/decisions/ ADRs — read before changing architecture decisions
docs/research/  Tool research notes with working code examples
```

## Coding Rules
- Python: use `os.open` with `0o600` for any file with credentials/sensitive data
- Go: never `exec.Command("sh", "-c", ...)` — always pass args directly as a slice
- All env vars via `.env` + `python-dotenv` / `dotenv` (Node) — never hardcode keys
- No comments unless the WHY is non-obvious
- `src/brain/requirements.txt` must be updated when adding Python deps

## Sub-Agent Coordinators
Phase coordinators are defined in `.claude/agents/`. Each handles one phase autonomously:
- Decompose → assign CLIs → run in parallel → review output → fix → commit

## Available CLIs (for sub-agent dispatch)
| CLI | Non-interactive | Best for |
|-----|----------------|---------|
| jules | `jules run "..." --dir ...` | Large-scope/UI/async jobs — use first for big tasks |
| grok | `grok -p "..." --always-approve` | Most reliable sync option — use first if jules unavail |
| agy | `agy --dangerously-skip-permissions --print="..."` | Complex logic; watch for encoding |
| codex | `codex exec -s workspace-write ...` | Well-specified coding tasks |
| kilo | `kilo run "..." --dir ...` | Long-context multi-file |
| vibe | `vibe -p "..." --auto-approve` | Boilerplate (times out on complex tasks) |
| freebuff | TUI only | Manual use only |

**Dynamic detection**: run `bash .claude/skills/cli-tracker/detect.sh` to auto-discover any
additional coding CLIs installed in PATH (claude, gemini, copilot, etc.).

## Git Rules (from best-practice repo)
- Separate commit per logical change (not per file if changes are coupled)
- Never force-push, never `--no-verify`
- `.env` is gitignored — never stage it

## Autocompact
Context compacts at 80% (`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=80` in settings.json).
After compact: re-read this file + current phase plan before continuing.
