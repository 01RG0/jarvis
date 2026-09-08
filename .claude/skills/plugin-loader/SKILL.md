---
name: plugin-loader
description: Knows how to discover, load, and apply Claude Code plugins and skills at runtime. Used when Jarvis needs to pick the right tool/plugin for a task from all available options.
allowed-tools: Read, Glob, Bash
user-invocable: false
---

# Plugin Loader Skill

## Discovering Available Skills
```bash
# List all skills
ls D:/pRoG/jarvis/.claude/skills/

# Read skill index
cat D:/pRoG/jarvis/.claude/skills/SKILL-INDEX.json
```

## Picking the Right Skill for a Task
1. Load `SKILL-INDEX.json` — check `description` fields for relevance
2. If no exact match: check `tags` array for related skills
3. If still no match: invoke `skill-forger` to create one
4. Invoke the chosen skill via the `Skill` tool: `Skill({ skill: "<name>" })`

## Plugin vs Skill vs Agent
| Type | Location | Invoke via | Scope |
|------|----------|-----------|-------|
| Skill | `.claude/skills/*/SKILL.md` | `Skill` tool | Instructions loaded into context |
| Agent | `.claude/agents/*.md` | `Agent` tool | Separate agent with own context |
| Plugin | Claude Code plugin system | Auto-loaded | MCP server or hook scripts |
| Command | `.claude/commands/*.md` | `/command-name` | User-triggered workflows |

## Runtime Skill Selection (for skill_registry.py)
The Python runtime uses `src/brain/skill_registry.py` to:
1. Index all SKILL.md files
2. Embed skill descriptions using LiteLLM embeddings
3. Find closest skill to a task prompt via cosine similarity
4. Return the skill content to inject into planner context

## For CLI Sub-Agents
CLIs don't have access to the Skill tool. Instead:
1. Skill content is serialized to a temp file
2. Passed to CLI via `--context-file` flag or inline in the prompt
3. CLI reads the serialized skill instructions as part of its prompt
