---
name: forge-skill
description: Create a new Claude Code skill on demand. Describe the capability you need and Jarvis will generate, write, and register a skill for it automatically.
argument-hint: "[capability description]"
---

# Forge Skill Command

Creates a new skill using the `skill-forger` agent.

## Usage
```
/forge-skill <description of what the skill should do>
```

## Examples
```
/forge-skill fetch and summarize RSS feeds for a given URL
/forge-skill run SQL queries against the Jarvis SQLite database and format results
/forge-skill send a Telegram message with optional inline keyboard buttons
/forge-skill create a structured task breakdown from a vague goal description
```

## What happens
1. `skill-forger` agent checks if an existing skill already covers the request
2. If not, it generates a new `SKILL.md` in `.claude/skills/<name>/`
3. Creates a `cli-adapter.md` so CLI sub-agents (grok/agy) can use it too
4. Registers the skill in `SKILL-INDEX.json`
5. The skill is immediately available via `Skill({ skill: "<name>" })`

## After creation
The skill is usable right away in this session. No restart needed.
For CLI sub-agents, pass the adapter content inline in the prompt:
```bash
ADAPTER=$(cat .claude/skills/<name>/cli-adapter.md)
grok -p "Follow these instructions:\n$ADAPTER\n\nTask: ..." --always-approve
```
