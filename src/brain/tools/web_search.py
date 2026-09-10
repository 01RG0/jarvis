"""Built-in: web search — Tavily primary, DuckDuckGo fallback (no key required)."""
import os
import urllib.parse
import urllib.request
import json

from ._base import JarvisTool, ToolResult

TOOL_NAME = "web_search"
TOOL_DESCRIPTION = "Search the web for current information and return top results"
TOOL_TAGS = ["web", "search", "internet", "research", "lookup", "find", "google", "news"]


def _tavily(query: str) -> str:
    key = os.environ.get("TAVILY_API_KEY", "")
    if not key:
        raise ValueError("TAVILY_API_KEY not set")
    import urllib.request as req_lib
    payload = json.dumps({
        "api_key": key,
        "query": query,
        "max_results": 5,
        "search_depth": "basic",
    }).encode()
    req = urllib.request.Request(
        "https://api.tavily.com/search",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        data = json.loads(r.read().decode())
    results = data.get("results", [])
    if not results:
        return f"No results for: {query}"
    lines = [f"{i+1}. {r['title']}\n   {r.get('content','')[:200]}\n   {r['url']}"
             for i, r in enumerate(results)]
    return "\n\n".join(lines)


def _ddg(query: str) -> str:
    url = "https://api.duckduckgo.com/?q=" + urllib.parse.quote(query) + "&format=json&no_html=1&skip_disambig=1"
    req = urllib.request.Request(url, headers={"User-Agent": "Jarvis/1.0"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode())
    results = []
    if data.get("AbstractText"):
        results.append(data["AbstractText"])
    for topic in data.get("RelatedTopics", [])[:5]:
        if isinstance(topic, dict) and topic.get("Text"):
            results.append(topic["Text"])
    if not results:
        return f"No results found for: {query}"
    return "\n\n".join(results)


class WebSearchTool(JarvisTool):
    name = TOOL_NAME
    description = TOOL_DESCRIPTION
    tags = TOOL_TAGS

    def run(self, query: str = "", **kwargs) -> ToolResult:
        if not query:
            return ToolResult(success=False, output="", error="query is required", tool_name=self.name)
        for fn in (_tavily, _ddg):
            try:
                return ToolResult(success=True, output=fn(query), tool_name=self.name)
            except Exception:
                continue
        return ToolResult(success=False, output="", error="All search providers failed", tool_name=self.name)
