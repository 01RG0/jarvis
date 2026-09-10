"""Built-in: Wikipedia summary lookup (no key required)."""
import urllib.parse
import urllib.request
import json

from ._base import JarvisTool, ToolResult

TOOL_NAME = "wikipedia_search"
TOOL_DESCRIPTION = "Look up a topic on Wikipedia and return a brief summary"
TOOL_TAGS = ["wikipedia", "wiki", "facts", "definition", "history", "who is", "what is", "explain"]


class WikipediaTool(JarvisTool):
    name = TOOL_NAME
    description = TOOL_DESCRIPTION
    tags = TOOL_TAGS

    def run(self, query: str = "", **kwargs) -> ToolResult:
        if not query:
            return ToolResult(success=False, output="", error="query is required", tool_name=self.name)
        try:
            search_url = (
                "https://en.wikipedia.org/w/api.php?action=query&list=search"
                "&srsearch=" + urllib.parse.quote(query) + "&format=json&srlimit=1"
            )
            req = urllib.request.Request(search_url, headers={"User-Agent": "Jarvis/1.0"})
            with urllib.request.urlopen(req, timeout=8) as r:
                hits = json.loads(r.read().decode())
            results = hits.get("query", {}).get("search", [])
            if not results:
                return ToolResult(success=True, output=f"No Wikipedia article found for: {query}", tool_name=self.name)
            title = results[0]["title"]
            summary_url = (
                "https://en.wikipedia.org/api/rest_v1/page/summary/"
                + urllib.parse.quote(title)
            )
            req2 = urllib.request.Request(summary_url, headers={"User-Agent": "Jarvis/1.0"})
            with urllib.request.urlopen(req2, timeout=8) as r2:
                data = json.loads(r2.read().decode())
            extract = data.get("extract", "")
            if data.get("type") == "disambiguation":
                return ToolResult(
                    success=True,
                    output=f"'{title}' is a disambiguation page. Try a more specific query.",
                    tool_name=self.name,
                )
            return ToolResult(success=True, output=extract[:500], tool_name=self.name)
        except Exception as e:
            return ToolResult(success=False, output="", error=str(e), tool_name=self.name)
