"""PC agent tool registry.

TOOLS maps tool name → {fn, tier}. Tier controls whether the brain-side
security.py requires a toast approval before executing.
"""
from __future__ import annotations
from typing import Callable

# Populated lazily — each module registers on import
TOOLS: dict[str, dict] = {}


def register(name: str, fn: Callable, tier: str = "medium") -> None:
    TOOLS[name] = {"fn": fn, "tier": tier}


def load_all() -> None:
    from . import screen, system, windows, input_tools, files, browser, shell
    # Each module calls register() at import time.
    _ = screen, system, windows, input_tools, files, browser, shell
