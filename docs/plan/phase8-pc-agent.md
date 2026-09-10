# Phase 8 — Windows PC Agent

## Goal

Build a local Windows service that runs on the user's PC and exposes remote-control capabilities (screenshot, app launch, browser, file ops, system stats, shell) to the Azure brain via an authenticated WebSocket connection — turning JARVIS into a real PC operator.

---

## Architecture

```
Azure VM (FastAPI brain)
    │
    │  WebSocket client: src/brain/tools/pc_agent_client.py
    │  calls: await pc.call("screenshot", {})
    │
    ▼
Internet (ngrok / Cloudflare Tunnel / Azure Relay)
    │
    ▼
Windows PC (asyncio WebSocket server: src/pc_agent/main.py)
    │  auth: HMAC-SHA256 on every message (JARVIS_PC_TOKEN)
    │  risk tier: safe / medium / dangerous / blocked
    │  approval: winotify toast for dangerous tier (10s timeout)
    ▼
Windows OS
    pyautogui · pygetwindow · win32gui · pynput · mss
    psutil · pycaw · winotify · playwright · watchdog
```

### Connection model

The PC agent **connects outbound** to the Azure brain (not the other way around). This avoids port-forwarding and works behind NAT.

```
PC agent → wss://jarvis.yourdomain.com/pc-ws
                ↑
           Azure FastAPI: @app.websocket("/pc-ws")
```

---

## Message Protocol

### Request (brain → PC, over the persistent WebSocket)

```json
{
  "id":   "req_abc123",
  "tool": "screenshot",
  "args": {},
  "sig":  "hmac-sha256-hex"
}
```

### Response (PC → brain)

```json
{
  "id":      "req_abc123",
  "ok":      true,
  "result":  { "b64_jpeg": "...", "width": 960, "height": 540 },
  "elapsed_ms": 42
}
```

### Error response

```json
{
  "id":    "req_abc123",
  "ok":    false,
  "error": "Approval denied by user"
}
```

### Heartbeat (PC → brain, every 30s)

```json
{
  "type": "heartbeat",
  "ts":   "2026-09-10T14:23:00Z",
  "stats": { "cpu_pct": 12.3, "ram_pct": 45.1 }
}
```

---

## New Files to Create

### `src/pc_agent/__init__.py`
Empty module marker.

### `src/pc_agent/main.py`
Entry point. Asyncio loop:
1. Connect to `JARVIS_BRAIN_WS_URL` with `Authorization: Bearer JARVIS_PC_TOKEN`
2. Reconnect with exponential backoff on disconnect
3. Receive JSON messages, verify HMAC, dispatch to tool handlers
4. Return result or approval-denied error
5. Send heartbeat every 30s
6. Start system tray icon in background thread

Key functions: `main()`, `dispatch(msg)`, `reconnect_loop()`

### `src/pc_agent/security.py`
Risk tier classification and approval system.

```python
TIERS = {
    "safe":      {...tool names},
    "medium":    {...tool names},
    "dangerous": {...tool names},
    "blocked":   {...tool names},
}

def classify(tool_name: str) -> str: ...
async def request_approval(action_id, action, detail, timeout=10) -> bool: ...
def sign_message(msg: dict) -> str: ...
def verify_message(msg: dict) -> bool: ...
```

### `src/pc_agent/audit.py`
Append-only audit log at `%APPDATA%\JARVIS\audit.log`.

```python
def log(tool: str, args: dict, tier: str, approved: bool, result_ok: bool, elapsed_ms: int): ...
```

### `src/pc_agent/tools/__init__.py`
Tool registry: `TOOLS = {"screenshot": {"fn": ..., "tier": "safe"}, ...}`

### `src/pc_agent/tools/screen.py`

| Function | Description |
|---|---|
| `capture_screen(monitor=1) -> str` | Base64 JPEG via mss |
| `list_monitors() -> list[dict]` | Monitor info |
| `understand_screen(question: str) -> str` | mss → Gemini Flash Vision |
| `find_and_click(target: str) -> bool` | Vision → coords → pyautogui.click |

### `src/pc_agent/tools/windows.py`

| Function | Description |
|---|---|
| `list_windows() -> list[dict]` | All visible windows (title, hwnd, pid) |
| `get_active_window() -> dict` | Currently focused window |
| `focus_window(title: str) -> bool` | Bring window to front |
| `open_app(name: str, args=[]) -> bool` | Launch by alias or exe path |
| `close_app(name: str) -> bool` | Terminate by name |
| `open_file(path: str) -> None` | os.startfile |
| `open_url(url: str, browser="chrome") -> None` | Launch browser at URL |

### `src/pc_agent/tools/input.py`

| Function | Description |
|---|---|
| `type_text(text: str) -> None` | pynput keyboard — supports Unicode |
| `mouse_click(x, y, button="left") -> None` | pyautogui click |
| `mouse_move(x, y) -> None` | pyautogui move |
| `press_keys(keys: list[str]) -> None` | e.g. ["ctrl", "c"] |
| `scroll(dx=0, dy=-3) -> None` | pyautogui scroll |

All functions in this module are **dangerous tier**.

### `src/pc_agent/tools/system.py`

| Function | Description |
|---|---|
| `get_stats() -> dict` | cpu/ram/disk/net via psutil |
| `list_top_processes(n=8) -> list[dict]` | Top by CPU |
| `kill_process(name: str) -> bool` | psutil terminate |
| `set_volume(level: float) -> None` | pycaw 0.0–1.0 |
| `get_volume() -> float` | pycaw |
| `mute(state: bool) -> None` | pycaw |
| `get_clipboard() -> str` | pyperclip |
| `set_clipboard(text: str) -> None` | pyperclip |
| `send_notification(title, body) -> None` | winotify toast |

### `src/pc_agent/tools/files.py`

| Function | Description |
|---|---|
| `search_files(pattern, root="C:/Users") -> list[str]` | Everything CLI or pathlib.rglob |
| `read_file(path, max_chars=8000) -> str` | PDF/docx/xlsx/txt |
| `write_file(path, content) -> None` | DANGEROUS tier |
| `delete_file(path) -> None` | DANGEROUS tier |
| `start_watch(path, callback) -> Observer` | watchdog folder monitor |

### `src/pc_agent/tools/browser.py`

| Function | Description |
|---|---|
| `browser_navigate(url) -> dict` | playwright goto, return title |
| `browser_screenshot(full_page=False) -> str` | base64 PNG |
| `browser_get_text(selector=None) -> str` | inner_text |
| `browser_click(selector) -> None` | DANGEROUS |
| `browser_fill(selector, text) -> None` | DANGEROUS |
| `browser_download(url, path) -> dict` | file download |
| `browser_ai_task(instruction) -> str` | browser-use agent |
| `search_web(query, max_results=5) -> list[dict]` | Tavily → DuckDuckGo |

### `src/pc_agent/tools/discord_tool.py`

Two-layer approach: RPC for safe presence/voice ops, CDP for full message control.

| Function | Tier | Method | Description |
|---|---|---|---|
| `discord_send(channel_id, text) -> bool` | dangerous | CDP | Type + Enter in focused channel |
| `discord_read(channel_id, n=20) -> list[dict]` | medium | CDP | Read last N messages via JS |
| `discord_set_status(status) -> None` | medium | RPC | online/idle/dnd/invisible |
| `discord_mute(state) -> None` | medium | RPC | Mute/unmute self in VC |
| `discord_deafen(state) -> None` | medium | RPC | Deafen/undeafen self |
| `discord_join_vc(channel_id) -> None` | medium | RPC | Join voice channel |
| `discord_get_guilds() -> list[dict]` | safe | RPC | List servers |
| `discord_get_channels(guild_id) -> list[dict]` | safe | RPC | List channels |

**Setup required**: add `--remote-debugging-port=9222` to Discord shortcut. One-time.
Also create a free Discord application at discord.com/developers for the RPC client ID.

```python
# pip install pypresence playwright
# RPC — for voice/presence
from pypresence import Client
rpc = Client(client_id=os.environ["DISCORD_CLIENT_ID"])
await rpc.start()

# CDP — for full message access
from playwright.async_api import async_playwright
async with async_playwright() as p:
    browser = await p.chromium.connect_over_cdp("http://localhost:9222")
    page = browser.contexts[0].pages[0]
    await page.keyboard.type(text)
    await page.keyboard.press("Enter")
```

### `src/pc_agent/tools/whatsapp_tool.py`

CDP approach (desktop app) + optional Baileys Node sidecar for reliability.

| Function | Tier | Method | Description |
|---|---|---|---|
| `wa_send(contact, text) -> bool` | dangerous | CDP | Search contact → open chat → send |
| `wa_read(contact, n=20) -> list[dict]` | medium | CDP | Read last N messages via JS |
| `wa_send_file(contact, path) -> bool` | dangerous | CDP | Attach + send a file |
| `wa_get_contacts() -> list[str]` | safe | CDP | List recent chats |

**Setup required**: add `--remote-debugging-port=9223` to WhatsApp shortcut. One-time.

```python
# WhatsApp data-testid selectors (stable across versions):
# Search box:    [data-testid="search"]
# Chat input:    [data-testid="conversation-compose-box-input"]  
# Send button:   [data-testid="send"]
# Messages:      [data-testid="msg-container"]

async def wa_send(contact: str, text: str) -> bool:
    browser = await p.chromium.connect_over_cdp("http://localhost:9223")
    page = browser.contexts[0].pages[0]
    await page.click('[data-testid="search"]')
    await page.keyboard.type(contact)
    await page.wait_for_selector('[data-testid="cell-frame-title"]')
    await page.click('[data-testid="cell-frame-title"]')
    await page.click('[data-testid="conversation-compose-box-input"]')
    await page.keyboard.type(text)
    await page.keyboard.press("Enter")
    return True
```

**Alternative — Baileys Node sidecar** (more reliable, no desktop app needed):
```bash
# src/pc_agent/baileys_bridge/index.js — tiny Express server
# JARVIS calls POST /send {to, text} → Baileys sends via WhatsApp Web protocol
# Scan QR code once → stays authenticated
npm install @whiskeysockets/baileys express
```

### `src/pc_agent/tools/shell.py`

| Function | Description |
|---|---|
| `run_command(cmd, timeout=30) -> dict` | asyncio subprocess with blocklist |

### `src/pc_agent/requirements.txt`
See full list in `docs/research/pc-control.md` section 16.

### `src/pc_agent/install.bat`
Registers a Windows Task Scheduler task to run `main.py` at user logon.

```batch
@echo off
schtasks /create ^
  /tn "JARVIS PC Agent" ^
  /tr "pythonw C:\jarvis\src\pc_agent\main.py" ^
  /sc onlogon /rl limited /f
echo JARVIS PC Agent registered for startup.
```

---

## Brain-Side Changes

### `src/brain/tools/pc_agent_client.py`

Thin RPC client the LangGraph brain uses to call PC tools:

```python
import asyncio, json, hmac, hashlib, os, uuid
import websockets

class PCAgentClient:
    def __init__(self):
        self._ws = None
        self._pending: dict[str, asyncio.Future] = {}

    async def connect(self):
        url = os.environ["JARVIS_PC_WS_URL"]
        token = os.environ["JARVIS_PC_TOKEN"]
        self._ws = await websockets.connect(url, extra_headers={"Authorization": f"Bearer {token}"})
        asyncio.create_task(self._receive_loop())

    async def call(self, tool: str, args: dict, timeout: float = 30.0) -> dict:
        if not self._ws:
            raise RuntimeError("PC agent not connected")
        req_id = f"req_{uuid.uuid4().hex[:8]}"
        msg = {"id": req_id, "tool": tool, "args": args}
        msg["sig"] = self._sign(msg)
        fut = asyncio.get_event_loop().create_future()
        self._pending[req_id] = fut
        await self._ws.send(json.dumps(msg))
        return await asyncio.wait_for(fut, timeout=timeout)

    async def _receive_loop(self):
        async for raw in self._ws:
            data = json.loads(raw)
            if fut := self._pending.pop(data.get("id"), None):
                fut.set_result(data)

    def _sign(self, msg: dict) -> str:
        payload = json.dumps({k: v for k, v in msg.items() if k != "sig"}, sort_keys=True)
        return hmac.new(os.environ["JARVIS_PC_TOKEN"].encode(), payload.encode(), hashlib.sha256).hexdigest()

pc_agent = PCAgentClient()
```

### LangGraph tool registration

Add these as LangGraph tools in `src/brain/tools/__init__.py`:
- `take_screenshot` → `pc_agent.call("screenshot", {})`
- `open_app` → `pc_agent.call("open_app", {"name": name})`
- `search_files` → `pc_agent.call("search_files", {"pattern": pattern})`
- `understand_screen` → `pc_agent.call("understand_screen", {"question": q})`
- `run_command` → `pc_agent.call("run_command", {"cmd": cmd})` (approval on PC side)
- `search_web` → `pc_agent.call("search_web", {"query": query})`

---

## Security Implementation

### Risk tiers

| Tier | Operations | Policy |
|---|---|---|
| 🟢 Safe | screenshot, list_windows, get_stats, get_clipboard, list_files, understand_screen, list_processes, search_web | Auto-execute, audit log |
| 🟡 Medium | open_app, open_url, close_app, focus_window, set_clipboard, read_file, set_volume, send_notification, browser_navigate, browser_screenshot, browser_get_text | Auto-execute, audit log |
| 🔴 Dangerous | type_text, mouse_click, run_command, kill_process, delete_file, browser_fill, browser_click, browser_run_js, write_file | Require winotify toast approval (10s timeout → deny) |
| ⛔ Blocked | `format`, `del /f /s`, `rd /s /q /f`, `reg delete`, `bcdedit`, `diskpart`, `shutdown`, `net user` | Hardcoded deny — never execute |

### Audit log format

```
2026-09-10T14:23:01Z  screenshot     safe       AUTO    ok      38ms
2026-09-10T14:23:15Z  run_command    dangerous  APPROVE ok     1240ms    {"cmd": "dir C:\\"}
2026-09-10T14:24:01Z  type_text      dangerous  DENY    skip      0ms    approval timeout
```

---

## Implementation Order

| # | Task | Effort | Depends on |
|---|---|---|---|
| 1 | `src/pc_agent/security.py` — HMAC verify + approval stub | S | — |
| 2 | `src/pc_agent/tools/screen.py` — mss screenshot | S | — |
| 3 | `src/pc_agent/tools/system.py` — psutil stats | S | — |
| 4 | `src/pc_agent/main.py` — WebSocket server skeleton, dispatch | M | 1, 2, 3 |
| 5 | `src/brain/tools/pc_agent_client.py` — brain-side RPC client | S | 4 |
| 6 | Wire psutil stats → SysMonWidget/GraphWidget via WebSocket | S | 3, 5 |
| 7 | Wire real logs from brain → LogsWidget | S | 5 |
| 8 | `src/pc_agent/tools/windows.py` — app launch/close/focus | M | 4 |
| 9 | `src/pc_agent/tools/browser.py` — playwright + search_web | M | 4 |
| 10 | `src/pc_agent/tools/files.py` — search + read | M | 4 |
| 11 | `src/pc_agent/tools/input.py` — keyboard/mouse (DANGEROUS) | S | 1, 4 |
| 12 | `src/pc_agent/audit.py` — audit log | S | 4 |
| 13 | Winotify approval toast (with approval callback) | M | 1 |
| 14 | System tray (pystray) | S | 4 |
| 15 | `install.bat` Task Scheduler registration | S | 4 |
| 16 | Register PC tools in LangGraph brain | M | 5, 8, 9, 10 |
| 17 | `understand_screen` Vision LLM integration | S | 2 |
| 18 | `find_and_click` vision→action loop | M | 17 |

---

## Testing

Test each tool locally without Azure:

```python
# test_pc_agent_local.py
import asyncio
from src.pc_agent.tools.screen import capture_screen
from src.pc_agent.tools.system import get_stats
from src.pc_agent.tools.windows import list_windows, open_app

async def test_all():
    b64 = capture_screen()
    print(f"Screenshot: {len(b64)} chars")

    stats = get_stats()
    print(f"Stats: CPU {stats['cpu_pct']}% RAM {stats['ram_pct']}%")

    windows = list_windows()
    print(f"Windows: {[w['title'][:30] for w in windows[:5]]}")

    open_app("notepad")
    await asyncio.sleep(1)

asyncio.run(test_all())
```

For the WebSocket integration:

```bash
# Start PC agent locally (it will try to connect to brain WS URL)
JARVIS_BRAIN_WS_URL=ws://localhost:8000/pc-ws \
JARVIS_PC_TOKEN=test_token \
python src/pc_agent/main.py
```

---

## Done Criteria

- [ ] PC agent connects to Azure brain and authenticates with HMAC
- [ ] `screenshot` returns a real screen capture
- [ ] `get_stats` returns real CPU/RAM/disk from psutil
- [ ] `open_app("chrome")` launches Chrome
- [ ] `open_url("https://github.com")` opens URL in browser
- [ ] `search_web("JARVIS AI")` returns 5 real results
- [ ] `run_command("dir C:\\")` shows winotify toast and executes after approval
- [ ] Dangerous commands from blocklist are rejected with error
- [ ] SysMonWidget + GraphWidget show real data (no more fake random)
- [ ] LogsWidget shows real brain logs
- [ ] Audit log written to `%APPDATA%\JARVIS\audit.log`
- [ ] Agent restarts automatically after disconnect
- [ ] install.bat registers startup task
