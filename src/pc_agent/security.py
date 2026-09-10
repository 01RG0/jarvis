"""HMAC message auth + risk-tier approval system."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import threading

TIERS: dict[str, set[str]] = {
    "safe": {
        "screenshot", "list_monitors", "list_windows", "get_active_window",
        "get_stats", "list_top_processes", "get_volume", "get_clipboard",
        "list_files", "search_files", "understand_screen", "send_notification",
        "browser_navigate", "browser_screenshot", "browser_get_text",
        "browser_download", "search_web",
        "discord_get_guilds", "discord_get_channels",
        "wa_get_contacts",
    },
    "medium": {
        "open_app", "open_url", "close_app", "focus_window", "open_file",
        "read_file", "set_volume", "mute", "set_clipboard",
        "discord_read", "discord_set_status", "discord_mute", "discord_deafen",
        "discord_join_vc", "wa_read",
    },
    "dangerous": {
        "type_text", "mouse_click", "mouse_move", "press_keys", "scroll",
        "run_command", "kill_process", "write_file", "delete_file",
        "browser_fill", "browser_click", "browser_run_js",
        "discord_send", "wa_send", "wa_send_file",
    },
    "blocked": set(),  # hardcoded deny — checked at dispatch time
}

# These substring patterns are always blocked regardless of tool name
_BLOCKED_PATTERNS = [
    "format", "del /f", "rd /s", "reg delete", "bcdedit",
    "diskpart", "shutdown /", "net user", "rm -rf",
]


def classify(tool_name: str) -> str:
    for tier, names in TIERS.items():
        if tool_name in names:
            return tier
    return "medium"  # unknown tool defaults to medium


def is_blocked_cmd(cmd: str) -> bool:
    low = cmd.lower()
    return any(p in low for p in _BLOCKED_PATTERNS)


def sign_message(msg: dict, token: str | None = None) -> str:
    secret = (token or os.environ.get("JARVIS_PC_TOKEN", "dev-token")).encode()
    payload = json.dumps({k: v for k, v in msg.items() if k != "sig"}, sort_keys=True)
    return hmac.new(secret, payload.encode(), hashlib.sha256).hexdigest()


def verify_message(msg: dict, token: str | None = None) -> bool:
    expected = sign_message(msg, token)
    return hmac.compare_digest(expected, msg.get("sig", ""))


# ── Toast approval (Windows only) ──────────────────────────────────────────────

_approval_cache: dict[str, threading.Event] = {}
_approval_result: dict[str, bool] = {}


def request_approval(action_id: str, tool: str, detail: str, timeout: int = 10) -> bool:
    """Show a winotify toast and wait up to `timeout` seconds for approval."""
    try:
        from winotify import Notification, audio
        toast = Notification(
            app_id="JARVIS",
            title=f"JARVIS: Approve action?",
            msg=f"{tool}: {detail[:80]}",
            duration="long",
        )
        toast.set_audio(audio.Default, loop=False)
        # winotify doesn't support callbacks well — we auto-deny on timeout
        toast.show()
    except Exception:
        pass

    # Wait for explicit approval via the approve_action() call
    evt = threading.Event()
    _approval_cache[action_id] = evt
    _approval_result[action_id] = False
    granted = evt.wait(timeout=timeout)
    result = _approval_result.pop(action_id, False)
    _approval_cache.pop(action_id, None)
    return granted and result


def approve_action(action_id: str, approved: bool = True) -> None:
    """Called by a local HTTP/tray handler to grant or deny an approval."""
    _approval_result[action_id] = approved
    if evt := _approval_cache.get(action_id):
        evt.set()
