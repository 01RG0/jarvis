#!/usr/bin/env python3
"""Claude Code hook handler — logs events to .claude/hooks/logs/"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

LOG_DIR = Path(__file__).parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / "events.jsonl"

def main():
    event = {
        "ts": datetime.utcnow().isoformat(),
        "event": os.environ.get("CLAUDE_HOOK_EVENT", "unknown"),
        "tool": os.environ.get("CLAUDE_TOOL_NAME", ""),
        "session": os.environ.get("CLAUDE_SESSION_ID", ""),
    }

    stdin_data = ""
    if not sys.stdin.isatty():
        try:
            stdin_data = sys.stdin.read(4096)
            if stdin_data:
                parsed = json.loads(stdin_data)
                event["tool_input"] = parsed.get("tool_input", {})
        except (json.JSONDecodeError, ValueError):
            event["raw"] = stdin_data[:256]

    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(event) + "\n")

if __name__ == "__main__":
    main()
