import json
import os
import pathlib
from typing import Optional

SKILLS_DIR = pathlib.Path(__file__).parent.parent.parent / ".claude" / "skills"
INDEX_FILE = SKILLS_DIR / "SKILL-INDEX.json"


def _load_index() -> list[dict]:
    if not INDEX_FILE.exists():
        return []
    data = json.loads(INDEX_FILE.read_text(encoding="utf-8"))
    return data.get("skills", [])


def _save_index(skills: list[dict]) -> None:
    INDEX_FILE.write_text(
        json.dumps({"skills": skills}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def list_skills() -> list[dict]:
    return _load_index()


def get_skill_content(name: str) -> Optional[str]:
    skills = _load_index()
    entry = next((s for s in skills if s["name"] == name), None)
    if not entry:
        skill_path = SKILLS_DIR / name / "SKILL.md"
        if skill_path.exists():
            return skill_path.read_text(encoding="utf-8")
        return None
    path = pathlib.Path(entry["path"])
    if not path.is_absolute():
        path = SKILLS_DIR.parent.parent / path
    return path.read_text(encoding="utf-8") if path.exists() else None


def get_cli_adapter(name: str) -> Optional[str]:
    adapter = SKILLS_DIR / name / "cli-adapter.md"
    return adapter.read_text(encoding="utf-8") if adapter.exists() else None


def find_skill_for_task(task_description: str) -> Optional[str]:
    """Simple keyword match — returns the best-matching skill name or None."""
    skills = _load_index()
    if not skills:
        return None
    task_lower = task_description.lower()
    scored = []
    for skill in skills:
        desc = (skill.get("description", "") + " " + " ".join(skill.get("tags", []))).lower()
        score = sum(1 for word in task_lower.split() if len(word) > 3 and word in desc)
        if score > 0:
            scored.append((score, skill["name"]))
    scored.sort(reverse=True)
    return scored[0][1] if scored else None


def register_skill(name: str, description: str, path: str, tags: list[str] = None, cli_adapter: str = None) -> None:
    from datetime import datetime
    skills = _load_index()
    skills = [s for s in skills if s["name"] != name]
    entry: dict = {
        "name": name,
        "description": description,
        "path": path,
        "created_by": "skill-forger",
        "created_at": datetime.utcnow().isoformat() + "Z",
        "tags": tags or [],
    }
    if cli_adapter:
        entry["cli_adapter"] = cli_adapter
    skills.append(entry)
    _save_index(skills)
