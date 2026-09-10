"""Clap detection wake trigger.

Listens to the default microphone for double-clap patterns.
A double clap (two spikes within 0.8s with a gap of at least 0.1s) fires
the configured action (default: send_notification to JARVIS UI, or speak).

Uses sounddevice + numpy — no cloud API, runs entirely on-device.
"""
from __future__ import annotations

import logging
import os
import time
from collections import deque
from typing import Callable

log = logging.getLogger("clap_trigger")

# Tunable via env
THRESHOLD     = float(os.environ.get("CLAP_THRESHOLD",     "0.35"))   # RMS amplitude
MIN_GAP_S     = float(os.environ.get("CLAP_MIN_GAP_S",     "0.10"))   # min gap between claps
MAX_GAP_S     = float(os.environ.get("CLAP_MAX_GAP_S",     "0.80"))   # max gap for double-clap
SAMPLERATE    = int(os.environ.get("CLAP_SAMPLERATE",      "16000"))
BLOCK_SIZE    = int(os.environ.get("CLAP_BLOCK_SIZE",      "512"))


def _rms(block) -> float:
    import numpy as np
    return float(np.sqrt(np.mean(block ** 2)))


def start_clap_watcher(on_double_clap: Callable | None = None) -> None:
    """Block forever, calling on_double_clap() on each double-clap detected."""
    try:
        import sounddevice as sd
        import numpy as np
    except ImportError:
        log.warning("sounddevice/numpy not installed — clap trigger disabled")
        return

    if on_double_clap is None:
        on_double_clap = _default_action

    clap_times: deque[float] = deque(maxlen=4)
    in_clap = False

    def callback(indata, frames, time_info, status):
        nonlocal in_clap
        rms = _rms(indata)
        now = time.monotonic()
        if rms > THRESHOLD and not in_clap:
            in_clap = True
            clap_times.append(now)
            # Check if this is the 2nd clap of a double-clap
            if len(clap_times) >= 2:
                gap = clap_times[-1] - clap_times[-2]
                if MIN_GAP_S < gap < MAX_GAP_S:
                    clap_times.clear()
                    try:
                        on_double_clap()
                    except Exception as e:
                        log.error(f"Double-clap action error: {e}")
        elif rms < THRESHOLD * 0.5:
            in_clap = False

    log.info("Clap trigger listening (double-clap to activate JARVIS)")
    with sd.InputStream(
        samplerate=SAMPLERATE,
        channels=1,
        dtype="float32",
        blocksize=BLOCK_SIZE,
        callback=callback,
    ):
        while True:
            time.sleep(0.1)


def _default_action() -> None:
    """Default: send a Windows toast to acknowledge the wake trigger."""
    log.info("Double-clap detected — activating JARVIS")
    try:
        from .tools.system import send_notification
        send_notification("JARVIS", "Listening... (clap trigger)")
    except Exception:
        pass
    # Optionally trigger voice pipeline if it's running
    try:
        import urllib.request
        urllib.request.urlopen(
            "http://localhost:8001/api/clap-wake", timeout=2
        ).read()
    except Exception:
        pass
