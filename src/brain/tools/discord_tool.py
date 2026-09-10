"""Discord desktop control via two layers:
- pypresence: RPC pipe (\\.\pipe\discord-ipc-0) for voice/presence — no shortcut change needed
- Playwright CDP: full UI control (send/read messages) — requires --remote-debugging-port=9222
  in Discord shortcut target.
"""
import json
import os
import time
from ._base import JarvisTool, ToolResult


CDP_PORT = int(os.environ.get("DISCORD_CDP_PORT", "9222"))
CDP_BASE = f"http://localhost:{CDP_PORT}"


def _cdp_targets() -> list[dict]:
    import urllib.request
    with urllib.request.urlopen(f"{CDP_BASE}/json", timeout=5) as r:
        return json.loads(r.read())


def _get_page():
    """Return a Playwright Page connected to the Discord CDP endpoint."""
    from playwright.sync_api import sync_playwright
    pw = sync_playwright().start()
    browser = pw.chromium.connect_over_cdp(CDP_BASE)
    ctx = browser.contexts[0] if browser.contexts else browser.new_context()
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    return pw, browser, page


def _send_message(channel: str, message: str) -> str:
    pw, browser, page = _get_page()
    try:
        # Navigate to channel if given
        if channel:
            page.keyboard.press("Control+k")
            page.wait_for_timeout(400)
            page.keyboard.type(channel, delay=40)
            page.wait_for_timeout(600)
            page.keyboard.press("Enter")
            page.wait_for_timeout(800)

        # Type and send in the message box
        box = page.locator('[data-slate-editor="true"]').first
        box.click()
        box.type(message, delay=30)
        page.keyboard.press("Enter")
        return f"Sent to #{channel or 'current channel'}: {message[:80]}"
    finally:
        browser.close()
        pw.stop()


def _read_messages(channel: str = "", limit: int = 10) -> str:
    pw, browser, page = _get_page()
    try:
        if channel:
            page.keyboard.press("Control+k")
            page.wait_for_timeout(400)
            page.keyboard.type(channel, delay=40)
            page.wait_for_timeout(600)
            page.keyboard.press("Enter")
            page.wait_for_timeout(1000)

        msgs = page.locator('[id^="message-content-"]').all()[-limit:]
        lines = []
        for m in msgs:
            try:
                lines.append(m.inner_text())
            except Exception:
                pass
        return "\n".join(lines) if lines else "No messages found"
    finally:
        browser.close()
        pw.stop()


def _set_status(status: str) -> str:
    """Set Discord presence status via pypresence RPC."""
    try:
        from pypresence import Presence
        rpc = Presence(client_id="207646673902501888")  # Discord's own app ID
        rpc.connect()
        rpc.update(state=status)
        time.sleep(0.5)
        rpc.close()
        return f"Discord status set to: {status}"
    except Exception as e:
        return f"RPC failed (is Discord running?): {e}"


def _mute_unmute(mute: bool) -> str:
    pw, browser, page = _get_page()
    try:
        # Find the mute button in the voice controls bar
        btn = page.locator('[aria-label*="Mute"]').first
        if btn.count():
            btn.click()
            action = "Muted" if mute else "Unmuted"
            return f"Discord: {action}"
        return "Mute button not found — are you in a voice channel?"
    finally:
        browser.close()
        pw.stop()


class DiscordTool(JarvisTool):
    name = "discord_control"
    description = "Control Discord desktop app — send/read messages, set status, mute/unmute"
    tags = ["discord", "message", "chat", "send", "dm", "voice", "status", "mute", "server"]

    def run(
        self,
        action: str = "read",
        channel: str = "",
        message: str = "",
        status: str = "",
        limit: int = 10,
        **kwargs,
    ) -> ToolResult:
        try:
            match action:
                case "send":
                    if not message:
                        return ToolResult(False, "", "message is required for send", self.name)
                    out = _send_message(channel, message)
                case "read":
                    out = _read_messages(channel, limit)
                case "status":
                    out = _set_status(status or "Powered by Jarvis")
                case "mute":
                    out = _mute_unmute(True)
                case "unmute":
                    out = _mute_unmute(False)
                case _:
                    return ToolResult(False, "", f"Unknown action: {action}", self.name)
            return ToolResult(True, out, tool_name=self.name)
        except Exception as e:
            return ToolResult(False, "", f"Discord error: {e}", self.name)
