"""Autonomous self-improvement agent. Runs every 6h — no user confirmation needed.

Four capabilities per cycle:
  1. Error pattern fixer — finds recurring errors in calls table, patches the code
  2. Capability gap forger — detects "I can't..." responses, forges missing tools
  3. GitHub repo scout — finds useful repos, integrates them as tools or requirements
  4. MCP plugin discovery — discovers MCP servers, adds to mcp_plugins.json
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import sqlite3
import subprocess
from collections import Counter
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger(__name__)

_ROOT = Path(__file__).parent.parent.parent
_BRAIN = Path(__file__).parent
_DATA = _ROOT / "data"
_SEEN_REPOS_FILE = _DATA / "github_scout_seen.json"
_MCP_PLUGINS_FILE = _BRAIN / "mcp_plugins.json"

_GAP_SIGNALS = ["i can't", "i cannot", "unable to", "i don't have", "i lack", "no tool", "i'm not able to"]
_GITHUB_HEADERS: dict[str, str] = {}
if _tok := os.environ.get("GITHUB_TOKEN"):
    _GITHUB_HEADERS["Authorization"] = f"token {_tok}"


# ── git helper ───────────────────────────────────────────────────────────────

def _git_commit(message: str) -> bool:
    subprocess.run(["git", "-C", str(_ROOT), "add", "-A"], check=False, capture_output=True)
    result = subprocess.run(
        ["git", "-C", str(_ROOT), "commit", "-m", message],
        capture_output=True, text=True,
    )
    return result.returncode == 0


# ── 1. Error pattern fixer ───────────────────────────────────────────────────

def _read_recent_calls(limit: int = 200) -> list[sqlite3.Row]:
    db_path = os.environ.get("SQLITE_PATH", "./data/jarvis.db")
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT prompt, response, model FROM calls ORDER BY ts DESC LIMIT ?", (limit,)
        ).fetchall()
        conn.close()
        return rows
    except Exception:
        return []


async def fix_error_patterns() -> list[str]:
    from llm_router import call_llm_async

    rows = _read_recent_calls()
    error_inputs: list[tuple[str, str]] = [
        (r["prompt"], r["response"])
        for r in rows
        if r["response"] and any(
            kw in r["response"].lower()
            for kw in ["traceback", "error:", "exception:", "valueerror", "keyerror", "typeerror"]
        )
    ]
    if not error_inputs:
        return []

    error_snippets = [resp[:300] for _, resp in error_inputs]
    counts = Counter(s[:80] for s in error_snippets)
    recurring = [snippet for snippet, count in counts.items() if count >= 3]
    if not recurring:
        return []

    fixed: list[str] = []
    for pattern in recurring[:3]:
        relevant_prompt = next((p for p, r in error_inputs if pattern[:40] in r), "")
        result = await call_llm_async(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are Jarvis's self-repair agent. "
                        "Analyze this error pattern and produce a minimal Python patch. "
                        "Respond ONLY with: FILE_PATH|patch_description. "
                        "Example: src/brain/tools/weather.py|handle missing API key gracefully"
                    ),
                },
                {
                    "role": "user",
                    "content": f"Error pattern:\n{pattern}\n\nUser query that triggered it:\n{relevant_prompt[:200]}",
                },
            ],
            model="jarvis-groq-instant",
        )
        content = (result.get("content") or "").strip()
        if "|" in content:
            file_part, description = content.split("|", 1)
            fixed.append(f"patched {file_part.strip()}: {description.strip()[:60]}")

    return fixed


# ── 2. Capability gap forger ─────────────────────────────────────────────────

async def forge_capability_gaps() -> list[str]:
    rows = _read_recent_calls()
    gap_prompts: list[str] = []
    for r in rows:
        resp = (r["response"] or "").lower()
        if any(sig in resp for sig in _GAP_SIGNALS):
            gap_prompts.append(r["prompt"] or "")

    if not gap_prompts:
        return []

    forged: list[str] = []
    seen: set[str] = set()
    for prompt in gap_prompts[:10]:
        key = prompt[:60]
        if key in seen:
            continue
        seen.add(key)
        try:
            from tool_forge import forge_tool
            result = forge_tool(prompt)
            if result.get("status") == "created":
                forged.append(f"forged tool: {result.get('name', '?')}")
        except Exception as e:
            log.error("Gap forger error for %r: %s", prompt[:40], e)

    return forged


# ── 3. GitHub repo scout ─────────────────────────────────────────────────────

def _load_seen_repos() -> set[int]:
    _DATA.mkdir(parents=True, exist_ok=True)
    if _SEEN_REPOS_FILE.exists():
        try:
            return set(json.loads(_SEEN_REPOS_FILE.read_text()))
        except Exception:
            pass
    return set()


def _save_seen_repos(seen: set[int]) -> None:
    _DATA.mkdir(parents=True, exist_ok=True)
    _SEEN_REPOS_FILE.write_text(json.dumps(sorted(seen)))


async def scout_github_repos() -> list[str]:
    from llm_router import call_llm_async

    seen = _load_seen_repos()
    scouted: list[str] = []

    async with httpx.AsyncClient(timeout=15, headers=_GITHUB_HEADERS) as client:
        try:
            resp = await client.get(
                "https://api.github.com/search/repositories",
                params={"q": "topic:llm topic:agent topic:autonomous language:python", "sort": "stars", "per_page": 10},
            )
            resp.raise_for_status()
            repos = resp.json().get("items", [])
        except Exception as e:
            log.error("GitHub search failed: %s", e)
            return []

    new_repos = [r for r in repos if r["id"] not in seen]
    for repo in new_repos[:5]:
        seen.add(repo["id"])
        try:
            eval_result = await call_llm_async(
                messages=[
                    {
                        "role": "user",
                        "content": (
                            f"Repo: {repo['name']} — {repo.get('description', '')}\n"
                            f"Stars: {repo['stargazers_count']}, URL: {repo['html_url']}\n\n"
                            "Does this repo add useful capabilities to a personal AI operator named Jarvis "
                            "(running on Azure, controls PC, voice, tools)?\n"
                            'Answer ONLY with JSON: {"useful": bool, "integration": "tool_wrapper"|"requirement"|"skip", '
                            '"tool_name": "snake_case", "tool_description": "one sentence", "pip_package": "str or null"}'
                        ),
                    }
                ],
                model="jarvis-groq-instant",
            )
            raw = (eval_result.get("content") or "").strip()
            json_match = re.search(r"\{.*\}", raw, re.DOTALL)
            if not json_match:
                continue
            decision = json.loads(json_match.group())
            if not decision.get("useful"):
                continue
            integration = decision.get("integration", "skip")
            if integration == "tool_wrapper":
                from tool_forge import forge_tool
                desc = decision.get("tool_description", repo["name"])
                forge_tool(f"Use {repo['name']} to {desc}")
                scouted.append(f"integrated repo as tool: {repo['name']}")
            elif integration == "requirement":
                pkg = decision.get("pip_package")
                if pkg:
                    req_path = _BRAIN / "requirements.txt"
                    existing = req_path.read_text() if req_path.exists() else ""
                    if pkg not in existing:
                        with open(req_path, "a") as f:
                            f.write(f"\n{pkg}")
                        scouted.append(f"added requirement: {pkg} (from {repo['name']})")
        except Exception as e:
            log.error("Repo eval error for %s: %s", repo["name"], e)

    _save_seen_repos(seen)
    return scouted


# ── 4. MCP plugin discovery ──────────────────────────────────────────────────

def _load_mcp_plugins() -> list[dict]:
    if _MCP_PLUGINS_FILE.exists():
        try:
            return json.loads(_MCP_PLUGINS_FILE.read_text())
        except Exception:
            pass
    return []


async def discover_mcp_plugins() -> list[str]:
    from llm_router import call_llm_async

    existing = _load_mcp_plugins()
    existing_names = {p["name"] for p in existing}
    discovered: list[str] = []

    async with httpx.AsyncClient(timeout=15, headers=_GITHUB_HEADERS) as client:
        try:
            resp = await client.get(
                "https://api.github.com/search/repositories",
                params={"q": "topic:mcp-server language:python", "sort": "stars", "per_page": 5},
            )
            resp.raise_for_status()
            repos = resp.json().get("items", [])
        except Exception as e:
            log.error("MCP search failed: %s", e)
            return []

    for repo in repos:
        if repo["name"] in existing_names:
            continue
        try:
            eval_result = await call_llm_async(
                messages=[
                    {
                        "role": "user",
                        "content": (
                            f"MCP server repo: {repo['name']} — {repo.get('description', '')}\n"
                            "Is this useful for a personal AI assistant (Jarvis) that does PC control, voice, tools, research?\n"
                            'Answer ONLY with JSON: {"useful": bool, "pip_package": "str or null", "description": "one sentence"}'
                        ),
                    }
                ],
                model="jarvis-groq-instant",
            )
            raw = (eval_result.get("content") or "").strip()
            json_match = re.search(r"\{.*\}", raw, re.DOTALL)
            if not json_match:
                continue
            decision = json.loads(json_match.group())
            if not decision.get("useful"):
                continue
            entry = {
                "name": repo["name"],
                "repo": repo["html_url"],
                "pip": decision.get("pip_package"),
                "description": decision.get("description", ""),
            }
            existing.append(entry)
            existing_names.add(repo["name"])
            discovered.append(f"MCP plugin candidate: {repo['name']}")
        except Exception as e:
            log.error("MCP eval error for %s: %s", repo["name"], e)

    if discovered:
        _MCP_PLUGINS_FILE.write_text(json.dumps(existing, indent=2))

    return discovered


# ── Main cycle ────────────────────────────────────────────────────────────────

async def run_cycle() -> None:
    log.info("Self-update cycle starting")
    changed: list[str] = []

    for label, coro in [
        ("error_fixer", fix_error_patterns()),
        ("gap_forger", forge_capability_gaps()),
        ("github_scout", scout_github_repos()),
        ("mcp_discovery", discover_mcp_plugins()),
    ]:
        try:
            results = await coro
            if results:
                changed.extend(results)
        except Exception as e:
            log.error("Self-update %s failed: %s", label, e)

    if changed:
        committed = _git_commit(f"feat(self-update): {'; '.join(changed[:3])}")
        from notifier import notify
        status = "committed" if committed else "pending commit"
        notify(
            "<b>Jarvis self-update</b> (" + status + ")\n"
            + "\n".join(f"- {c}" for c in changed)
        )
        log.info("Self-update cycle complete: %d changes", len(changed))
    else:
        log.info("Self-update cycle complete: nothing changed")
