"""Window management and app launching."""
from __future__ import annotations

import os
import subprocess

from . import register

_APP_ALIASES: dict[str, str] = {
    "chrome":    "chrome.exe",
    "firefox":   "firefox.exe",
    "edge":      "msedge.exe",
    "notepad":   "notepad.exe",
    "explorer":  "explorer.exe",
    "terminal":  "wt.exe",
    "cmd":       "cmd.exe",
    "powershell": "powershell.exe",
    "vscode":    "code.exe",
    "discord":   "discord.exe",
    "whatsapp":  "whatsapp.exe",
    "spotify":   "spotify.exe",
    "steam":     "steam.exe",
    "obs":       "obs64.exe",
    "taskmanager": "taskmgr.exe",
}


def list_windows() -> list[dict]:
    try:
        import pygetwindow as gw
        return [
            {"title": w.title, "left": w.left, "top": w.top,
             "width": w.width, "height": w.height}
            for w in gw.getAllWindows() if w.title.strip()
        ]
    except Exception:
        return []


def get_active_window() -> dict:
    try:
        import pygetwindow as gw
        w = gw.getActiveWindow()
        if not w:
            return {}
        return {"title": w.title, "left": w.left, "top": w.top,
                "width": w.width, "height": w.height}
    except Exception:
        return {}


def focus_window(title: str) -> bool:
    try:
        import pygetwindow as gw
        wins = gw.getWindowsWithTitle(title)
        if wins:
            wins[0].activate()
            return True
    except Exception:
        pass
    return False


def open_app(name: str, args: list[str] | None = None) -> bool:
    exe = _APP_ALIASES.get(name.lower(), name)
    try:
        subprocess.Popen([exe] + (args or []))
        return True
    except FileNotFoundError:
        # Try via start command on Windows
        subprocess.Popen(["cmd", "/c", "start", "", exe] + (args or []))
        return True
    except Exception:
        return False


def close_app(name: str) -> bool:
    exe = _APP_ALIASES.get(name.lower(), name)
    basename = os.path.basename(exe)
    try:
        subprocess.run(["taskkill", "/IM", basename, "/F"],
                       capture_output=True, check=False)
        return True
    except Exception:
        return False


def open_file(path: str) -> None:
    os.startfile(path)


def open_url(url: str, browser: str = "chrome") -> None:
    exe = _APP_ALIASES.get(browser.lower(), browser + ".exe")
    try:
        subprocess.Popen([exe, url])
    except FileNotFoundError:
        import webbrowser
        webbrowser.open(url)


register("list_windows",    list_windows,    tier="safe")
register("get_active_window", get_active_window, tier="safe")
register("focus_window",    focus_window,    tier="medium")
register("open_app",        open_app,        tier="medium")
register("close_app",       close_app,       tier="medium")
register("open_file",       open_file,       tier="medium")
register("open_url",        open_url,        tier="medium")
