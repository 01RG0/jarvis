---
name: auto-skill-creator
description: Meta-skill that creates new Claude Code skills on demand. Knows the full SKILL.md schema, validates frontmatter, writes files, and updates the skill index. Used by the skill-forger agent and the skill_forge.py runtime.
allowed-tools: Read, Write, Bash, Glob
user-invocable: false
---

# Auto Skill Creator

## SKILL.md Schema (complete)

```yaml
---
name: <kebab-case-name>           # matches directory name
description: <when to invoke>     # shown in skill picker
argument-hint: "[optional hint]"  # autocomplete hint
disable-model-invocation: false   # set true to block auto-invoke
user-invocable: true              # false = background knowledge only
allowed-tools: Read, Write, Bash  # tools allowed without prompts
model: sonnet                     # haiku | sonnet | opus | inherit
context: fork                     # fork = isolated subagent context
agent: general-purpose            # agent type when context: fork
hooks:                            # skill-scoped lifecycle hooks
  Stop: [...]
---
```

Only `name` and `description` are required. Omit fields that use defaults.

## Writing a New Skill

1. Determine the skill name (kebab-case, ≤30 chars)
2. Create directory: `.claude/skills/<name>/`
3. Write `SKILL.md` with frontmatter + instructions
4. Register in `.claude/skills/SKILL-INDEX.json`

### SKILL-INDEX.json entry
```json
{
  "name": "<name>",
  "description": "<one-line description>",
  "path": ".claude/skills/<name>/SKILL.md",
  "created_by": "skill-forger",
  "created_at": "<ISO date>",
  "tags": ["<tag>"]
}
```

## Quality Checklist
- [ ] Description says WHEN to invoke (not what it does)
- [ ] `allowed-tools` is minimal — only what the skill needs
- [ ] Instructions are actionable, not descriptive
- [ ] No hardcoded file paths — use env vars or relative references
- [ ] If skill writes files, uses `os.open` with `0o600` for sensitive data

## Skill Gap Detection Patterns
A skill gap exists when:
- LLM output contains "I don't know how to", "I can't", "no tool available"
- A task type recurs ≥2 times with no existing skill match
- A CLI fails with "command not found" and no fallback skill covers it
- User asks for a capability not in `.claude/skills/SKILL-INDEX.json`
