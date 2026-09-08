"""Autonomous skill creation runtime.

Detects capability gaps, generates skill definitions via LLM,
writes them to .claude/skills/, and registers them.
"""
import pathlib
import re
import textwrap
from typing import Optional

from llm_router import call_llm
from skill_registry import SKILLS_DIR, find_skill_for_task, get_skill_content, register_skill

_SKILL_TEMPLATE = textwrap.dedent("""\
    ---
    name: {name}
    description: {description}
    allowed-tools: {tools}
    user-invocable: {user_invocable}
    ---

    # {title}

    {body}
""")

_FORGE_SYSTEM = """\
You are a Claude Code skill designer for the Jarvis AI system.
A skill is a Markdown file with YAML frontmatter loaded into Claude's context to guide behavior.

When asked to design a skill, respond with ONLY a JSON object (no prose, no markdown fences):
{
  "name": "kebab-case-name",
  "description": "one sentence starting with a verb, says WHEN to invoke",
  "tools": ["Read", "Write", "Bash"],
  "user_invocable": true,
  "title": "Human-Readable Title",
  "body": "Full skill instructions in Markdown. Be specific, actionable, and concise.",
  "tags": ["tag1", "tag2"],
  "cli_adapter": "Plain-text version of instructions for CLI sub-agents (no frontmatter)"
}
"""


def forge_skill(capability_description: str, dry_run: bool = False) -> dict:
    """Generate and write a new skill from a natural-language description."""
    existing_name = find_skill_for_task(capability_description)
    if existing_name:
        return {"status": "exists", "skill": existing_name}

    prompt = f"Design a Claude Code skill for this capability:\n\n{capability_description}"
    response = call_llm("smart", _FORGE_SYSTEM + "\n\n" + prompt)
    content = response["content"].strip()

    content = re.sub(r"^```json\s*", "", content)
    content = re.sub(r"\s*```$", "", content)

    import json
    spec = json.loads(content)

    name = spec["name"]
    skill_dir = SKILLS_DIR / name
    skill_md = skill_dir / "SKILL.md"
    adapter_md = skill_dir / "cli-adapter.md"

    if not dry_run:
        skill_dir.mkdir(parents=True, exist_ok=True)
        skill_md.write_text(
            _SKILL_TEMPLATE.format(
                name=name,
                description=spec["description"],
                tools=", ".join(spec.get("tools", ["Read"])),
                user_invocable=str(spec.get("user_invocable", True)).lower(),
                title=spec["title"],
                body=spec["body"],
            ),
            encoding="utf-8",
        )
        if spec.get("cli_adapter"):
            adapter_md.write_text(spec["cli_adapter"], encoding="utf-8")

        register_skill(
            name=name,
            description=spec["description"],
            path=str(skill_md.relative_to(SKILLS_DIR.parent.parent)),
            tags=spec.get("tags", []),
            cli_adapter=str(adapter_md.relative_to(SKILLS_DIR.parent.parent)) if spec.get("cli_adapter") else None,
        )

    return {
        "status": "created",
        "name": name,
        "path": str(skill_md),
        "description": spec["description"],
        "tags": spec.get("tags", []),
    }


def detect_skill_gap(task_output: str, task_description: str) -> Optional[str]:
    """Return a capability description if the output suggests a skill gap, else None."""
    gap_signals = [
        "i don't know how to",
        "i can't",
        "no tool available",
        "unable to",
        "i'm not able to",
        "i cannot",
        "don't have access to",
    ]
    output_lower = task_output.lower()
    if any(sig in output_lower for sig in gap_signals):
        return task_description
    return None


def auto_forge_from_gap(task_output: str, task_description: str) -> Optional[dict]:
    """Detect a gap in task_output and forge a skill if needed. Returns None if no gap."""
    gap = detect_skill_gap(task_output, task_description)
    if not gap:
        return None
    return forge_skill(gap)
