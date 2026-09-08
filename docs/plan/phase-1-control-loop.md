# Phase 1 — Text Control Loop

## Goal

Add the Node.js gateway and a minimal chat website so Jarvis can receive messages from a
browser. Add the awake task loop so tasks are tracked from dispatch to completion. Add basic
retry/fallback so the brain doesn't give up on the first error.

## Prerequisites

Phase 0 complete: brain entrypoint, LiteLLM Router, SQLite logging, watchdog binary.

## Deliverables

```
src/
├── brain/
│   ├── server.py               # HTTP/IPC server (brain listens for tasks from gateway)
│   ├── task_loop.py            # Awake loop: task queue, heartbeat emission, stall detection
│   ├── planner.py              # LangGraph graph: fast-path vs. slow-path routing
│   └── retry.py                # Retry/fallback strategy logic
├── gateway/
│   ├── src/
│   │   ├── index.ts            # Entry point
│   │   ├── auth.ts             # JWT middleware
│   │   ├── ws_handler.ts       # WebSocket session management
│   │   └── brain_client.ts     # Talks to Python brain
│   ├── package.json
│   └── tsconfig.json
└── website/
    ├── src/
    │   ├── app/page.tsx        # Chat UI (no animation yet — text only)
    │   └── lib/ws_client.ts    # WebSocket client
    ├── package.json
    └── next.config.js
```

## Key Implementation Steps

### 1. Python Brain Server

```python
# src/brain/server.py — thin HTTP server (FastAPI)
from fastapi import FastAPI
from pydantic import BaseModel
from planner import handle_task

app = FastAPI()

class Task(BaseModel):
    id: str
    input: str

@app.post("/task")
async def submit_task(task: Task):
    result = await handle_task(task.id, task.input)
    return {"task_id": task.id, "result": result}

@app.get("/health")
async def health():
    return {"status": "ok"}
```

### 2. LangGraph Planner (fast vs. slow path)

```python
# src/brain/planner.py
from langgraph.graph import StateGraph, END
from typing import TypedDict

class TaskState(TypedDict):
    task_id: str
    input: str
    path: str        # "fast" | "slow"
    result: str
    attempts: int
    error: str

def route(state: TaskState) -> str:
    # Fast path: short factual queries; slow path: everything else
    # This is itself a cheap LLM call to a fast model
    ...

def fast_path_node(state: TaskState) -> TaskState:
    # Single LLM call, no planning
    ...

def plan_node(state: TaskState) -> TaskState: ...
def execute_node(state: TaskState) -> TaskState: ...
def verify_node(state: TaskState) -> TaskState: ...
def retry_node(state: TaskState) -> TaskState: ...
def output_node(state: TaskState) -> TaskState: ...

graph = StateGraph(TaskState)
graph.add_node("route", route)
graph.add_node("fast", fast_path_node)
graph.add_node("plan", plan_node)
graph.add_node("execute", execute_node)
graph.add_node("verify", verify_node)
graph.add_node("retry", retry_node)
graph.add_node("output", output_node)

graph.set_entry_point("route")
graph.add_conditional_edges("route", lambda s: s["path"], {"fast": "fast", "slow": "plan"})
graph.add_edge("fast", "output")
graph.add_edge("plan", "execute")
graph.add_edge("execute", "verify")
graph.add_conditional_edges("verify", lambda s: "retry" if s["error"] else "output")
graph.add_conditional_edges("retry", lambda s: "output" if s["attempts"] >= 3 else "execute")
graph.add_edge("output", END)

app_graph = graph.compile()
```

### 3. Node Gateway WebSocket Handler

```typescript
// src/gateway/src/ws_handler.ts
import { WebSocket, WebSocketServer } from 'ws'
import { verifyToken } from './auth'
import { submitToBrain } from './brain_client'

export function setupWebSocket(wss: WebSocketServer) {
  wss.on('connection', (ws, req) => {
    const token = extractToken(req)
    if (!verifyToken(token)) { ws.close(1008, 'Unauthorized'); return }

    ws.on('message', async (data) => {
      const { id, input } = JSON.parse(data.toString())
      const result = await submitToBrain(id, input)
      ws.send(JSON.stringify({ id, result }))
    })
  })
}
```

### 4. Watchdog Integration

Update watchdog to supervise the brain server and gateway:
- `jarvis-watchdog --watch "uvicorn brain.server:app --port 8001"`
- `jarvis-watchdog --watch "node gateway/dist/index.js"`
- Heartbeat: brain emits `POST /watchdog/heartbeat?task_id=<id>` every 30s for running tasks
- Watchdog: if a task hasn't heartbeated in 120s, mark it stalled and notify gateway

## Interfaces Introduced for Phase 2

- `POST /task` → brain server accepts tasks
- WebSocket protocol: `{id, input}` → `{id, result}`
- Task state in SQLite: `tasks` table with status (pending/running/done/stalled/failed)
- LangGraph graph instance (used by Phase 2 to inject memory context)

## Acceptance Criteria

- [ ] Open browser at `localhost:3000`, type a message, get a response
- [ ] Gateway rejects requests without a valid JWT
- [ ] Watchdog restarts the brain server after a manual `kill`
- [ ] A task that takes >120s without heartbeat is marked stalled in SQLite
- [ ] Slow path actually invokes plan/execute/verify nodes (verify via logging)
- [ ] Fast path skips the graph and returns in <1s for a "what time is it" query

## Testing

- E2E: `playwright` or `curl` sending a WebSocket message and asserting on the response
- Unit: LangGraph graph routing logic (mock LLM calls)
- Load: 10 concurrent WebSocket connections (gateway shouldn't crash)
