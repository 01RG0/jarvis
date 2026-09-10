"""Local test harness for PC agent tools — run without Azure brain connection."""
from __future__ import annotations

import sys
import time
import pathlib

# Add src/pc_agent to path
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent.parent))
sys.path.insert(0, str(pathlib.Path(__file__).parent))

# Load .env if present
try:
    from dotenv import load_dotenv
    load_dotenv(pathlib.Path(__file__).parent.parent.parent / ".env")
except ImportError:
    pass

Results: list[tuple[str, bool, str]] = []


def test(name: str):
    def decorator(fn):
        t0 = time.perf_counter()
        try:
            fn()
            elapsed = int((time.perf_counter() - t0) * 1000)
            Results.append((name, True, f"{elapsed}ms"))
            print(f"  PASS  {name} ({elapsed}ms)")
        except Exception as e:
            elapsed = int((time.perf_counter() - t0) * 1000)
            Results.append((name, False, str(e)))
            print(f"  FAIL  {name} — {e}")
    return decorator


print("\n=== JARVIS PC Agent — Local Tests ===\n")


@test("system stats")
def _():
    from tools.system import get_stats
    s = get_stats()
    assert "cpu_pct" in s and "ram_pct" in s, f"missing keys: {list(s.keys())}"
    assert 0 <= s["cpu_pct"] <= 100
    assert 0 <= s["ram_pct"] <= 100
    print(f"    CPU {s['cpu_pct']}%  RAM {s['ram_pct']}%")


@test("screenshot")
def _():
    from tools.screen import capture_screen
    b64 = capture_screen()
    assert isinstance(b64, str) and len(b64) > 1000, f"too short: {len(b64)}"
    print(f"    {len(b64):,} base64 chars")


@test("list windows")
def _():
    from tools.windows import list_windows
    wins = list_windows()
    assert isinstance(wins, list)
    print(f"    {len(wins)} windows found")


@test("file search")
def _():
    from tools.files import search_files
    root = str(pathlib.Path(__file__).parent.parent.parent)
    results = search_files("*.py", root)
    assert len(results) > 0, "no Python files found"
    print(f"    {len(results)} .py files found")


@test("web search")
def _():
    from tools.browser import search_web
    results = search_web("python")
    assert isinstance(results, list)
    print(f"    {len(results)} results (0 is ok if TAVILY_API_KEY not set)")


print(f"\n{'─'*40}")
passed = sum(1 for _, ok, _ in Results if ok)
total  = len(Results)
print(f"  {passed}/{total} tests passed\n")

if passed < total:
    print("  Failed tests:")
    for name, ok, detail in Results:
        if not ok:
            print(f"    - {name}: {detail}")
    print()
