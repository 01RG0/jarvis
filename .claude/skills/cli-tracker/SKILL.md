---
name: cli-tracker
description: Tracks CLI sub-agent delegation for Jarvis build phases. Knows invocation syntax for grok/agy/codex/kilo/vibe, handles timeouts and fallbacks, logs every delegation to .claude/cli-swarm-log.jsonl, and verifies output via git diff before accepting.
allowed-tools: Bash, Read, Glob, Grep
user-invocable: false
---

# CLI Tracker Skill

## CLI Invocation Patterns

| CLI | Command | Timeout |
|-----|---------|---------|
| jules | `jules run "..." --dir D:/pRoG/jarvis` | 300s (async — poll with `jules status`) |
| grok | `grok -p "..." --always-approve` | 180s |
| agy | `agy --dangerously-skip-permissions --print="..."` | 240s |
| codex | `codex exec -s workspace-write "..."` | 180s |
| kilo | `kilo run "..." --dir D:/pRoG/jarvis` | 240s |
| vibe | `vibe -p "..." --auto-approve` | 120s |

**CRITICAL**: For agy, `--print=` must use `=` syntax and come AFTER `--dangerously-skip-permissions`. Never `agy --print "..." --dangerously-skip-permissions` — agy will treat the flag as the prompt.

**Jules flow**: `jules run "..."` submits async → `jules status` polls → `jules apply` patches local files → `git diff` review.

## Fallback Order
1. Try jules for large-scope/UI tasks (async, Google infra)
2. Try grok for sync tasks (most reliable)
3. If grok fails/times out → try agy
4. If all fail → write the file directly (coordinator handles it)

## Dynamic CLI Detection
```bash
# Auto-discover any installed coding CLIs not in known list
bash D:/pRoG/jarvis/.claude/skills/cli-tracker/detect.sh
```
This scans PATH for coding/AI agent binaries and returns JSON of what's available.

## Verification After Each CLI Task
```bash
git diff --stat  # check files changed
git diff         # review actual changes
```
If diff is empty but CLI reported success → it failed silently. Write the file directly.

## Logging Delegation
After each delegated task, append to `.claude/cli-swarm-log.jsonl`:
```json
{"ts":"<ISO>","task":"<description>","cli":"<name>","status":"success|fail|timeout","files_changed":["..."],"phase":<N>}
```

## Known Issues
- **freebuff**: TUI only, no headless mode — never use for automation
- **vibe**: Fails on complex multi-file tasks; use only for simple boilerplate
- **agy**: Encoding corruption possible (U+00BB artifacts) — scan output before accepting
- **codex**: Rate-limited after heavy use — switch to grok if quota exceeded
