"""Browser automation tool — Playwright headless + Jina Reader."""
import os
import urllib.parse
import urllib.request
from ._base import JarvisTool, ToolResult


def _jina_read(url: str) -> str:
    """Jina Reader — converts any URL to clean markdown, no JS needed."""
    jina_url = "https://r.jina.ai/" + url
    req = urllib.request.Request(
        jina_url,
        headers={"Accept": "text/markdown", "User-Agent": "Jarvis/1.0"},
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.read().decode("utf-8", errors="replace")[:6000]


def _playwright_read(url: str) -> str:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(url, timeout=15000)
        text = page.inner_text("body")
        browser.close()
    return text[:6000]


class BrowserTool(JarvisTool):
    name = "browse_url"
    description = "Open a URL and return the page content as text"
    tags = ["browser", "url", "website", "open", "visit", "scrape", "read", "web", "page", "html"]

    def run(self, url: str = "", **kwargs) -> ToolResult:
        if not url:
            return ToolResult(False, "", "url is required", self.name)
        if not url.startswith(("http://", "https://")):
            url = "https://" + url

        # Try Jina Reader first (fastest, no browser needed)
        for fn in (_jina_read, _playwright_read):
            try:
                content = fn(url)
                return ToolResult(True, content, tool_name=self.name)
            except Exception:
                continue
        return ToolResult(False, "", "All browser methods failed", self.name)
