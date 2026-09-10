# JARVIS Capabilities Registry

> Master registry of ALL capabilities JARVIS should have, mapped against current implementation status.
> Updated: 2026-09-10. Current build: Phase 0-1 complete, Phase 2 in progress.

Legend: ✅ Built | 🔄 In progress | ❌ Not built | ⚠️ Partial (UI only / fake data)

---

## 1. PC Control

| Capability | Status | Priority | Package | Implementation note |
|---|---|---|---|---|
| PC agent WebSocket client | ⚠️ | P0 | `websockets` | `src/pc_agent/main.py` — connects out to Azure brain |
| Screenshot (raw) | ⚠️ | P0 | `mss` + `Pillow` | `capture_screen()` → base64 JPEG |
| Screenshot → Vision LLM | ❌ | P0 | `litellm` + Gemini | `understand_screen(question)` |
| App launch | ⚠️ | P0 | `subprocess` | `open_app(name)` with alias dict |
| App close | ❌ | P0 | `psutil` | `kill_process(name)` |
| Window list | ❌ | P0 | `pygetwindow` | `list_windows()` |
| Window focus | ❌ | P1 | `pygetwindow` / `win32gui` | `focus_window(title)` |
| Open URL in browser | ❌ | P0 | `subprocess` | `open_url(url, browser)` |
| Open file (default app) | ❌ | P1 | `os.startfile` | Any file type |
| System stats (real) | ✅ | P0 | `psutil` | Replace fake SysMonWidget random data |
| Process list | ❌ | P1 | `psutil` | `list_top_processes()` |
| Kill process | ❌ | P1 | `psutil` | DANGEROUS tier — needs approval |
| Clipboard read | ❌ | P1 | `pyperclip` | `get_clipboard()` |
| Clipboard write | ❌ | P1 | `pyperclip` | MEDIUM tier |
| Audio volume get/set | ❌ | P2 | `pycaw` | `set_volume(0.5)` |
| Audio mute/unmute | ❌ | P2 | `pycaw` | |
| Windows notification | ✅ | P1 | `winotify` | Toast alerts from JARVIS |
| Keyboard type | ❌ | P2 | `pynput` | DANGEROUS — needs approval |
| Mouse click | ❌ | P2 | `pyautogui` | DANGEROUS — needs approval |
| Mouse move | ❌ | P2 | `pyautogui` | DANGEROUS — needs approval |
| Press hotkeys | ❌ | P2 | `pynput` | DANGEROUS — needs approval |
| Run shell command | ❌ | P1 | `asyncio.subprocess` | DANGEROUS + blocklist |
| File search | ❌ | P1 | `pathlib` + Everything | `search_files(pattern)` |
| File read (PDF/docx/xlsx) | ❌ | P1 | `pdfplumber` + `docx` + `openpyxl` | `read_file(path)` |
| Folder watch | ❌ | P2 | `watchdog` | `start_watching(path, callback)` |
| Security approval system | ❌ | P0 | `winotify` | Risk tiers + toast confirm |
| Audit log | ✅ | P1 | `logging` | Write to `jarvis_audit.log` |
| System tray icon | ❌ | P3 | `pystray` | Startup app indicator |
| Find & click (vision→action) | ❌ | P2 | `mss` + `litellm` + `pyautogui` | Vision → coords → click loop |

---

## 2. Browser Automation

| Capability | Status | Priority | Package | Implementation note |
|---|---|---|---|---|
| Navigate to URL | ❌ | P1 | `playwright` | `browser_navigate(url)` |
| Take page screenshot | ❌ | P1 | `playwright` | `browser_screenshot()` |
| Extract page text | ❌ | P1 | `playwright` | `browser_get_text(selector?)` |
| Click element | ❌ | P2 | `playwright` | DANGEROUS — needs approval |
| Fill form | ❌ | P2 | `playwright` | DANGEROUS — needs approval |
| Download file | ❌ | P2 | `playwright` | `browser_download(url, path)` |
| Run JavaScript | ❌ | P2 | `playwright` | DANGEROUS tier |
| AI-native task | ❌ | P1 | `browser-use` | `browser_ai_task(instruction)` |
| Web search | ✅ | P0 | `tavily-python` | Also used by brain tools |
| Web search fallback | ✅ | P1 | `duckduckgo-search` | No key required |
| Session persistence | ❌ | P2 | `playwright` | Persistent context per profile |
| Stealth mode | ❌ | P3 | `playwright-stealth` | Anti-bot detection |
| Network request intercept | ❌ | P3 | `playwright` | Ad blocking, custom headers |

---

## 3. Voice & Audio

| Capability | Status | Priority | Package | Implementation note |
|---|---|---|---|---|
| Wake word detection | ✅ | — | `openWakeWord` | Phase 4 complete |
| STT (cloud) | ✅ | — | `Pipecat` + Deepgram | Phase 4 complete |
| TTS (cloud) | ✅ | — | `Pipecat` + ElevenLabs | Phase 4 complete |
| TTS fallback (local) | ⚠️ | P2 | `piper-tts` | WARN in LogsWidget — not wired up |
| Voice UI orb animation | ✅ | — | Canvas + React | OrbRing.tsx |
| Full-duplex conversation | ✅ | — | `Pipecat` | Phase 4 |
| Voice activity detection | ✅ | — | `Pipecat` | Phase 4 |
| Noise suppression | ❌ | P2 | `pipecat-ai/silero-vad` | Optional improvement |
| Speaker diarization | ❌ | P3 | `pyannote.audio` | Multi-user identification |
| Audio playback (PC) | ❌ | P2 | `pycaw` / `playsound` | Play TTS response via PC speakers |

---

## 4. Memory & Knowledge

| Capability | Status | Priority | Package | Implementation note |
|---|---|---|---|---|
| Short-term conversation memory | ✅ | — | LangGraph state | Messages in graph state |
| Long-term semantic memory | 🔄 | P0 | `mem0ai` + ChromaDB | Phase 2 in progress |
| Entity extraction | 🔄 | P1 | `mem0ai` | Auto-extracts from conversations |
| Memory search | 🔄 | P1 | `mem0ai` | `memory.search(query)` |
| Memory update/delete | 🔄 | P2 | `mem0ai` | Maintenance tools |
| Memory browser widget (UI) | ⚠️ | P2 | React | MemoryWidget.tsx — needs real API |
| Web content ingestion | ❌ | P2 | `playwright` + `mem0ai` | Summarize + store web pages |
| Document ingestion | ❌ | P2 | `pdfplumber` + `mem0ai` | Read file → chunk → store |
| Knowledge graph | ❌ | P3 | `networkx` | Relationships between entities |

---

## 5. LLM Management

| Capability | Status | Priority | Package | Implementation note |
|---|---|---|---|---|
| Groq routing | ✅ | — | `litellm` | Current default |
| Gemini routing | ✅ | — | `litellm` | Current fallback |
| Multi-provider config | ❌ | P1 | `litellm` | litellm_config.yaml |
| Fallback chains | ❌ | P1 | `litellm` | On rate limit / error |
| Cost tracking | ❌ | P1 | `litellm` callbacks | Per-call cost to SQLite |
| Budget alerts | ❌ | P2 | custom | Telegram push at 80% spend |
| Model selection by task | ❌ | P1 | custom | `router.select_model(TaskType.X)` |
| Vision (image input) | ❌ | P1 | Gemini Flash | Already in provider, not wired |
| OpenRouter fallback | ❌ | P2 | `litellm` | Universal last-resort |
| Key rotation on rate limit | ❌ | P2 | custom | SecureKeyRingManager |
| Streaming | ✅ | — | `litellm` | Partial — in FastAPI |

---

## 6. Tool System

| Capability | Status | Priority | Package | Implementation note |
|---|---|---|---|---|
| Web search | ✅ | P0 | `tavily-python` | Core brain tool |
| Code execution (sandboxed) | ❌ | P1 | `docker` | Docker container, no network |
| Python REPL (local) | ❌ | P2 | `exec` + timeout | Fallback when no Docker |
| Calendar (Google) | ❌ | P2 | `google-api-python-client` | OAuth2 flow |
| Email (Gmail) | ❌ | P2 | `google-api-python-client` | OAuth2 flow |
| Email (Outlook) | ❌ | P3 | `msal` + Microsoft Graph | |
| Smart home (Home Assistant) | ❌ | P3 | `httpx` | HA REST API |
| Weather | ❌ | P2 | `httpx` + OpenWeatherMap | Free tier |
| News/RSS | ❌ | P2 | `feedparser` | Custom feed list |
| Wikipedia | ❌ | P2 | `wikipedia-api` | Quick factual lookup |
| Git operations | ❌ | P3 | `gitpython` | Commit, diff, status |
| Docker management | ❌ | P3 | `docker` SDK | List/start/stop containers |
| SQLite NL queries | ❌ | P3 | `sqlite3` + LLM | Text-to-SQL with safety check |
| MCP server integration | ❌ | P3 | `mcp` | External tool protocol |
| Telegram send | ✅ | — | `python-telegram-bot` | Phase 6 complete |
| Weather (OpenWeatherMap) | ✅ | P0 | httpx | src/brain/tools/weather.py |
| News/RSS | ✅ | P0 | feedparser | src/brain/tools/news.py |
| Wikipedia | ✅ | P0 | urllib | src/brain/tools/wikipedia_tool.py |
| Scheduled tasks (cron/interval) | ✅ | P0 | apscheduler | src/brain/scheduler.py |
| AI Providers UI editor | ✅ | P0 | React | ProvidersWidget.tsx |

---

## 7. Multi-Agent

| Capability | Status | Priority | Package | Implementation note |
|---|---|---|---|---|
| LangGraph planner | ✅ | — | `langgraph` | Phase 1 complete |
| Tool-calling loop | ✅ | — | `langgraph` | Phase 1 |
| Sub-agent spawning | ❌ | P2 | `langgraph` | Spawn specialized sub-graphs |
| Parallel task execution | ❌ | P2 | `asyncio` | Fan-out tool calls |
| Agent memory sharing | ❌ | P2 | `mem0ai` | Shared memory store |
| Self-improvement loop | ✅ | — | `mem0ai` | Phase 7 complete |
| MCP client (JARVIS as host) | ❌ | P3 | `mcp` | Connect to external MCP servers |

---

## 8. Proactive Behavior

| Capability | Status | Priority | Package | Implementation note |
|---|---|---|---|---|
| Scheduled tasks (cron) | ❌ | P2 | `apscheduler` | Time-based triggers |
| File change triggers | ❌ | P2 | `watchdog` | New download → auto-process |
| Calendar event reminder | ❌ | P3 | Google Calendar API | Alert N minutes before event |
| Telegram push | ✅ | — | `python-telegram-bot` | Phase 6 complete |
| PC heartbeat | ✅ | — | custom | Phase 6 complete |
| Anomaly detection | ❌ | P3 | custom | High CPU/RAM → alert |
| Context-aware suggestions | ❌ | P3 | Vision LLM | See screen → proactively help |

---

## 9. Security

| Capability | Status | Priority | Package | Implementation note |
|---|---|---|---|---|
| Risk tier classification | ❌ | P0 | custom | Safe/Medium/Dangerous/Blocked |
| Approval toast system | ❌ | P0 | `winotify` | Dangerous ops wait for user |
| Command blocklist | ❌ | P0 | custom | Hardcoded deny patterns |
| Audit log | ✅ | P1 | `logging` | All tool calls logged to file |
| HMAC message auth | ❌ | P0 | `hmac` + `hashlib` | Prevent spoofed commands |
| API key isolation | ✅ | — | `.env` + `dotenv` | Keys never hardcoded |
| File permission 0o600 | ✅ | — | `os.open` | Per CLAUDE.md rule |
| Secrets in env | ✅ | — | `.env` + `python-dotenv` | Per CLAUDE.md rule |

---

## 10. UI / Presentation

| Capability | Status | Priority | Package | Implementation note |
|---|---|---|---|---|
| Chat widget | ✅ | — | React | ChatWidget.tsx |
| Voice orb with animation | ✅ | — | Canvas + React | OrbRing.tsx |
| System stats widget (real data) | ⚠️ | P0 | `psutil` → WS | SysMonWidget — fake random |
| Live graph widget (real data) | ⚠️ | P1 | `psutil` → WS | GraphWidget — fake random |
| Memory viewer | ⚠️ | P2 | Mem0 API | MemoryWidget — needs real API |
| Log stream widget (real data) | ⚠️ | P1 | WS | LogsWidget — demo messages |
| Draggable / resizable widgets | ✅ | — | React | DraggableWidget.tsx |
| Spawn new widget instances | ✅ | — | React | useWidgetManager.ts |
| Color themes | ✅ | — | CSS vars | SettingsWidget.tsx |
| HUD corner brackets | ✅ | — | React | HudCorners.tsx |
| Auto-hide dock | ✅ | — | React | BottomDock.tsx |
| Keyboard shortcuts | ✅ | — | React | C/S/M/V/Esc |
| Right-click context menu | ✅ | — | React | OrbContextMenu |
| WebView widget | ✅ | — | React | WebViewWidget.tsx (iframe) |
| Media player widget | ✅ | — | React | MediaWidget.tsx |
| Clock widget | ✅ | — | React | ClockWidget.tsx |
| Notes widget | ✅ | — | React | NotesWidget.tsx |
| Mobile responsive | ❌ | P3 | CSS | Not optimized for touch |

---

## Summary

| Category | Total | Built ✅ | Partial ⚠️ | In Progress 🔄 | Missing ❌ |
|---|---|---|---|---|---|
| PC Control | 28 | 0 | 0 | 0 | 28 |
| Browser | 13 | 0 | 0 | 0 | 13 |
| Voice | 10 | 5 | 1 | 0 | 4 |
| Memory | 9 | 1 | 1 | 4 | 3 |
| LLM Mgmt | 11 | 3 | 0 | 0 | 8 |
| Tools | 15 | 1 | 0 | 0 | 14 |
| Multi-Agent | 7 | 3 | 0 | 0 | 4 |
| Proactive | 7 | 2 | 0 | 0 | 5 |
| Security | 8 | 3 | 0 | 0 | 5 |
| UI | 20 | 14 | 4 | 0 | 2 |
| **TOTAL** | **128** | **32** | **6** | **4** | **86** |

**32 built (25%), 86 missing (67%), 10 partial or in-progress.**
