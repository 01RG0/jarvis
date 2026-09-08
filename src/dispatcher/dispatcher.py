"""CLI sub-agent dispatcher for Jarvis.

Picks an available coding CLI (agy, grok, Codex, kilo, vibe), runs the
prompt in an isolated workdir, and returns a structured result. Risk
tiers are enforced before any subprocess is launched.
"""

import os
import pathlib
import shutil
import subprocess
import time

from cli_registry import build_command, detect_available_clis
from models import DispatchRequest, DispatchResult
from risk_gate import enforce_tier

JARVIS_DATA_DIR = os.environ.get("JARVIS_DATA_DIR", "./data")

# Preferred fallback order when request.preferred_cli is missing or unavailable.
_CLI_FALLBACK_ORDER = ("agy", "grok", "codex", "kilo", "vibe")


def dispatch(request: DispatchRequest) -> DispatchResult:
    """Run ``request.prompt`` on a CLI sub-agent and return the result.

    Raises:
        PermissionError: If ``request.tier >= 2`` and the action is not approved.
        RuntimeError: If no CLI sub-agents are installed/available.
    """
    # 1. Enforce risk tier — raises PermissionError if tier >= 2 without approval
    enforce_tier(request.tier, request.task_id)

    # 2. Pick CLI: use request.preferred_cli if available, else first available
    available = detect_available_clis()
    preferred = request.preferred_cli
    if preferred and available.get(preferred):
        cli = preferred
    else:
        cli = next((c for c in _CLI_FALLBACK_ORDER if available.get(c)), None)
    if not cli:
        raise RuntimeError("No CLI sub-agents available")

    # 3. Create isolated workdir for this task
    workdir = pathlib.Path(JARVIS_DATA_DIR) / "task-workdirs" / request.task_id
    workdir.mkdir(parents=True, exist_ok=True)

    # 4. Build command and run with timeout
    cmd = build_command(cli, request.prompt, str(workdir))
    start = time.time()
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=request.timeout_seconds,
            cwd=str(workdir),
        )
        stdout = result.stdout.strip()
        exit_code = result.returncode
    except subprocess.TimeoutExpired:
        return DispatchResult(
            task_id=request.task_id,
            cli=cli,
            stdout="",
            exit_code=-1,
            duration_seconds=request.timeout_seconds,
            success=False,
            error="Timeout",
        )
    except Exception as e:
        return DispatchResult(
            task_id=request.task_id,
            cli=cli,
            stdout="",
            exit_code=-1,
            duration_seconds=time.time() - start,
            success=False,
            error=str(e),
        )

    duration = time.time() - start
    # Treat empty stdout with exit 0 as suspicious (known agy headless bug)
    success = exit_code == 0 and len(stdout) > 0
    if success:
        error = ""
    elif exit_code == 0:
        error = result.stderr.strip() or "Empty output"
    else:
        error = result.stderr.strip()

    return DispatchResult(
        task_id=request.task_id,
        cli=cli,
        stdout=stdout,
        exit_code=exit_code,
        duration_seconds=duration,
        success=success,
        error=error,
    )
