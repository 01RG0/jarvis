"""Fallback chains for Jarvis tools.

run_with_fallback(tool_name, **kwargs) tries the primary tool first.
If it fails or is marked unhealthy, it tries each fallback in order,
recording health outcomes along the way.
"""
import logging
from typing import Optional

from tools._base import ToolResult

log = logging.getLogger(__name__)

# Primary → fallbacks (in order). Tools are tried until one succeeds.
FALLBACKS: dict[str, list[str]] = {
    "web_search":    ["web_search", "news", "wikipedia_tool"],
    "news":          ["news", "web_search", "wikipedia_tool"],
    "get_weather":   ["get_weather"],
    "wikipedia_tool":["wikipedia_tool", "web_search"],
    "run_python":    ["run_python", "code_exec"],
    "code_exec":     ["code_exec", "run_python"],
    "read_file":     ["read_file", "files"],
    "files":         ["files", "read_file"],
    "browser":       ["browser"],
    "github":        ["github"],
    "youtube":       ["youtube_tool"],
    "stocks":        ["stocks_tool"],
    "calendar":      ["calendar"],
    "smtp_email":    ["smtp_email"],
    "discord":       ["discord_tool"],
    "whatsapp":      ["whatsapp_tool"],
    "smart_home":    ["smart_home"],
}


def run_with_fallback(tool_name: str, **kwargs) -> Optional[ToolResult]:
    """Try tool_name, then each fallback. Returns first successful ToolResult or None."""
    from tool_registry import get as get_tool
    from api_health import is_healthy, record_success, record_failure

    chain = FALLBACKS.get(tool_name, [tool_name])

    for name in chain:
        tool = get_tool(name)
        if tool is None:
            continue
        if not is_healthy(name):
            log.info("tool_fallbacks: skipping unhealthy tool %s", name)
            continue
        try:
            result = tool.run(**kwargs)
            if result.success:
                record_success(name)
                if name != tool_name:
                    log.info("tool_fallbacks: %s succeeded as fallback for %s", name, tool_name)
                return result
            else:
                record_failure(name, error=result.error)
                log.info("tool_fallbacks: %s failed (%s), trying next", name, result.error)
        except Exception as e:
            record_failure(name, error=str(e))
            log.warning("tool_fallbacks: %s raised %s, trying next", name, e)

    return None
