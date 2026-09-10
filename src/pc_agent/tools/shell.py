"""Sandboxed shell command execution — DANGEROUS tier."""
from __future__ import annotations

import asyncio
import subprocess

from . import register
from ..security import is_blocked_cmd


def run_command(cmd: str, timeout: int = 30) -> dict:
    if is_blocked_cmd(cmd):
        return {"ok": False, "stdout": "", "stderr": "Blocked: command contains forbidden pattern", "returncode": -1}

    try:
        result = subprocess.run(
            ["cmd", "/c", cmd],    # Never shell=True — pass as list to avoid injection
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return {
            "ok": result.returncode == 0,
            "stdout": result.stdout[:4000],
            "stderr": result.stderr[:2000],
            "returncode": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "stdout": "", "stderr": f"Timed out after {timeout}s", "returncode": -1}
    except Exception as e:
        return {"ok": False, "stdout": "", "stderr": str(e), "returncode": -1}


register("run_command", run_command, tier="dangerous")
