# Research: CLI Sub-Agent Dispatcher

**Verdict: Build a thin dispatcher in Phase 3. Use the sub-agent-cli-swarm pattern as the reference.**

## What it is

The CLI dispatcher treats installed AI CLIs (Claude Code/Codex, agy, kilo, freebuff) as
callable sub-agents. Instead of Jarvis doing all the work itself, it dispatches specific
task types to the CLI best suited for them — coding tasks to Codex, research tasks to agy,
cheap boilerplate to freebuff — and returns the result.

## Available CLIs (detected at runtime)

```bash
which codex     # OpenAI Codex CLI — coding tasks, pays for quality
which agy       # Anthropic/Claude CLI — strong reasoning, long context
which kilo      # Multi-model via OpenRouter — configurable, BYO model
which freebuff  # Ad-supported, free — boilerplate, scaffolding
which grok      # xAI Grok — reasoning-heavy tasks; uses XAI_API_KEY / GROK_API_KEY
which agent     # xAI Grok alternative binary name (check which is installed)
which vibe      # Mistral Vibe CLI — fast code gen, uses MISTRAL_API_KEY
```

Check via `subprocess.run(["which", cli], capture_output=True).returncode == 0`.

## Non-Interactive Invocation Patterns

```bash
# Codex (non-interactive exec mode)
codex exec \
  --skip-git-repo-check \
  -s workspace-write \
  -C /path/to/workdir \
  "your prompt here"

# agy (Claude CLI, non-interactive print mode)
# IMPORTANT: --dangerously-skip-permissions must come BEFORE --print
agy --dangerously-skip-permissions --print "your prompt here"

# kilo
kilo run "your prompt" --dir /path/to/workdir

# freebuff (check current flags — API changes frequently)
freebuff run "your prompt"
```

## Python Dispatcher Implementation

```python
import subprocess
import shutil
import os
import time
from pathlib import Path
from dataclasses import dataclass

@dataclass
class DispatchResult:
    cli: str
    stdout: str
    exit_code: int
    duration_seconds: float
    task_id: str

def detect_installed_clis() -> dict[str, bool]:
    return {cli: shutil.which(cli) is not None for cli in ["codex", "agy", "kilo", "freebuff"]}

def dispatch(
    task_id: str,
    prompt: str,
    preferred_cli: str = "agy",
    workdir: str | None = None,
    timeout_seconds: int = 300,
) -> DispatchResult:
    available = detect_installed_clis()
    cli_order = [preferred_cli] + [c for c in ["agy", "kilo", "codex", "freebuff"] if c != preferred_cli]
    cli = next((c for c in cli_order if available.get(c)), None)
    
    if cli is None:
        raise RuntimeError("No CLI sub-agents installed")

    workdir = workdir or str(Path(os.environ.get("JARVIS_DATA_DIR", "./data")) / "task-workdirs" / task_id)
    Path(workdir).mkdir(parents=True, exist_ok=True)
    
    cmd = _build_command(cli, prompt, workdir)
    
    start = time.time()
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            cwd=workdir,
        )
    except subprocess.TimeoutExpired:
        return DispatchResult(cli=cli, stdout="", exit_code=-1, duration_seconds=timeout_seconds, task_id=task_id)
    
    return DispatchResult(
        cli=cli,
        stdout=result.stdout,
        exit_code=result.returncode,
        duration_seconds=time.time() - start,
        task_id=task_id,
    )

def _build_command(cli: str, prompt: str, workdir: str) -> list[str]:
    if cli == "codex":
        return ["codex", "exec", "--skip-git-repo-check", "-s", "workspace-write", "-C", workdir, prompt]
    elif cli == "agy":
        # NOTE: --dangerously-skip-permissions MUST come before --print
        # Use --print=<prompt> (not a separate arg) to avoid flag parsing issues
        return ["agy", "--dangerously-skip-permissions", f"--print={prompt}"]
    elif cli == "kilo":
        return ["kilo", "run", prompt, "--dir", workdir]
    elif cli == "freebuff":
        # NOTE: freebuff has a spawn EFTYPE error on Windows — Linux/Azure only
        return ["freebuff", "run", prompt]
    elif cli in ("grok", "agent"):
        # xAI Grok CLI — check `grok --help` for current non-interactive flags
        # Uses XAI_API_KEY or GROK_API_KEY env var
        return [cli, "--prompt", prompt]
    elif cli == "vibe":
        # Mistral Vibe CLI — check `vibe --help` for current non-interactive flags
        # Uses MISTRAL_API_KEY env var
        return ["vibe", "--print", prompt]
    raise ValueError(f"Unknown CLI: {cli}")
```

## Risk-Tier Gate

Before any dispatch, check the tier:

```python
def safe_dispatch(task_id, prompt, tier: int, **kwargs):
    if tier >= 2:
        raise PermissionError(f"Tier {tier} action requires user confirmation before dispatch")
    if tier == 1:
        result = dispatch(task_id, prompt, **kwargs)
        log_to_dashboard(task_id, result)
        return result
    return dispatch(task_id, prompt, **kwargs)
```

## Self-Contained Prompt Pattern

Sub-agents have NO context about the conversation. Every prompt must include:
1. What to build / what problem to solve
2. Exact file paths to write to
3. Constraints (language, libraries, interfaces to implement)
4. Acceptance criteria (what does "done" look like)

Bad: `"Fix the bug in the LangGraph planner"`  
Good: `"The file src/brain/planner.py has a bug in the route_node function (line 34): it returns 'slow' for all inputs. Fix it to route queries shorter than 50 words to 'fast' and longer to 'slow'. Do not modify any other function."`

## Gotchas

- **agy flag ordering:** `--dangerously-skip-permissions` must come before `--print`, otherwise `--print` consumes it as the prompt text
- **Codex quota:** Codex exec uses your ChatGPT/OpenAI quota — it can hit rate limits. Use agy/kilo as primary for most tasks
- **agy headless bug:** In some versions, agy exits 0 with empty stdout when a permission is denied. Check `len(result.stdout) > 0` before treating a 0 exit as success
- **Windows:** freebuff has a spawn (EFTYPE) error on Windows Git Bash — don't use it on Windows hosts

## Resources

- sub-agent-cli-swarm skill: `C:\Users\ahmed\.claude\skills\sub-agent-cli-swarm\`
- Codex CLI: `codex exec --help`
- agy CLI: `agy --help`
