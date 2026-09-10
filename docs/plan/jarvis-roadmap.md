# JARVIS Master Roadmap

> Comprehensive phase-by-phase plan for the full JARVIS personal AI operator.
> Deployment: Azure VM brain (2 vCPU / 8GB RAM) + Windows PC local agent.
> Last updated: 2026-09-10.

---

## Phase 0 ✅ — Foundation

**Goal:** Working skeleton — Python brain + Go watchdog keeping everything alive.

- Python brain skeleton (`src/brain/`)
- Go watchdog daemon (`src/watchdog/`) — supervises brain, auto-restarts on crash
- LiteLLM wired to Groq + Gemini
- `.env` secrets management
- Azure VM provisioned

**Done.**

---

## Phase 1 ✅ — Core Interface

**Goal:** JARVIS can receive text messages and respond via a web UI.

- LangGraph planner with tool-calling loop
- FastAPI server (`/chat` WebSocket endpoint)
- Node.js/TypeScript WebSocket gateway (`src/gateway/`)
- Next.js voice/chat UI (`src/website/`)
- Chat widget, system stats widget, memory viewer

**Done.**

---

## Phase 2 🔄 — Memory Layer

**Goal:** JARVIS remembers past conversations, facts, and context across sessions.

- Mem0 integration with SQLite-backed ChromaDB
- Auto-extract entities and store after each conversation
- `memory.search(query)` tool available in LangGraph
- Memory browser widget in UI shows stored facts
- Memory update/delete tools

**New dependencies:** `mem0ai`, `chromadb`

**Done criteria:**
- [ ] JARVIS remembers user name / preferences across restarts
- [ ] `memory.search("what did I say about X")` returns relevant results
- [ ] Memory widget shows real entries (not placeholders)

---

## Phase 3 — Tool System

**Goal:** JARVIS can search the web, execute code, and interact with external services.

- Web search: Tavily (primary) + DuckDuckGo (fallback)
- Sandboxed code execution: Docker container (no network, 256MB RAM, read-only FS)
- Calendar (Google Calendar v3 API, OAuth2)
- Email (Gmail API, OAuth2 — read + send)
- Weather (OpenWeatherMap free tier)
- News/RSS (`feedparser`)
- Wikipedia lookup

**New dependencies:** `tavily-python`, `duckduckgo-search`, `docker`, `google-api-python-client`, `google-auth-oauthlib`, `feedparser`, `wikipedia-api`

**Estimated effort:** 1 week

**Done criteria:**
- [ ] "What's the weather?" returns real weather
- [ ] "What's on my calendar tomorrow?" returns real events
- [ ] "Write and run this Python snippet" executes in sandbox and returns output
- [ ] "Search for..." returns structured web results

---

## Phase 4 ✅ — Voice Pipeline

**Goal:** JARVIS responds to voice with a Jarvis-style TTS voice.

- Pipecat STT → LLM → TTS pipeline
- openWakeWord wake-word detection
- WebSocket voice UI (OrbRing animation)
- ElevenLabs TTS with MCU Jarvis voice
- Full-duplex conversation

**Done.**

---

## Phase 5 ✅ — HUD Dashboard

**Goal:** Iron Man-style heads-up display showing JARVIS status.

- Orb widget with idle/listening/thinking/speaking states
- System stats widget (HUD layout)
- Spend/task/memory/alert panels
- Draggable, resizable widgets
- Spawnable widget system (clock, notes, graph, logs, media, webview)
- Color themes

**Done.**

---

## Phase 6 ✅ — Proactive Reporting

**Goal:** JARVIS can push notifications to user's phone and report PC worker status.

- Telegram bot push notifications
- PC worker heartbeat (brain → PC keepalive)
- Push alerts for: high CPU, task completion, errors, reminders

**Done.**

---

## Phase 7 ✅ — Learning Loop

**Goal:** JARVIS learns from its mistakes and improves over time.

- Retry/failure outcomes logged to Mem0
- Tool success/failure rates tracked
- Failed patterns fed back into planner context
- Self-reflection after failed tasks

**Done.**

---

## Phase 8 — PC Agent (NEW — NEXT PRIORITY)

**Goal:** JARVIS can control the user's Windows PC remotely from the Azure brain.

**Key deliverables:**
- `src/pc_agent/` — asyncio WebSocket client running on PC
- App launch, close, window management
- Screenshot + Vision LLM screen understanding
- Real system stats flowing to UI (replacing fake data)
- Browser automation via playwright + browser-use
- File search and document reading
- Sandboxed shell command execution
- Security approval system (toast for dangerous ops)
- Audit log of all tool calls
- Windows startup registration

**New dependencies (PC agent only):**
`pyautogui`, `pygetwindow`, `pywin32`, `pynput`, `mss`, `Pillow`, `psutil`, `pycaw`, `winotify`, `playwright`, `browser-use`, `watchdog`, `pdfplumber`, `python-docx`, `openpyxl`, `pystray`

**Estimated effort:** 2 weeks

**See:** `docs/plan/phase8-pc-agent.md` for full spec.

**Done criteria:** See phase 8 plan.

---

## Phase 9 — LLM Provider Management (NEW)

**Goal:** JARVIS intelligently routes requests to the best LLM for each task, with cost tracking and fallbacks.

**Key deliverables:**
- `src/brain/litellm_config.yaml` — full provider config with aliases
- `src/brain/llm/router.py` — task-type → model selection
- `src/brain/llm/key_manager.py` — key rotation, budget tracking, circuit breakers
- OpenRouter as universal fallback
- Cost tracking to SQLite
- Budget alerts via Telegram at 80% monthly spend
- Model aliases: `jarvis-fast`, `jarvis-vision`, `jarvis-long`, `jarvis-smart`, `jarvis-reason`

**New dependencies:** `litellm[proxy]>=1.40.0` (already have litellm)

**Estimated effort:** 3 days

**See:** `docs/research/llm-providers.md`

---

## Phase 10 — Smart Context (NEW)

**Goal:** JARVIS is always aware of what's on the user's screen and can proactively help.

**Key deliverables:**
- Background screen poller: captures screen every N seconds when JARVIS is idle
- Active window title injected into every conversation context
- Clipboard content available as context
- "What am I looking at?" shortcut (hotkey → vision → spoken summary)
- Context-aware suggestions: JARVIS notices you're stuck on a bug and offers help

**Dependencies:** Already have mss + Gemini Vision from Phase 8.

**Estimated effort:** 1 week

---

## Phase 11 — Smart Home (NEW)

**Goal:** JARVIS controls smart home devices via Home Assistant.

**Key deliverables:**
- Home Assistant REST API tool (`ha_call_service(domain, service, entity_id)`)
- Device list / state query
- Common automations: lights on/off/dim, climate set-temp, lock/unlock, media player
- Natural language: "turn off the lights in the bedroom"

**New dependencies:** `httpx`

**Estimated effort:** 3 days

---

## Phase 12 — Multi-Agent Orchestration (NEW)

**Goal:** JARVIS spawns specialized sub-agents for complex tasks and runs them in parallel.

**Key deliverables:**
- LangGraph multi-agent: Coordinator spawns Research, Code, Browse, File sub-agents
- Parallel tool call fan-out (asyncio.gather)
- Shared memory across agents (Mem0)
- MCP server integration (JARVIS as MCP host — connect to Claude Code, GitHub Copilot, etc.)
- Task queue for long-running jobs

**New dependencies:** `mcp`

**Estimated effort:** 2 weeks

---

## Phase 13 — Self-Improvement (Ongoing)

**Goal:** JARVIS gets smarter over time without manual tuning.

**Key deliverables:**
- Skill forge: when JARVIS encounters a capability gap, it auto-creates a new tool (already partially in `.claude/agents/skill-forger`)
- Performance analytics: track response quality, latency, cost per task type
- Prompt A/B testing: try prompt variants, measure which gets better outcomes
- Memory quality scoring: prune low-value memories
- Weekly self-report: Telegram summary of what JARVIS learned

**Estimated effort:** Ongoing, incremental

---

## Priority Matrix

| Phase | Category | Effort | Value | Recommended order |
|---|---|---|---|---|
| 8 — PC Agent | PC Control | XL | Critical | 1st |
| 9 — LLM Management | Infrastructure | S | High | 2nd (can do in parallel with 8) |
| 2 — Memory (complete) | Memory | M | Critical | 3rd |
| 3 — Tool System | Tools | L | High | 4th |
| 10 — Smart Context | UX | M | Medium | 5th |
| 11 — Smart Home | Integration | S | Medium | 6th |
| 12 — Multi-Agent | Architecture | XL | Medium | 7th |
| 13 — Self-Improvement | Quality | ongoing | High | Ongoing |

---

## Next 3 Sprints

### Sprint 1 (Week 1–2): PC Agent + Real Data
1. `src/pc_agent/security.py` + `src/pc_agent/tools/screen.py` + `src/pc_agent/tools/system.py`
2. `src/pc_agent/main.py` WebSocket client with dispatch
3. `src/brain/tools/pc_agent_client.py` brain-side RPC
4. Wire `psutil` stats to `SysMonWidget` + `GraphWidget` (replace fake data)
5. Wire real brain logs to `LogsWidget`
6. `src/pc_agent/tools/windows.py` — app launch/close/focus
7. `src/pc_agent/tools/browser.py` — playwright + Tavily search

### Sprint 2 (Week 3): LLM Routing + Memory Completion
1. `src/brain/litellm_config.yaml` with full provider list
2. `src/brain/llm/router.py` — task type → model selection
3. `src/brain/llm/key_manager.py` — budget + rotation
4. Complete Mem0 Phase 2 integration + wire to MemoryWidget
5. Add budget alerts via Telegram

### Sprint 3 (Week 4): Tool System
1. Tavily web search as LangGraph tool
2. DuckDuckGo fallback
3. Sandboxed code execution (Docker)
4. Calendar + email (Google OAuth)
5. Weather + news RSS
