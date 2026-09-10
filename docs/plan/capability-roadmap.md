# JARVIS Capability Roadmap

> Synthesized from multi-agent research (fork + gemini CLI). 47 discrete new tools across 8 domains.
> Phases are additive — each builds on the previous.

---

## Current State (Phases 0–7 complete)

- LangGraph brain + FastAPI server + Node gateway + Next.js UI
- Groq + Gemini LLM routing via LiteLLM
- Mem0 + ChromaDB memory layer
- Pipecat voice pipeline (STT → LLM → TTS)
- Telegram push notifications + PC worker heartbeat
- HUD dashboard (spend/tasks/memory/alerts)

**Gaps**: No web search, no PC control, no calendar/email, no code execution, no file reading, no browser automation.

---

## Phase 8 — PC Agent (Priority: P0, ~2 weeks)

The home PC runs `src/pc_agent/` which connects OUT to Azure via WSS. Azure brain sends tool calls, PC executes, result flows back.

| Task | Effort | Risk |
|---|---|---|
| WebSocket server on PC (port 9090) | 6h | LOW |
| Screenshot + system stats (real UI data) | 4h | LOW |
| open_app, open_url, list_windows, focus_window | 4h | LOW-MED |
| Windows toast notifications (winotify) | 1h | LOW |
| Clipboard read/write (pyperclip) | 1h | LOW |
| Audio volume control (pycaw) | 2h | LOW |
| Wire SysMonWidget + GraphWidget to real psutil data | 3h | LOW |
| Kill process + run_command (with Telegram approval) | 4h | HIGH |

**New source tree**: `src/pc_agent/` — see `docs/plan/phase8-pc-agent.md`.

---

## Phase 9 — Web & Research Tools (Priority: P0, ~1 week)

| Task | Package | Effort |
|---|---|---|
| Tavily web search tool | `tavily-python` | 3h |
| Playwright scraper (headless) | `playwright` | 4h |
| Jina Reader (no-browser markdown extract) | `aiohttp` | 1h |
| browser-use AI browser agent | `browser-use` | 6h |
| Weather (OpenWeatherMap) | `aiohttp` | 2h |
| RSS/news feeds | `feedparser` | 1h |
| Stock prices | `yfinance` | 1h |
| YouTube transcripts | `youtube-transcript-api` | 1h |

```python
# Quick win: add to src/brain/tools/web_search.py
from tavily import TavilyClient
from duckduckgo_search import DDGS

async def search(query: str, provider: str = "tavily") -> list[dict]:
    if provider == "tavily":
        return TavilyClient(api_key=os.environ["TAVILY_API_KEY"]) \
               .search(query, max_results=5)["results"]
    with DDGS() as ddgs:                          # free fallback
        return list(ddgs.text(query, max_results=5))
```

---

## Phase 10 — LLM Expansion (Priority: P0, ~3 days)

Add to `src/brain/litellm_config.yaml` — zero code changes required.

| Provider | Model | Use case | Effort |
|---|---|---|---|
| Anthropic Claude | claude-3-5-sonnet | Coding, complex instructions | 1h |
| DeepSeek | deepseek-chat | Cheapest smart fallback | 1h |
| Perplexity | sonar-pro | Search-native LLM responses | 1h |
| Ollama (local) | llama3.2 | Offline fallback on home PC | 2h |
| GPT-4o (OpenAI) | gpt-4o | Best vision model | 1h |
| xAI Grok | grok-2 | Real-time knowledge | 1h |

Model routing logic lives in `src/brain/llm_router.py` — `select_model(task_type, has_image)`.

---

## Phase 11 — Productivity Integrations (Priority: P0, ~2 weeks)

### Google Workspace (6h total)
```python
# pip install google-api-python-client google-auth-oauthlib
# OAuth2 one-time setup → token.json stored with os.open(..., 0o600)
from googleapiclient.discovery import build

# Calendar: read next 10 events
service = build("calendar", "v3", credentials=creds)
events = service.events().list(calendarId="primary", maxResults=10,
    singleEvents=True, orderBy="startTime",
    timeMin=datetime.utcnow().isoformat()+"Z").execute()

# Gmail: send email
import base64
from email.mime.text import MIMEText
msg = MIMEText(body); msg["to"] = to; msg["subject"] = subject
service.users().messages().send(userId="me",
    body={"raw": base64.urlsafe_b64encode(msg.as_bytes()).decode()}).execute()
```

### GitHub (3h)
```python
# pip install PyGithub
from github import Github
g = Github(os.environ["GITHUB_TOKEN"])
# list issues, create issues, search code, get file contents
```

### Notion (4h)
```python
# pip install notion-client
from notion_client import AsyncClient
notion = AsyncClient(auth=os.environ["NOTION_TOKEN"])
await notion.search(query="project notes")
```

### Safe Code Execution (4h)
```python
# Subprocess with timeout (quick)
# Docker sandbox with network_mode="none" (secure, P1)
result = subprocess.run(["python", "-c", code],
    capture_output=True, text=True, timeout=10)
```

---

## Phase 12 — Advanced PC Control (Priority: P1, ~2 weeks)

| Task | Package | Notes |
|---|---|---|
| Keyboard/mouse (pyautogui) | `pyautogui` | Already in Phase 8 — extend |
| Screen understanding (vision LLM) | `mss` + GPT-4o | Screenshot → LLM → action |
| AI browser agent | `browser-use` | Natural language → browser clicks |
| Home Assistant | `httpx` | REST API, Long-Lived Access Token |
| Spotify playback control | `spotipy` | OAuth2, requires active device |

```python
# Screen understanding loop
async def screen_action(instruction: str):
    shot = take_screenshot()
    action = await vision_llm(shot["image_b64"], instruction)
    # parse action → execute (click/type/scroll)
```

---

## Phase 13 — Communication (Priority: P1, ~1 week)

| Channel | Package | Effort |
|---|---|---|
| Email SMTP send | `aiosmtplib` | 2h |
| Discord bot | `discord.py` | 3h |
| Slack bot | `slack_sdk` | 3h |
| WhatsApp (Twilio SMS fallback) | `twilio` | 2h |

---

## Phase 14 — Data & File Operations (Priority: P1, ~1 week)

| Capability | Package | Notes |
|---|---|---|
| PDF reading | `pdfplumber` | Up to 10 pages default |
| Word doc reading | `python-docx` | Extracts paragraphs |
| Excel reading | `openpyxl` | Sheet/cell matrix |
| File search (Windows) | `subprocess` + Everything SDK | `es.exe` for instant search |
| SQLite NL query | `sqlite3` (stdlib) + LLM | Read-only mode, LLM generates SQL |
| Git operations | `gitpython` | status, diff, commit, branch |
| Docker management | `docker` | list/start/stop containers |
| SSH remote execution | `paramiko` | For Azure VM management |

---

## New Source Directories

```
src/
├── pc_agent/               ← Phase 8
│   ├── server.py           WebSocket server (port 9090)
│   ├── capabilities/
│   │   ├── apps.py
│   │   ├── input.py
│   │   ├── screen.py
│   │   ├── audio.py
│   │   ├── system.py
│   │   └── notify.py
│   └── service.py          Windows startup service
│
├── brain/tools/            ← Phase 9–14 (expand existing)
│   ├── web_search.py       Tavily + DuckDuckGo
│   ├── browser.py          Playwright + Jina + browser-use
│   ├── code_exec.py        Python + shell sandbox
│   ├── files.py            PDF/Word/Excel/git/docker
│   ├── calendar.py         Google Calendar + Gmail
│   ├── github_tool.py      PyGithub
│   ├── smart_home.py       Home Assistant + Spotify
│   ├── comms.py            Email/Discord/Slack
│   └── pc_proxy.py         Relay commands to pc_agent via WS
│
└── brain/
    └── llm_router.py       ← Phase 10: add all providers
```

---

## Priority Summary

```
P0 (build next):  Phase 8 PC Agent + Phase 9 Web Search + Phase 10 LLM Expansion
P1 (build after): Phase 11 Productivity + Phase 12 Advanced PC
P2 (backlog):     Phase 13 Communication + Phase 14 Data & Files
```

Total estimated effort: ~120h across 7 phases (Phases 8–14).
