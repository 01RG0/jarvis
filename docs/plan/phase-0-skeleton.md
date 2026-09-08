# Phase 0 — Skeleton

## Goal

Get a single end-to-end path working: an input goes in, the brain thinks, an LLM is called,
the result is logged. Nothing more. This phase proves the stack compiles and the integrations
work before any features are built on top.

## Prerequisites

None — this is the foundation.

## Deliverables

```
src/
├── brain/
│   ├── main.py                 # Entry point: accepts prompt, returns response
│   ├── llm_router.py           # LiteLLM Router config + call wrapper
│   ├── config/
│   │   └── litellm_config.yaml # Provider list, fallback chain
│   └── requirements.txt
├── watchdog/
│   ├── main.go                 # Watchdog daemon
│   ├── supervisor.go           # Process supervision logic
│   ├── heartbeat.go            # Heartbeat listener
│   └── go.mod
data/
└── jarvis.db                   # Created on first run (SQLite)
```

## Key Implementation Steps

### 1. Python Brain — Minimal Entrypoint

```python
# src/brain/main.py
import sys
from llm_router import call_llm
from db import log_call

prompt = sys.argv[1] if len(sys.argv) > 1 else "hello"
response = call_llm(model="balanced", prompt=prompt)
log_call(prompt, response)
print(response)
```

### 2. LiteLLM Router Setup

```python
# src/brain/llm_router.py
# Phase 0 defaults: Groq (fast-path) + Gemini (balanced/smart).
# Add Anthropic keys later — these two are enough to start.
import litellm
from litellm import Router

router = Router(
    model_list=[
        {
            "model_name": "fast",
            "litellm_params": {
                "model": "groq/llama-3.1-8b-instant",
                "api_key": os.environ["GROQ_API_KEY"],
            },
        },
        {
            "model_name": "balanced",
            "litellm_params": {
                "model": "gemini/gemini-1.5-flash",
                "api_key": os.environ["GEMINI_API_KEY"],
            },
        },
        {
            "model_name": "smart",
            "litellm_params": {
                "model": "gemini/gemini-1.5-pro",
                "api_key": os.environ["GEMINI_API_KEY"],
            },
        },
    ],
    fallbacks=[{"smart": ["balanced", "fast"]}, {"balanced": ["fast"]}],
)

def call_llm(model: str, prompt: str) -> str:
    response = router.completion(
        model=model,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content
```

### 3. SQLite Logging

```python
# src/brain/db.py
import sqlite3, os, time

DB_PATH = os.getenv("SQLITE_PATH", "./data/jarvis.db")

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.execute("""
        CREATE TABLE IF NOT EXISTS calls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts REAL NOT NULL,
            prompt TEXT,
            response TEXT,
            model TEXT,
            cost_usd REAL
        )
    """)
    con.commit()
    return con

def log_call(prompt: str, response: str, model: str = "", cost: float = 0.0):
    con = init_db()
    con.execute(
        "INSERT INTO calls (ts, prompt, response, model, cost_usd) VALUES (?,?,?,?,?)",
        (time.time(), prompt, response, model, cost),
    )
    con.commit()
    con.close()
```

### 4. Go Watchdog — Minimal

```go
// src/watchdog/main.go
package main

import (
    "flag"
    "log"
    "os"
    "os/exec"
    "time"
)

var watchCmd = flag.String("watch", "", "Command to supervise (e.g. 'python brain/main.py')")

func main() {
    flag.Parse()
    if *watchCmd == "" {
        log.Println("Watchdog running (no process to supervise in Phase 0 — just a health check)")
        // In later phases: supervise gateway, brain server
        select {} // block forever
    }
    supervise(*watchCmd)
}

func supervise(cmd string) {
    for {
        log.Printf("Starting: %s", cmd)
        c := exec.Command("sh", "-c", cmd)
        c.Stdout = os.Stdout
        c.Stderr = os.Stderr
        if err := c.Run(); err != nil {
            log.Printf("Process exited with error: %v — restarting in 3s", err)
            time.Sleep(3 * time.Second)
        }
    }
}
```

### 5. Build and Run

```bash
# Build watchdog
cd src/watchdog && go build -o ../../bin/jarvis-watchdog .

# Install Python deps
cd src/brain && uv pip install litellm pydantic python-dotenv

# Test the full path
cd src/brain && python main.py "What is 2+2?"
# Expected: "4" (or similar), and a row in data/jarvis.db

# Test watchdog
../../bin/jarvis-watchdog &
# Should print "Watchdog running" and stay alive
```

## Interfaces Introduced for Phase 1

- `call_llm(model, prompt) -> str` — the LLM call wrapper
- `log_call(prompt, response, model, cost)` — SQLite write
- SQLite schema: `calls` table
- Go watchdog binary accepting `--watch <cmd>` flag

## Acceptance Criteria

- [ ] `python src/brain/main.py "hello"` returns a non-empty string from a real LLM provider
- [ ] `data/jarvis.db` is created and contains a row for the call
- [ ] Provider fallback works: temporarily set a bad API key for the primary provider, confirm it falls back to the next one
- [ ] Go watchdog binary builds cleanly: `go build ./...` produces no errors
- [ ] Watchdog restarts a deliberately-killed dummy process (test: `--watch "sleep 2 && exit 1"` → verify it restarts)
- [ ] `.env` file is read correctly (dotenv loaded before LiteLLM Router init)

## Testing Approach

- Manual smoke tests (script + verify SQLite row)
- `pytest` unit test for `call_llm` with `litellm` mocked (no real API call in unit tests)
- `go test ./...` for watchdog supervisor logic
