import os
import shutil
import subprocess
import json
from pathlib import Path
from ._base import JarvisTool, ToolResult

_KNOWN_CODING_AGENTS = [
    "jules", "grok", "agent", "agy", "codex", "kilo", "kilocode",
    "freebuff", "cursor", "cursor-agent", "vibe", "hermes",
    "cline", "cline-cli", "continue", "continue-cli", "opencode",
]

_PATTERN_KEYWORDS = [
    "code", "agent", "copilot", "coder", "llm", "gemini", "openai",
    "claude", "mistral", "forge", "pilot", "codegen", "ai", "dev",
    "hermes", "mercury", "atlas", "aria", "cline", "continue",
]


def _scan_path_for_agents() -> dict[str, str]:
    """Scans PATH for coding/AI agent CLIs. Returns {name: full_path}."""
    found: dict[str, str] = {}
    seen: set[str] = set()
    path_dirs = os.environ.get("PATH", "").split(os.pathsep)
    for d in path_dirs:
        try:
            entries = os.listdir(d)
        except OSError:
            continue
        for entry in entries:
            name = entry.lower()
            name_no_ext = Path(name).stem
            if name_no_ext in seen:
                continue
            matches_known = name_no_ext in _KNOWN_CODING_AGENTS
            matches_pattern = any(kw in name_no_ext for kw in _PATTERN_KEYWORDS)
            if matches_known or matches_pattern:
                full = shutil.which(name_no_ext)
                if full:
                    seen.add(name_no_ext)
                    found[name_no_ext] = full
    return found


def _check_cli_version(binary: str) -> str:
    """Returns version string or empty string if unavailable."""
    try:
        result = subprocess.run(
            [binary, "--version"],
            capture_output=True, text=True, timeout=5
        )
        line = (result.stdout or result.stderr or "").strip().splitlines()
        return line[0] if line else ""
    except Exception:
        return ""


class CLIProbeTool(JarvisTool):
    name = "cli_probe"
    description = "detect and list all coding AI agent CLIs installed on this machine"
    tags = ["cli", "detect", "probe", "tools", "agents", "installed"]

    def run(self, task: str = "", **kwargs) -> ToolResult:
        agents = _scan_path_for_agents()
        manifest = {}
        for name, path in sorted(agents.items()):
            manifest[name] = {
                "path": path,
                "version": _check_cli_version(path),
            }
        manifest_path = Path(os.environ.get("JARVIS_DATA_DIR", "./data")) / "cli_manifest.json"
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        with open(manifest_path, "w") as f:
            json.dump(manifest, f, indent=2)
        summary = ", ".join(manifest.keys()) if manifest else "none found"
        return ToolResult(
            success=True,
            output=f"Found {len(manifest)} CLI agent(s): {summary}\nManifest saved to {manifest_path}",
            tool_name=self.name,
        )
