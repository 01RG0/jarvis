# JARVIS Browser Automation — Research & Implementation Reference

> Browser control capabilities for the PC agent. Enables JARVIS to navigate the web,
> fill forms, extract data, download files, and execute AI-directed browsing tasks.

---

## 1. Library Comparison

| Library | Best for | AI-friendly | Speed | Detectability | Headless |
|---|---|---|---|---|---|
| **playwright-python** | Scripted automation, forms, downloads | Medium | Fast | Low | ✅ |
| **browser-use** | AI-native — LLM decides clicks | High | Medium | Low | ✅ |
| **selenium** | Legacy, wide support | Low | Slow | High | ✅ |
| **undetected-chromedriver** | Sites with bot detection | Low | Slow | Very low | ✅ |
| **CDP direct** | Debug/inspect, network intercept | Low | Very fast | Very low | ✅ |

**Recommendation:** Use `browser-use` when JARVIS needs to complete a goal in natural language. Use `playwright` for scripted, deterministic tasks.

---

## 2. browser-use — AI-Native Browser Agent

browser-use (2024) is designed for LLMs to control browsers. It:
- Takes a screenshot of the current page
- Extracts the DOM as a structured tree
- Passes both to an LLM
- LLM replies with an action (click element #42, type "hello", navigate to URL)
- Repeats until the goal is complete

```
pip install browser-use playwright
playwright install chromium
```

### Basic usage

```python
from browser_use import Agent
import asyncio

async def browse_task(task: str, model: str = "gemini/gemini-1.5-flash") -> str:
    from langchain_google_genai import ChatGoogleGenerativeAI
    
    agent = Agent(
        task=task,
        llm=ChatGoogleGenerativeAI(model="gemini-1.5-flash"),
        max_actions_per_step=5,
    )
    result = await agent.run(max_steps=15)
    return result.final_result() or ""

# Example usage
result = asyncio.run(browse_task(
    "Go to news.ycombinator.com and return the top 5 story titles"
))
```

### With LiteLLM (recommended for JARVIS — keeps model routing centralized)

```python
from browser_use import Agent
from langchain_openai import ChatOpenAI
import os

async def browse_task_litellm(task: str) -> str:
    # LiteLLM proxy exposes an OpenAI-compatible endpoint
    llm = ChatOpenAI(
        model="jarvis-fast",          # LiteLLM model alias
        base_url=os.getenv("LITELLM_BASE_URL", "http://localhost:4000"),
        api_key=os.getenv("LITELLM_API_KEY", "anything"),
    )
    agent = Agent(task=task, llm=llm)
    result = await agent.run(max_steps=20)
    return result.final_result() or ""
```

### Limitations
- Requires a visible or headless Chromium instance
- Each step invokes the LLM → higher latency than scripted playwright
- Not suitable for tasks that need exact timing or low latency
- Some sites block automated browsers regardless of model

---

## 3. playwright-python — Scripted Automation

```
pip install playwright
playwright install chromium
```

### Core async API

```python
from playwright.async_api import async_playwright, Browser, Page
import base64
from io import BytesIO

async def get_playwright_page(headless: bool = True) -> tuple:
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(headless=headless)
    context = await browser.new_context(
        viewport={"width": 1280, "height": 800},
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    )
    page = await context.new_page()
    return pw, browser, context, page

async def navigate_and_screenshot(url: str) -> str:
    pw, browser, ctx, page = await get_playwright_page()
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=15000)
        screenshot = await page.screenshot(full_page=False)
        return base64.b64encode(screenshot).decode()
    finally:
        await browser.close()
        await pw.stop()
```

### Key operations

```python
# Navigate
await page.goto("https://example.com")

# Click by selector
await page.click("#submit-button")
await page.click("text=Sign in")
await page.click('[data-testid="search-input"]')

# Fill form
await page.fill("#email", "user@example.com")
await page.fill("#password", "secret")

# Press key
await page.keyboard.press("Enter")
await page.keyboard.press("Escape")

# Wait for element
await page.wait_for_selector(".results-list", timeout=10000)

# Extract text
title = await page.title()
body_text = await page.inner_text("body")
element_text = await page.inner_text(".article-content")

# Extract attribute
href = await page.get_attribute("a.main-link", "href")

# Run JavaScript
result = await page.evaluate("() => document.title")
await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")

# Download file
async with page.expect_download() as dl_info:
    await page.click("#download-btn")
download = await dl_info.value
await download.save_as("C:/Users/ahmed/Downloads/file.pdf")

# Intercept network requests
async def handle_route(route):
    if "ads" in route.request.url:
        await route.abort()
    else:
        await route.continue_()
await page.route("**/*", handle_route)

# Full-page screenshot
screenshot_bytes = await page.screenshot(full_page=True)

# Take screenshot of specific element
el = await page.query_selector(".chart-container")
chart_bytes = await el.screenshot()
```

### Persistent session (reuse cookies / logged-in state)

```python
import json
from pathlib import Path

SESSION_DIR = Path("C:/jarvis/browser_sessions")

async def get_persistent_context(profile: str, headless: bool = True):
    """Profile names: 'personal', 'research', 'automation'"""
    session_path = SESSION_DIR / profile
    session_path.mkdir(parents=True, exist_ok=True)
    
    pw = await async_playwright().start()
    context = await pw.chromium.launch_persistent_context(
        str(session_path),
        headless=headless,
        viewport={"width": 1280, "height": 800},
    )
    page = context.pages[0] if context.pages else await context.new_page()
    return pw, context, page
```

---

## 4. Anti-Detection / Stealth

```
pip install playwright-stealth
```

```python
from playwright.async_api import async_playwright
from playwright_stealth import stealth_async

async def get_stealth_page():
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(headless=True)
    page = await browser.new_page()
    await stealth_async(page)
    return pw, browser, page

# Additional techniques
async def human_like_type(page, selector: str, text: str):
    """Type with random delays between keystrokes."""
    import random, asyncio
    await page.click(selector)
    for char in text:
        await page.keyboard.type(char)
        await asyncio.sleep(random.uniform(0.05, 0.18))

async def human_like_click(page, selector: str):
    """Move mouse to element before clicking."""
    element = await page.query_selector(selector)
    box = await element.bounding_box()
    if box:
        import random
        x = box["x"] + box["width"] * random.uniform(0.3, 0.7)
        y = box["y"] + box["height"] * random.uniform(0.3, 0.7)
        await page.mouse.move(x, y)
        await asyncio.sleep(random.uniform(0.1, 0.3))
        await page.mouse.click(x, y)
```

---

## 5. Web Search Tool

```python
async def search_web(query: str, max_results: int = 5) -> list[dict]:
    """Returns list of {title, url, snippet} dicts."""
    # Primary: Tavily (designed for LLM agents, returns clean snippets)
    try:
        from tavily import TavilyClient
        client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
        results = client.search(query=query, max_results=max_results)
        return [
            {"title": r["title"], "url": r["url"], "snippet": r["content"]}
            for r in results.get("results", [])
        ]
    except Exception:
        pass

    # Fallback: DuckDuckGo (no API key required)
    from duckduckgo_search import DDGS
    with DDGS() as ddgs:
        return [
            {"title": r["title"], "url": r["href"], "snippet": r["body"]}
            for r in ddgs.text(query, max_results=max_results)
        ]
```

---

## 6. JARVIS Browser Tool API Design

These are the tools JARVIS brain can call on the PC agent:

```python
# All tools are async, called via WebSocket RPC

async def browser_navigate(url: str) -> dict:
    """Navigate to URL. Returns page title and current URL."""

async def browser_screenshot(full_page: bool = False) -> str:
    """Take screenshot of current browser state. Returns base64 PNG."""

async def browser_click(selector: str) -> dict:
    """Click an element by CSS selector or 'text=...' selector."""

async def browser_fill(selector: str, text: str) -> dict:
    """Fill a form input. DANGEROUS tier — requires approval."""

async def browser_get_text(selector: str | None = None) -> str:
    """Get text content of element (or full page body if no selector)."""

async def browser_run_js(code: str) -> any:
    """Execute JavaScript in page context. DANGEROUS tier."""

async def browser_download(url: str, save_path: str) -> dict:
    """Download a file to local path."""

async def browser_search_web(query: str, max_results: int = 5) -> list[dict]:
    """Search web via Tavily/DuckDuckGo and return structured results."""

async def browser_ai_task(instruction: str) -> str:
    """Give AI a goal and let browser-use complete it autonomously."""
    # Most powerful but most expensive — use for complex multi-step tasks

async def browser_get_html(selector: str | None = None) -> str:
    """Get HTML source of element or full page."""

async def browser_wait_for(selector: str, timeout_ms: int = 10000) -> bool:
    """Wait for element to appear. Returns True if found within timeout."""
```

---

## 7. Session Isolation

JARVIS should maintain separate browser profiles for different use cases:

| Profile | Purpose | Notes |
|---|---|---|
| `personal` | Logged into personal accounts (GitHub, email, banking) | DANGEROUS tier for all actions |
| `research` | General web browsing, searches, documentation | Medium tier |
| `automation` | Disposable — no saved cookies, clean slate | Used for untrusted tasks |

```python
BROWSER_PROFILES = {
    "personal":   "C:/jarvis/browser_sessions/personal",
    "research":   "C:/jarvis/browser_sessions/research",
    "automation": None,  # None = ephemeral, no persistence
}
```

---

## 8. Required pip packages

```
# In src/pc_agent/requirements.txt (additions)
playwright>=1.44.0
playwright-stealth>=1.0.6
browser-use>=0.1.0
tavily-python>=0.3.0
duckduckgo-search>=6.0.0
langchain-google-genai>=1.0.0   # for browser-use with Gemini
```

---

## 9. Gap analysis

| Capability | Status | Priority | Notes |
|---|---|---|---|
| Web search (Tavily) | ❌ | P0 | Needed for brain tools too, not just PC agent |
| Browser navigate + screenshot | ❌ | P1 | Core for screen-aware tasks |
| AI-native browser task | ❌ | P1 | browser-use library |
| Form fill / click | ❌ | P2 | Dangerous — needs approval system first |
| File download | ❌ | P2 | Medium risk |
| Session persistence | ❌ | P2 | Required for logged-in automation |
| Stealth / anti-bot | ❌ | P3 | Only needed for specific sites |
