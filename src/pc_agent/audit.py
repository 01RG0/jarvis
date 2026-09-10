"""Append-only audit log at %APPDATA%\\JARVIS\\audit.log."""
from __future__ import annotations

import json
import os
import pathlib
from datetime import datetime, timezone


def _log_path() -> pathlib.Path:
    base = pathlib.Path(os.environ.get("APPDATA", "~")).expanduser() / "JARVIS"
    base.mkdir(parents=True, exist_ok=True)
    return base / "audit.log"


def log(
    tool: str,
    args: dict,
    tier: str,
    approved: bool,
    result_ok: bool,
    elapsed_ms: int,
) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    decision = "AUTO" if tier in ("safe", "medium") else ("APPROVE" if approved else "DENY")
    status = "ok" if result_ok else "fail"
    detail = json.dumps(args)[:80] if args else ""
    line = f"{ts}  {tool:<20} {tier:<10} {decision:<8} {status:<5} {elapsed_ms:>6}ms  {detail}\n"
    try:
        with open(_log_path(), "a", encoding="utf-8") as f:
            f.write(line)
    except Exception:
        pass
