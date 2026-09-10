"""WhatsApp Desktop control via Playwright CDP.
Requires: add --remote-debugging-port=9223 to WhatsApp Desktop shortcut target once.
Uses stable data-testid selectors — works with WhatsApp Desktop >= 2.2x.
"""
import json
import os
from ._base import JarvisTool, ToolResult


CDP_PORT = int(os.environ.get("WHATSAPP_CDP_PORT", "9223"))
CDP_BASE = f"http://localhost:{CDP_PORT}"


def _get_page():
    from playwright.sync_api import sync_playwright
    pw = sync_playwright().start()
    browser = pw.chromium.connect_over_cdp(CDP_BASE)
    ctx = browser.contexts[0] if browser.contexts else browser.new_context()
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    return pw, browser, page


def _open_chat(page, contact: str) -> None:
    """Open a chat by name using the search box."""
    page.locator('[data-testid="chat-list-search"]').click()
    page.wait_for_timeout(300)
    page.keyboard.press("Control+a")
    page.keyboard.type(contact, delay=40)
    page.wait_for_timeout(800)
    # Click the first match in the results
    page.locator('[data-testid="cell-frame-container"]').first.click()
    page.wait_for_timeout(500)


def _send_message(contact: str, message: str) -> str:
    pw, browser, page = _get_page()
    try:
        _open_chat(page, contact)
        box = page.locator('[data-testid="conversation-compose-box-input"]')
        box.click()
        box.type(message, delay=30)
        page.locator('[data-testid="send"]').click()
        return f"Sent to {contact}: {message[:80]}"
    finally:
        browser.close()
        pw.stop()


def _read_messages(contact: str = "", limit: int = 10) -> str:
    pw, browser, page = _get_page()
    try:
        if contact:
            _open_chat(page, contact)
        msgs = page.locator('[data-testid="msg-container"]').all()[-limit:]
        lines = []
        for m in msgs:
            try:
                sender = ""
                try:
                    sender = m.locator('[data-testid="author"]').first.inner_text() + ": "
                except Exception:
                    pass
                text = m.locator('[data-testid="conversation-compose-box-input"], .copyable-text').first.inner_text()
                lines.append(sender + text)
            except Exception:
                pass
        return "\n".join(lines) if lines else "No messages found"
    finally:
        browser.close()
        pw.stop()


def _get_contacts(query: str = "") -> str:
    pw, browser, page = _get_page()
    try:
        if query:
            page.locator('[data-testid="chat-list-search"]').click()
            page.wait_for_timeout(300)
            page.keyboard.type(query, delay=40)
            page.wait_for_timeout(700)
        cells = page.locator('[data-testid="cell-frame-title"]').all()[:20]
        names = []
        for c in cells:
            try:
                names.append(c.inner_text())
            except Exception:
                pass
        return "\n".join(names) if names else "No contacts found"
    finally:
        browser.close()
        pw.stop()


class WhatsAppTool(JarvisTool):
    name = "whatsapp_control"
    description = "Control WhatsApp Desktop — send/read messages, search contacts"
    tags = ["whatsapp", "message", "chat", "send", "wa", "contact", "dm"]

    def run(
        self,
        action: str = "read",
        contact: str = "",
        message: str = "",
        query: str = "",
        limit: int = 10,
        **kwargs,
    ) -> ToolResult:
        try:
            match action:
                case "send":
                    if not contact or not message:
                        return ToolResult(False, "", "contact and message are required", self.name)
                    out = _send_message(contact, message)
                case "read":
                    out = _read_messages(contact, limit)
                case "contacts":
                    out = _get_contacts(query)
                case _:
                    return ToolResult(False, "", f"Unknown action: {action}", self.name)
            return ToolResult(True, out, tool_name=self.name)
        except Exception as e:
            return ToolResult(False, "", f"WhatsApp error: {e}", self.name)
