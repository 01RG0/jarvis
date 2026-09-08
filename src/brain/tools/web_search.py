"""Built-in: web search via DuckDuckGo (no key required)."""
import urllib.parse
import urllib.request
import json

from ._base import JarvisTool, ToolResult

TOOL_NAME = "web_search"
TOOL_DESCRIPTION = "Search the web for current information and return top results"
TOOL_TAGS = ["web", "search", "internet", "research", "lookup", "find", "google", "news"]


class WebSearchTool(JarvisTool):
    name = TOOL_NAME
    description = TOOL_DESCRIPTION
    tags = TOOL_TAGS

    def run(self, query: str = "", **kwargs) -> ToolResult:
        if not query:
            return ToolResult(success=False, output="", error="query is required", tool_name=self.name)
        try:
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
                return ToolResult(success=True, output=f"No results found for: {query}", tool_name=self.name)
            return ToolResult(success=True, output="\n\n".join(results), tool_name=self.name)
        except Exception as e:
            return ToolResult(success=False, output="", error=str(e), tool_name=self.name)
