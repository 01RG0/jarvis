# Jarvis Audit Inventory
Generated: 2026-09-09

## AI CLIs Installed
| CLI | Path | Status |
|-----|------|--------|
| grok | C:\Users\ahmed\.grok\bin\grok.exe | Available |
| agy | D:\pRoG\Archives\coder\agy.exe | Available |
| codex | D:\pRoG\Archives\coder\codex / codex.cmd | Available |
| kilo | D:\pRoG\Archives\coder\kilo / kilo.cmd | Available |
| vibe | C:\Users\ahmed\.local\bin\vibe.exe | Available |
| freebuff | Not found (TUI only — expected) | N/A |

## Runtimes
| Tool | Version |
|------|---------|
| Python | 3.14.0 |
| Node.js | 24.11.1 |
| npm | 11.14.1 |
| Go | Not in PATH (go.mod present — Go 1.22 required) |
| tsc | Available (C:\Users\ahmed\AppData\Roaming\npm\tsc) |

## Linters / Analysis Tools
| Tool | Status |
|------|--------|
| ruff | NOT installed |
| mypy | NOT installed |
| eslint | NOT installed |
| pytest | NOT installed |
| pip-audit | NOT installed |
| govulncheck | NOT installed |
| staticcheck | NOT installed |

Note: None of the standard linters are installed globally. Analysis was performed manually by reading source files.

## Repository Structure

### src/brain/ (Python — 24 files)
```
main.py              CLI entry point (argparse, calls call_llm directly)
server.py            FastAPI HTTP server (task, health, heartbeat, dashboard, forge-tool endpoints)
planner.py           LangGraph graph (route→memory→skill→tool→plan→execute→verify→retry→output→save)
llm_router.py        LiteLLM Router wrapper (fast=groq/llama-3.1-8b-instant, balanced=gemini-1.5-flash, smart=gemini-1.5-pro)
db.py                SQLite helpers (init_db, log_call, get_spend_summary, get_recent_tasks)
memory.py            JarvisMemory wrapper around Mem0 (add, search, get_context, update_from_conversation)
memory_config.py     Mem0 config builder (ChromaDB vector store, litellm LLM, OpenAI embedder)
tool_forge.py        Auto-forge new tools via LLM (forge_tool, auto_forge_from_gap)
tool_registry.py     Runtime tool discovery, scoring, param extraction, execution
skill_forge.py       Auto-forge new skills via LLM (forge_skill, auto_forge_from_gap)
skill_registry.py    Skill index (SKILL-INDEX.json) CRUD + keyword matcher
learning.py          Fire-and-forget outcome persistence to Mem0
notifier.py          Telegram push notifications (notify, notify_task_complete, notify_error)
retry.py             Async retry utility (with_retry, RetryConfig, next_model)
task_loop.py         Async task queue with per-task heartbeat emission
config/
  litellm_config.yaml  Static LiteLLM config (not used by current code — router is built inline)
data/
  jarvis.db            SQLite database (runtime artifact)
tools/
  __init__.py          Empty
  _base.py             JarvisTool ABC + ToolResult dataclass
  read_file.py         Built-in tool: read local file
  run_python.py        Built-in tool: execute Python snippet in subprocess
  web_search.py        Built-in tool: DuckDuckGo JSON API search
```

### src/watchdog/ (Go — 4 files)
```
main.go        Entry point (flags: -watch, -heartbeat-port, -heartbeat-timeout)
supervisor.go  Exponential-backoff process supervisor loop
heartbeat.go   HTTP server on :8099 (/heartbeat POST, /health GET) + stall detection
go.mod         module jarvis/watchdog, go 1.22
```

### src/gateway/ (Node.js/TypeScript — 5 files)
```
src/index.ts        Express + WebSocket server, dashboard proxy, worker registry
src/auth.ts         JWT verify/extract helpers
src/brain_client.ts HTTP client for POST /task to brain
src/ws_handler.ts   WebSocket message handler → brain_client
src/voice_proxy.ts  WebSocket proxy for voice pipeline at /voice
package.json        Dependencies: ws, express, jsonwebtoken, axios, dotenv
tsconfig.json       TypeScript config
```

### src/website/ (Next.js/TypeScript — 7 files)
```
src/app/page.tsx              Landing page
src/app/layout.tsx            Root layout
src/app/globals.css           Global styles
src/components/ArcReactor.tsx SVG animation component
src/components/Dashboard.tsx  Dashboard with tabs (tasks, spend, memory, alerts, workers)
src/lib/ws_client.ts          WebSocket client hook
next.config.js, tailwind.config.js, postcss.config.js, tsconfig.json
```

### src/dispatcher/ (Python — 4 files)
```
dispatcher.py   Main dispatch logic (risk gate, CLI selection, subprocess run)
cli_registry.py CLI detection + command builder
risk_gate.py    Tier enforcement (0=autonomous, 1=notify, 2=confirm, 3=manual)
models.py       DispatchRequest / DispatchResult dataclasses
```

### src/voice/ (Python — 5 files)
```
pipeline.py     Pipecat voice pipeline (STT→brain→TTS WebSocket loop)
stt_factory.py  STT provider factory (deepgram, openai, assemblyai)
tts_factory.py  TTS provider factory (elevenlabs, cartesia, openai)
wakeword.py     openWakeWord integration
requirements.txt
```

### src/worker/ (Python — 2 files)
```
worker.py        PC worker heartbeat + task polling
requirements.txt
```

### src/memory/ (EMPTY — Phase 2 not started here)
No files. Phase 2 memory work lives in src/brain/memory.py and memory_config.py.

## Dependency Summary
| Component | Key Deps |
|-----------|----------|
| brain | litellm, langgraph, fastapi, uvicorn, mem0ai, chromadb, httpx, pydantic |
| gateway | ws, express, jsonwebtoken, axios, dotenv |
| website | next, react, tailwindcss |
| watchdog | stdlib only (Go 1.22) |
| voice | pipecat, openai-whisper, deepgram-sdk, elevenlabs, openwakeword |
