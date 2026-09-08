---
name: swarm-log
description: Reads and writes the CLI swarm delegation log at .claude/cli-swarm-log.jsonl. Shows per-CLI success rates, phase progress, and estimated tokens saved. Invoke to get a dashboard summary or to log a completed delegation.
allowed-tools: Bash, Read, Write
---

# Swarm Log Skill

## Log Location
`.claude/cli-swarm-log.jsonl` — one JSON object per line.

## Log Entry Schema
```json
{
  "ts": "2026-09-08T12:00:00Z",
  "phase": 2,
  "task": "write memory.py",
  "cli": "grok",
  "status": "success",
  "files_changed": ["src/brain/memory.py"],
  "duration_s": 45,
  "loc_changed": 56,
  "notes": ""
}
```

## Dashboard
Run to see current swarm stats:
```bash
python3 -c "
import json, collections
from pathlib import Path
log = Path('.claude/cli-swarm-log.jsonl')
if not log.exists():
    print('No log yet')
else:
    entries = [json.loads(l) for l in log.read_text().splitlines() if l.strip()]
    by_cli = collections.Counter(e['cli'] for e in entries)
    success = collections.Counter(e['cli'] for e in entries if e['status']=='success')
    total_loc = sum(e.get('loc_changed',0) for e in entries)
    for cli, count in by_cli.most_common():
        rate = success[cli]/count*100
        print(f'{cli:10} {count:3} tasks  {rate:.0f}% success')
    print(f'Total LOC delegated: {total_loc}')
"
```

## Append Entry
```bash
python3 -c "
import json, datetime
entry = {'ts': datetime.datetime.utcnow().isoformat()+'Z', 'phase': PHASE, 'task': 'TASK', 'cli': 'CLI', 'status': 'STATUS', 'files_changed': [], 'loc_changed': 0}
with open('.claude/cli-swarm-log.jsonl', 'a') as f:
    f.write(json.dumps(entry)+'\n')
"
```
