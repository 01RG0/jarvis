"""Built-in: read a local file and return its contents (restricted to JARVIS_DATA_DIR)."""
import os
import pathlib

from ._base import JarvisTool, ToolResult

TOOL_NAME = "read_file"
TOOL_DESCRIPTION = "Read the contents of a local file on the system"
TOOL_TAGS = ["file", "read", "open", "load", "contents", "text"]

_ALLOWED_DIR = pathlib.Path(os.environ.get("JARVIS_DATA_DIR", "./data")).resolve()


class ReadFileTool(JarvisTool):
    name = TOOL_NAME
    description = TOOL_DESCRIPTION
    tags = TOOL_TAGS

    def run(self, path: str = "", **kwargs) -> ToolResult:
        if not path:
            return ToolResult(success=False, output="", error="path is required", tool_name=self.name)
        resolved = pathlib.Path(os.path.expanduser(path)).resolve()
        try:
            resolved.relative_to(_ALLOWED_DIR)
        except ValueError:
            return ToolResult(
                success=False,
                output="",
                error=f"Path must be within {_ALLOWED_DIR}",
                tool_name=self.name,
            )
        try:
            with open(resolved, "r", encoding="utf-8", errors="replace") as f:
                content = f.read(32768)
            return ToolResult(success=True, output=content, tool_name=self.name)
        except Exception as e:
            return ToolResult(success=False, output="", error=str(e), tool_name=self.name)
