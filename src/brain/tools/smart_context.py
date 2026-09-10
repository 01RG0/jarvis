"""Active window, clipboard, and screen context tool."""
from __future__ import annotations

from ._base import JarvisTool, ToolResult


class SmartContextTool(JarvisTool):
    name = "smart_context"
    description = "Get current screen context: active window title, clipboard contents, or screenshot summary"
    tags = ["screen", "window", "clipboard", "context", "what am i looking at", "active", "current"]

    def run(self, query: str = "all", **kwargs) -> ToolResult:
        parts: list[str] = []

        if query in ("window", "all"):
            parts.append(self._get_window())
        if query in ("clipboard", "all"):
            parts.append(self._get_clipboard())
        if query == "screen":
            return ToolResult(True, "Screen capture available via vision task type", tool_name=self.name)

        combined = "\n".join(p for p in parts if p)
        return ToolResult(True, combined or "No context available", tool_name=self.name)

    def _get_window(self) -> str:
        try:
            import win32gui
            title = win32gui.GetWindowText(win32gui.GetForegroundWindow())
            return f"Active window: {title}" if title else ""
        except ImportError:
            pass
        try:
            import pygetwindow as gw
            wins = gw.getActiveWindow()
            return f"Active window: {wins.title}" if wins else ""
        except Exception:
            return ""

    def _get_clipboard(self) -> str:
        try:
            import pyperclip
            text = pyperclip.paste()
            if text and len(text) < 2000:
                return f"Clipboard: {text[:500]}"
        except Exception:
            pass
        return ""
