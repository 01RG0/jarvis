"""Built-in: top headlines via BBC RSS (no key required)."""
import urllib.request
import defusedxml.ElementTree as ET

from ._base import JarvisTool, ToolResult

TOOL_NAME = "get_news"
TOOL_DESCRIPTION = "Get top news headlines, optionally filtered by topic"
TOOL_TAGS = ["news", "headlines", "current events", "bbc", "latest", "breaking", "world"]

_FEEDS: dict[str, str] = {
    "tech":        "https://feeds.bbci.co.uk/news/technology/rss.xml",
    "technology":  "https://feeds.bbci.co.uk/news/technology/rss.xml",
    "science":     "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
    "business":    "https://feeds.bbci.co.uk/news/business/rss.xml",
    "sport":       "https://feeds.bbci.co.uk/sport/rss.xml",
    "world":       "https://feeds.bbci.co.uk/news/world/rss.xml",
    "uk":          "https://feeds.bbci.co.uk/news/uk/rss.xml",
}
_DEFAULT_FEED = "https://feeds.bbci.co.uk/news/rss.xml"


class NewsTool(JarvisTool):
    name = TOOL_NAME
    description = TOOL_DESCRIPTION
    tags = TOOL_TAGS

    def run(self, topic: str = "", **kwargs) -> ToolResult:
        feed_url = _FEEDS.get(topic.lower().strip(), _DEFAULT_FEED)
        try:
            req = urllib.request.Request(feed_url, headers={"User-Agent": "Jarvis/1.0"})
            with urllib.request.urlopen(req, timeout=8) as r:
                root = ET.fromstring(r.read())
            items = root.findall(".//item")[:5]
            if not items:
                return ToolResult(success=True, output="No headlines found.", tool_name=self.name)
            lines = []
            for item in items:
                title = (item.findtext("title") or "").strip()
                desc = (item.findtext("description") or "").strip()
                lines.append(f"• {title}" + (f" — {desc}" if desc else ""))
            return ToolResult(success=True, output="\n".join(lines), tool_name=self.name)
        except Exception as e:
            return ToolResult(success=False, output="", error=str(e), tool_name=self.name)
