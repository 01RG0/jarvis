# JARVIS PC Control — Research & Implementation Reference

> Windows PC remote control capabilities for the local PC agent component.
> The PC agent runs on the user's Windows machine and receives commands from the Azure brain via WebSocket.

---

## 1. Azure ↔ PC Communication Protocol

### Recommendation: WebSocket (secure, authenticated)

| Protocol | Latency | Bidirectional | Firewall-friendly | Complexity |
|---|---|---|---|---|
| WebSocket (wss://) | ~5ms LAN / ~50ms WAN | ✅ | ✅ (port 443) | Low |
| MQTT | ~10ms | ✅ | ✅ | Medium (needs broker) |
| gRPC | ~2ms | ✅ | ❌ (custom port) | High |
| REST HTTP | ~50ms | ❌ | ✅ | Low |

**Winner: WebSocket** — already in the JARVIS stack, low latency, no broker needed, works through NAT with a reverse tunnel (ngrok / Cloudflare Tunnel / Azure Relay).

### Architecture

```
Azure Brain (FastAPI)
    │  wss://pc-agent.yourdomain.com/ws
    │  Bearer token auth (JARVIS_PC_TOKEN env var)
    ▼
PC Agent (Python asyncio WebSocket client → connects out to Azure)
    │  receives JSON command messages
    │  executes locally
    │  streams back results / screenshots
    ▼
Windows OS
```

### Message protocol

```json
// Request (Azure → PC)
{
  "id": "req_abc123",
  "tool": "screenshot",
  "args": {},
  "sig": "hmac-sha256-of-body"
}

// Response (PC → Azure)
{
  "id": "req_abc123",
  "ok": true,
  "result": { "b64_png": "..." },
  "elapsed_ms": 42
}

// Error response
{
  "id": "req_abc123",
  "ok": false,
  "error": "Approval denied by user"
}
```

### Auth — HMAC signature on every message

```python
import hmac, hashlib, json, os

SECRET = os.environ["JARVIS_PC_TOKEN"]

def sign(msg: dict) -> str:
    payload = json.dumps({k: v for k, v in msg.items() if k != "sig"}, sort_keys=True)
    return hmac.new(SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()

def verify(msg: dict) -> bool:
    expected = sign(msg)
    return hmac.compare_digest(msg.get("sig", ""), expected)
```

---

## 2. pyautogui — Mouse, keyboard, screenshots

```
pip install pyautogui
```

- **Risk:** MEDIUM — can type into any window
- **Admin:** No

```python
import pyautogui

pyautogui.FAILSAFE = True   # move mouse to corner to abort

# Click at screen coords
pyautogui.click(960, 540)

# Type text with natural delay
pyautogui.typewrite("Hello JARVIS", interval=0.05)

# Take screenshot, return as PIL Image
img = pyautogui.screenshot()
img.save("screen.png")

# Press hotkey
pyautogui.hotkey("ctrl", "c")

# Scroll
pyautogui.scroll(-3, x=500, y=400)  # scroll down 3 clicks at position

# Get screen size
w, h = pyautogui.size()
```

---

## 3. pygetwindow — Window listing and management

```
pip install pygetwindow
```

- **Risk:** SAFE
- **Admin:** No

```python
import pygetwindow as gw

# List all visible window titles
titles = gw.getAllTitles()

# Focus a window by partial title match
wins = gw.getWindowsWithTitle("Visual Studio Code")
if wins:
    w = wins[0]
    w.activate()
    w.maximize()

# Move and resize
w.moveTo(0, 0)
w.resizeTo(1280, 720)

# Minimize / restore
w.minimize()
w.restore()

# Get active window info
active = gw.getActiveWindow()
print(active.title, active.left, active.top, active.width, active.height)
```

---

## 4. win32gui + win32api — Deep Windows control

```
pip install pywin32
```

- **Risk:** MEDIUM–DANGEROUS
- **Admin:** Some operations require elevation (sending messages to elevated windows)

```python
import win32gui, win32con, win32api

# Enumerate all windows with process info
def list_windows() -> list[dict]:
    result = []
    def cb(hwnd, _):
        if win32gui.IsWindowVisible(hwnd):
            title = win32gui.GetWindowText(hwnd)
            if title:
                result.append({"hwnd": hwnd, "title": title})
    win32gui.EnumWindows(cb, None)
    return result

# Bring window to front by hwnd
win32gui.SetForegroundWindow(hwnd)

# Send WM_CLOSE to a window (graceful close)
win32gui.PostMessage(hwnd, win32con.WM_CLOSE, 0, 0)

# System-level keypress (bypasses most apps, works even when window not focused)
VK_RETURN = win32con.VK_RETURN
win32api.keybd_event(VK_RETURN, 0, 0, 0)                            # press
win32api.keybd_event(VK_RETURN, 0, win32con.KEYEVENTF_KEYUP, 0)     # release

# Get cursor position
x, y = win32api.GetCursorPos()
```

---

## 5. pynput — Low-level keyboard/mouse listener + controller

```
pip install pynput
```

- **Risk:** MEDIUM
- **Admin:** No (listener may need it on some systems)

```python
from pynput.mouse import Button, Controller as Mouse
from pynput.keyboard import Key, Controller as Keyboard, Listener

mouse = Mouse()
kbd   = Keyboard()

# Move and click
mouse.position = (500, 300)
mouse.click(Button.left, 1)
mouse.click(Button.right, 1)

# Scroll
mouse.scroll(0, -2)  # scroll down 2 units

# Type unicode text (better than pyautogui for non-ASCII / Arabic / etc.)
kbd.type("مرحبا يا جارفيس")

# Hold modifier + press key
with kbd.pressed(Key.ctrl):
    kbd.press('z'); kbd.release('z')

# Global hotkey listener (for wake-word style shortcut)
def on_press(key):
    if key == Key.f12:
        print("JARVIS hotkey pressed")

with Listener(on_press=on_press) as listener:
    listener.join()
```

---

## 6. mss — Ultra-fast screen capture

```
pip install mss Pillow
```

- **Risk:** SAFE
- **Admin:** No

mss is 3–5× faster than pyautogui.screenshot() — critical for rapid vision loops.

```python
import mss, base64
from PIL import Image
from io import BytesIO

def capture_screen(monitor: int = 1, quality: int = 75) -> str:
    """Returns base64-encoded JPEG of the specified monitor."""
    with mss.mss() as sct:
        raw = sct.grab(sct.monitors[monitor])
        img = Image.frombytes("RGB", raw.size, raw.rgb)
        # Resize to halve token cost when sending to vision LLM
        img = img.resize((img.width // 2, img.height // 2), Image.LANCZOS)
        buf = BytesIO()
        img.save(buf, "JPEG", quality=quality)
        return base64.b64encode(buf.getvalue()).decode()

def list_monitors() -> list[dict]:
    with mss.mss() as sct:
        return [{"id": i, **m} for i, m in enumerate(sct.monitors)]
```

---

## 7. winotify — Windows 10/11 toast notifications

```
pip install winotify
```

- **Risk:** SAFE
- **Admin:** No

```python
from winotify import Notification, audio

def notify(title: str, body: str, icon_path: str = "") -> None:
    toast = Notification(
        app_id="JARVIS",
        title=title,
        msg=body,
        icon=icon_path,
    )
    toast.set_audio(audio.Default, loop=False)
    toast.show()

# Approval toast — user sees this before dangerous operations run
def approval_toast(action: str, detail: str) -> None:
    toast = Notification(
        app_id="JARVIS — Approval Required",
        title=f"Allow: {action}",
        msg=detail,
        icon="",
    )
    toast.show()
```

---

## 8. pycaw — Windows audio control

```
pip install pycaw comtypes
```

- **Risk:** SAFE
- **Admin:** No

```python
from ctypes import cast, POINTER
from comtypes import CLSCTX_ALL
from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume

def _get_volume_interface():
    devices = AudioUtilities.GetSpeakers()
    interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
    return cast(interface, POINTER(IAudioEndpointVolume))

def set_volume(level: float) -> None:
    """level: 0.0 to 1.0"""
    _get_volume_interface().SetMasterVolumeLevelScalar(max(0.0, min(1.0, level)), None)

def get_volume() -> float:
    return _get_volume_interface().GetMasterVolumeLevelScalar()

def mute(state: bool) -> None:
    _get_volume_interface().SetMute(int(state), None)

def is_muted() -> bool:
    return bool(_get_volume_interface().GetMute())
```

---

## 9. psutil — Process and system stats

```
pip install psutil
```

- **Risk:** SAFE (read) / MEDIUM (kill)
- **Admin:** No for most; Yes for killing system processes

```python
import psutil

def get_stats() -> dict:
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    net = psutil.net_io_counters()
    return {
        "cpu_pct":      psutil.cpu_percent(interval=0.3),
        "cpu_cores":    psutil.cpu_count(),
        "ram_pct":      mem.percent,
        "ram_used_gb":  round(mem.used / 1e9, 2),
        "ram_total_gb": round(mem.total / 1e9, 2),
        "disk_pct":     disk.percent,
        "disk_free_gb": round(disk.free / 1e9, 1),
        "net_sent_mb":  round(net.bytes_sent / 1e6, 1),
        "net_recv_mb":  round(net.bytes_recv / 1e6, 1),
    }

def list_top_processes(n: int = 8) -> list[dict]:
    procs = []
    for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent"]):
        try:
            procs.append(p.info)
        except psutil.NoSuchProcess:
            pass
    return sorted(procs, key=lambda x: x["cpu_percent"] or 0, reverse=True)[:n]

def kill_process(name: str) -> bool:
    for p in psutil.process_iter(["name"]):
        if p.info["name"].lower() == name.lower():
            p.terminate()
            return True
    return False
```

---

## 10. Screen Understanding Pipeline

Full pipeline: capture → compress → Vision LLM → structured action

```python
import mss, base64, json
from PIL import Image
from io import BytesIO
import litellm

def understand_screen(question: str, model: str = "gemini/gemini-1.5-flash") -> str:
    """Ask a vision LLM what's on screen."""
    with mss.mss() as sct:
        raw = sct.grab(sct.monitors[1])
        img = Image.frombytes("RGB", raw.size, raw.rgb)

    img = img.resize((img.width // 2, img.height // 2), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, "JPEG", quality=72)
    b64 = base64.b64encode(buf.getvalue()).decode()

    resp = litellm.completion(
        model=model,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                {"type": "text", "text": question},
            ]
        }],
        max_tokens=512,
    )
    return resp.choices[0].message.content

# Vision → click loop
def find_and_click(target_description: str) -> bool:
    """Find a UI element on screen and click it."""
    result = understand_screen(
        f'Find the "{target_description}" element. '
        'Reply ONLY with JSON: {"found": true, "x": 450, "y": 230} or {"found": false}'
    )
    data = json.loads(result)
    if data.get("found"):
        import pyautogui
        pyautogui.click(data["x"], data["y"])
        return True
    return False
```

---

## 11. App Control

```python
import subprocess, os, psutil

# Canonical app paths — extend via config
APP_ALIASES: dict[str, str] = {
    "chrome":    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "firefox":   r"C:\Program Files\Mozilla Firefox\firefox.exe",
    "vscode":    rf"C:\Users\{os.getenv('USERNAME')}\AppData\Local\Programs\Microsoft VS Code\Code.exe",
    "spotify":   rf"C:\Users\{os.getenv('USERNAME')}\AppData\Roaming\Spotify\Spotify.exe",
    "notepad":   "notepad.exe",
    "explorer":  "explorer.exe",
    "calc":      "calc.exe",
    "terminal":  "wt.exe",
    "powershell":"powershell.exe",
    "taskmgr":   "taskmgr.exe",
}

def open_app(name: str, args: list[str] | None = None) -> bool:
    args = args or []
    exe = APP_ALIASES.get(name.lower())
    if exe and os.path.exists(exe):
        subprocess.Popen([exe, *args])
        return True
    # Fallback: try it as a command (notepad, calc, etc.)
    try:
        subprocess.Popen([name, *args])
        return True
    except FileNotFoundError:
        return False

def open_url(url: str, browser: str = "chrome") -> None:
    if browser in APP_ALIASES:
        open_app(browser, [url])
    else:
        os.startfile(url)  # uses default browser

def open_file(path: str) -> None:
    """Open with default associated application."""
    os.startfile(path)

def close_app(name: str) -> bool:
    killed = False
    for p in psutil.process_iter(["name"]):
        if name.lower() in (p.info["name"] or "").lower():
            p.terminate()
            killed = True
    return killed
```

---

## 12. File Operations

### Search

```python
from pathlib import Path
import subprocess, json

def search_files(pattern: str, root: str = "C:/Users") -> list[str]:
    """Find files matching a glob pattern. Falls back to pathlib if Everything not installed."""
    # Try Everything CLI first (fast, instant)
    try:
        result = subprocess.run(
            ["es.exe", "-json", pattern],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            data = json.loads(result.stdout)
            return [item["path"] for item in data.get("results", [])][:50]
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass

    # Fallback: recursive glob
    return [str(p) for p in Path(root).rglob(pattern)][:50]
```

### Document reading

```python
def read_file(path: str, max_chars: int = 8000) -> str:
    ext = Path(path).suffix.lower()

    if ext == ".pdf":
        import pdfplumber
        with pdfplumber.open(path) as pdf:
            text = "\n".join(page.extract_text() or "" for page in pdf.pages[:10])

    elif ext in (".docx", ".doc"):
        from docx import Document
        doc = Document(path)
        text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())

    elif ext in (".xlsx", ".xls"):
        import openpyxl
        wb = openpyxl.load_workbook(path, data_only=True)
        rows = []
        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            for row in ws.iter_rows(max_row=20, values_only=True):
                rows.append("\t".join(str(c or "") for c in row))
        text = "\n".join(rows)

    else:
        with open(path, encoding="utf-8", errors="replace") as f:
            text = f.read()

    return text[:max_chars]
```

### Folder monitoring (watchdog)

```python
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

class DownloadWatcher(FileSystemEventHandler):
    def __init__(self, notify_fn):
        self.notify_fn = notify_fn

    def on_created(self, event):
        if not event.is_directory:
            self.notify_fn(f"New file: {event.src_path}")

def start_watching(path: str, notify_fn) -> Observer:
    observer = Observer()
    observer.schedule(DownloadWatcher(notify_fn), path, recursive=False)
    observer.start()
    return observer
```

---

## 13. Sandboxed Shell Command Execution

```python
import asyncio, subprocess

BLOCKED_PATTERNS = [
    "format ", "del /f /s", "rd /s /q", "reg delete", "bcdedit",
    "diskpart", "cipher /w", "sfc /scannow", "netsh firewall",
    "powercfg /h", "shutdown", "taskkill /f /im explorer",
]

async def run_command(cmd: str, timeout: int = 30) -> dict:
    for blocked in BLOCKED_PATTERNS:
        if blocked.lower() in cmd.lower():
            return {"ok": False, "error": f"Blocked: contains '{blocked}'"}

    try:
        proc = await asyncio.create_subprocess_shell(
            cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        return {
            "ok": proc.returncode == 0,
            "stdout": stdout.decode(errors="replace"),
            "stderr": stderr.decode(errors="replace"),
            "code": proc.returncode,
        }
    except asyncio.TimeoutError:
        proc.kill()
        return {"ok": False, "error": f"Command timed out after {timeout}s"}
```

---

## 14. Security Model

### Risk tiers

| Tier | Operations | Policy |
|---|---|---|
| 🟢 **Safe** | screenshot, list_windows, get_stats, get_clipboard, list_files, list_processes | Auto-execute, logged |
| 🟡 **Medium** | open_app, open_url, focus_window, set_clipboard, read_file, set_volume, notify | Auto-execute, audit log |
| 🔴 **Dangerous** | type_text, mouse_click, run_command, kill_process, delete_file | Require local toast approval (10s timeout → deny) |
| ⛔ **Blocked** | regedit, format, rm -rf equivalent, network config, bcdedit | Hardcoded deny — never execute |

### Approval flow

```python
import asyncio
from winotify import Notification

_pending_approvals: dict[str, asyncio.Event] = {}

async def request_approval(action_id: str, action: str, detail: str, timeout: int = 10) -> bool:
    event = asyncio.Event()
    _pending_approvals[action_id] = event

    toast = Notification(
        app_id="JARVIS — Approval Required",
        title=f"Allow: {action}",
        msg=f"{detail}\n\nTimesout in {timeout}s → denied",
    )
    toast.show()

    try:
        await asyncio.wait_for(event.wait(), timeout=timeout)
        return True
    except asyncio.TimeoutError:
        return False
    finally:
        _pending_approvals.pop(action_id, None)

def approve(action_id: str) -> None:
    if action_id in _pending_approvals:
        _pending_approvals[action_id].set()
```

---

## 15. Full Tool Registry

```python
# src/pc_agent/tools/__init__.py

TOOLS = {
    # SAFE — auto-execute
    "screenshot":        {"tier": "safe"},
    "list_monitors":     {"tier": "safe"},
    "list_windows":      {"tier": "safe"},
    "get_active_window": {"tier": "safe"},
    "get_stats":         {"tier": "safe"},
    "get_clipboard":     {"tier": "safe"},
    "list_processes":    {"tier": "safe"},
    "search_files":      {"tier": "safe"},
    "understand_screen": {"tier": "safe"},   # vision LLM — read-only

    # MEDIUM — auto-execute + audit log
    "open_app":          {"tier": "medium"},
    "close_app":         {"tier": "medium"},
    "open_url":          {"tier": "medium"},
    "open_file":         {"tier": "medium"},
    "focus_window":      {"tier": "medium"},
    "set_clipboard":     {"tier": "medium"},
    "set_volume":        {"tier": "medium"},
    "get_volume":        {"tier": "medium"},
    "mute_audio":        {"tier": "medium"},
    "send_notification": {"tier": "medium"},
    "read_file":         {"tier": "medium"},
    "watch_folder":      {"tier": "medium"},
    "browser_navigate":  {"tier": "medium"},
    "browser_screenshot":{"tier": "medium"},
    "browser_get_text":  {"tier": "medium"},
    "browser_ai_task":   {"tier": "medium"},

    # DANGEROUS — require user approval toast
    "type_text":         {"tier": "dangerous"},
    "mouse_click":       {"tier": "dangerous"},
    "mouse_move":        {"tier": "dangerous"},
    "press_keys":        {"tier": "dangerous"},
    "run_command":       {"tier": "dangerous"},
    "kill_process":      {"tier": "dangerous"},
    "delete_file":       {"tier": "dangerous"},
    "browser_fill":      {"tier": "dangerous"},
    "browser_click":     {"tier": "dangerous"},
    "browser_run_js":    {"tier": "dangerous"},
    "find_and_click":    {"tier": "dangerous"},   # vision → click
}
```

---

## 16. Required pip packages

```
# src/pc_agent/requirements.txt
pyautogui>=0.9.54
pygetwindow>=0.0.9
pywin32>=306
pynput>=1.7.6
mss>=9.0.1
Pillow>=10.0.0
psutil>=5.9.8
winotify>=1.1.0
pycaw>=20240210
playwright>=1.44.0
browser-use>=0.1.0
watchdog>=4.0.0
pdfplumber>=0.11.0
python-docx>=1.1.0
openpyxl>=3.1.2
websockets>=12.0
litellm>=1.40.0
python-dotenv>=1.0.0
pystray>=0.19.5
```

---

## 17. Windows service / tray packaging

```python
# Run at startup via Windows Task Scheduler (no admin needed):
# schtasks /create /tn "JARVIS PC Agent" /tr "python C:\jarvis\src\pc_agent\main.py"
#          /sc onlogon /rl limited /f

# System tray with pystray
import pystray
from PIL import Image as PILImage
import threading

def create_tray_icon(agent):
    img = PILImage.new("RGB", (64, 64), color=(0, 168, 255))
    menu = pystray.Menu(
        pystray.MenuItem("JARVIS PC Agent — Running", None, enabled=False),
        pystray.MenuItem("Open Dashboard", lambda: agent.open_dashboard()),
        pystray.MenuItem("Quit", lambda icon, _: (icon.stop(), agent.stop())),
    )
    icon = pystray.Icon("JARVIS", img, "JARVIS PC Agent", menu)

    # Run tray in background thread so asyncio loop stays on main
    thread = threading.Thread(target=icon.run, daemon=True)
    thread.start()
    return icon
```

---

## 18. Gap analysis — what's missing vs. what this enables

| Capability | Current status | Priority |
|---|---|---|
| PC remote agent (WebSocket client on PC) | ❌ Not built | P0 |
| App launch/close | ❌ | P0 |
| Screenshot + Vision LLM action | ❌ | P0 |
| Real system stats (psutil → WebSocket → UI) | ❌ (fake random in SysMonWidget) | P0 |
| Security approval system (toast) | ❌ | P0 |
| Browser automation (playwright/browser-use) | ❌ | P1 |
| Windows notifications | ❌ | P1 |
| File search & reading | ❌ | P1 |
| Folder watch → proactive alerts | ❌ | P1 |
| Keyboard/mouse control | ❌ | P2 |
| Audio volume control | ❌ | P2 |
| System tray packaging | ❌ | P2 |
| Smart home (Home Assistant) | ❌ | P3 |
| Calendar/Email | ❌ | P3 |
