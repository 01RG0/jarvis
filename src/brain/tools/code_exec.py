"""Sandboxed Python + shell execution tool."""
import subprocess
import sys
import tempfile
import os
from ._base import JarvisTool, ToolResult

_BLOCKED = [
    "import os", "import subprocess", "import sys", "open(",
    "__import__", "eval(", "exec(", "shutil", "socket",
    "requests", "urllib", "http", "ftplib", "smtplib",
]


class CodeExecTool(JarvisTool):
    name = "run_python"
    description = "Execute a Python code snippet safely and return stdout/stderr"
    tags = ["python", "code", "execute", "run", "compute", "calculate", "script"]

    def run(self, code: str = "", **kwargs) -> ToolResult:
        if not code:
            return ToolResult(False, "", "code is required", self.name)

        # Block dangerous imports
        for pattern in _BLOCKED:
            if pattern in code:
                return ToolResult(False, "", f"Blocked: '{pattern}' not allowed in sandbox", self.name)

        with tempfile.NamedTemporaryFile(mode="w", suffix=".py",
                                         delete=False, encoding="utf-8") as f:
            f.write(code)
            tmp = f.name

        try:
            result = subprocess.run(
                [sys.executable, tmp],
                capture_output=True, text=True, timeout=10,
            )
            output = result.stdout[:3000] + (result.stderr[:1000] if result.stderr else "")
            return ToolResult(
                success=result.returncode == 0,
                output=output.strip() or "(no output)",
                error=result.stderr[:500] if result.returncode != 0 else "",
                tool_name=self.name,
            )
        except subprocess.TimeoutExpired:
            return ToolResult(False, "", "Execution timed out (10s)", self.name)
        except Exception as e:
            return ToolResult(False, "", str(e), self.name)
        finally:
            os.unlink(tmp)
