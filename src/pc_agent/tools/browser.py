"""Browser automation via Playwright + web search fallback."""
from __future__ import annotations

import base64
import os

from . import register

_pw = None
_browser = None
_page = None


def _get_page():
    global _pw, _browser, _page
    if _page is None:
        from playwright.sync_api import sync_playwright
        _pw = sync_playwright().start()
        _browser = _pw.chromium.launch(headless=True)
        _page = _browser.new_page()
    return _page


def browser_navigate(url: str) -> dict:
    page = _get_page()
    resp = page.goto(url, timeout=15000)
    return {"url": page.url, "title": page.title(), "status": resp.status if resp else 0}


def browser_screenshot(full_page: bool = False) -> str:
    page = _get_page()
    data = page.screenshot(full_page=full_page)
    return base64.b64encode(data).decode()


def browser_get_text(selector: str | None = None) -> str:
    page = _get_page()
    if selector:
        el = page.locator(selector).first
        return el.inner_text() if el.count() else ""
    return page.inner_text("body")[:6000]


def browser_click(selector: str) -> None:
    _get_page().locator(selector).first.click()


def browser_fill(selector: str, text: str) -> None:
    _get_page().locator(selector).first.fill(text)


def browser_download(url: str, path: str) -> dict:
    import urllib.request
    urllib.request.urlretrieve(url, path)
    return {"path": path, "size": os.path.getsize(path)}


def search_web(query: str, max_results: int = 5) -> list[dict]:
    """Tavily primary → DuckDuckGo fallback."""
    key = os.environ.get("TAVILY_API_KEY", "")
    if key:
        try:
            import json, urllib.request
            body = json.dumps({"api_key": key, "query": query,
                               "max_results": max_results, "search_depth": "basic"}).encode()
            req = urllib.request.Request(
                "https://api.tavily.com/search", data=body,
                headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=10) as r:
                data = json.loads(r.read())
            return data.get("results", [])[:max_results]
        except Exception:
            pass
    # DuckDuckGo fallback
    try:
        import urllib.parse, json, urllib.request
        url = ("https://api.duckduckgo.com/?q=" + urllib.parse.quote(query)
               + "&format=json&no_html=1&skip_disambig=1")
        req = urllib.request.Request(url, headers={"User-Agent": "Jarvis/1.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read())
        results = []
        if data.get("AbstractText"):
            results.append({"title": data.get("Heading", query),
                            "url": data.get("AbstractURL", ""),
                            "content": data["AbstractText"]})
        for t in data.get("RelatedTopics", [])[:max_results - 1]:
            if isinstance(t, dict) and t.get("Text"):
                results.append({"title": t.get("Text", "")[:60],
                                "url": t.get("FirstURL", ""),
                                "content": t.get("Text", "")})
        return results
    except Exception:
        return []


register("browser_navigate",   browser_navigate,   tier="safe")
register("browser_screenshot", browser_screenshot, tier="safe")
register("browser_get_text",   browser_get_text,   tier="safe")
register("browser_click",      browser_click,      tier="dangerous")
register("browser_fill",       browser_fill,       tier="dangerous")
register("browser_download",   browser_download,   tier="medium")
register("search_web",         search_web,         tier="safe")
