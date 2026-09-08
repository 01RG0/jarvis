"""Built-in: execute a Python snippet in a restricted sandbox and return stdout."""
import subprocess
import sys
import tempfile
import os

from ._base import JarvisTool, ToolResult

TOOL_NAME = "run_python"
TOOL_DESCRIPTION = "Execute a Python code snippet and return its stdout output"
TOOL_TAGS = ["python", "code", "execute", "run", "compute", "calculate", "script"]


class RunPythonTool(JarvisTool):
    name = TOOL_NAME
    description = TOOL_DESCRIPTION
    tags = TOOL_TAGS

    # Blocked imports that could escape the sandbox
    _BLOCKED = {"os.system", "subprocess", "socket", "ctypes", "__import__"}

    def run(self, code: str = "", timeout: int = 10, **kwargs) -> ToolResult:
        if not code:
            return ToolResult(success=False, output="", error="code is required", tool_name=self.name)
        for blocked in self._BLOCKED:
            if blocked in code:
                return ToolResult(success=False, output="", error=f"Blocked: {blocked}", tool_name=self.name)
        try:
            with tempfile.NamedTemporaryFile(suffix=".py", mode="w", delete=False, encoding="utf-8") as f:
                f.write(code)
                tmp = f.name
            result = subprocess.run(
                [sys.executable, tmp],
                capture_output=True, text=True, timeout=timeout,
            )
            os.unlink(tmp)
            if result.returncode != 0:
                return ToolResult(success=False, output=result.stdout, error=result.stderr, tool_name=self.name)
            return ToolResult(success=True, output=result.stdout.strip(), tool_name=self.name)
        except subprocess.TimeoutExpired:
            return ToolResult(success=False, output="", error=f"Timeout after {timeout}s", tool_name=self.name)
        except Exception as e:
            return ToolResult(success=False, output="", error=str(e), tool_name=self.name)
