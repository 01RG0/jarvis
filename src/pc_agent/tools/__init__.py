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
    from . import screen, system, windows, input_tools, files, browser, shell, audio
    _ = screen, system, windows, input_tools, files, browser, shell
    register("volume_get", audio.volume_get, "safe")
    register("volume_set", audio.volume_set, "safe")
    register("volume_mute", audio.volume_mute, "safe")
    register("media_play_pause", audio.media_play_pause, "safe")
    register("media_next", audio.media_next, "safe")
    register("media_prev", audio.media_prev, "safe")
