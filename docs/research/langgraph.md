# Research: LangGraph

**Verdict: Use it for the core orchestration loop. The explicit graph model is the right fit for G5 (never stuck in a loop).**

## What it is

LangGraph is a Python library from LangChain Inc. for building stateful, multi-step agent
workflows as explicit directed graphs. Each node is a function that reads and writes a typed
state dict. Edges can be conditional (route based on state values). The graph can checkpoint
its state to SQLite or Postgres, enabling crash recovery and resumption.

## Why it fits Jarvis

The "never stuck in a loop" requirement (G5) specifically needs **explicit retry/fallback
edges** — not implicit agent chatter that can cycle indefinitely. With LangGraph, you literally
draw the retry edge: `execute_node → [on error] → retry_node → execute_node`. You can see it,
test it, and set a max-iterations counter on it.

## Core Concepts

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, Literal

class State(TypedDict):
    input: str
    path: Literal["fast", "slow"]
    plan: str
    result: str
    error: str
    attempts: int

# Define nodes
def route_node(state: State) -> State:
    """Decide fast vs. slow path."""
    ...

def fast_node(state: State) -> State: ...
def plan_node(state: State) -> State: ...
def execute_node(state: State) -> State: ...
def verify_node(state: State) -> State: ...
def retry_node(state: State) -> State:
    return {**state, "attempts": state["attempts"] + 1, "error": ""}

# Build graph
g = StateGraph(State)
g.add_node("route", route_node)
g.add_node("fast", fast_node)
g.add_node("plan", plan_node)
g.add_node("execute", execute_node)
g.add_node("verify", verify_node)
g.add_node("retry", retry_node)

g.set_entry_point("route")
g.add_conditional_edges("route", lambda s: s["path"], {"fast": "fast", "slow": "plan"})
g.add_edge("fast", END)
g.add_edge("plan", "execute")
g.add_edge("execute", "verify")
g.add_conditional_edges(
    "verify",
    lambda s: "retry" if s["error"] and s["attempts"] < 3 else ("escalate" if s["error"] else END),
    {"retry": "retry", "escalate": END, END: END}
)
g.add_edge("retry", "execute")  # retry loops back to execute

app = g.compile()
```

## Checkpointing (Crash Recovery)

```python
from langgraph.checkpoint.sqlite import SqliteSaver

checkpointer = SqliteSaver.from_conn_string("./data/jarvis.db")
app = g.compile(checkpointer=checkpointer)

# Each run gets a thread_id; can resume after crash:
config = {"configurable": {"thread_id": task_id}}
result = app.invoke(initial_state, config=config)
```

## Human-in-the-Loop (Tier 2 Actions)

```python
from langgraph.graph import interrupt

def risky_execute_node(state: State) -> State:
    if state["risk_tier"] >= 2:
        # Pause here, wait for user approval
        approval = interrupt({"message": "confirm deploy?", "action": state["plan"]})
        if not approval:
            return {**state, "error": "user rejected"}
    # proceed with execution
    ...
```

## Comparison with CrewAI

| | LangGraph | CrewAI |
|---|---|---|
| Retry/fallback | Explicit graph edges | Implicit per-task retry config |
| State visibility | Typed TypedDict, inspectable | Agent "chatter", harder to debug |
| Learning curve | Higher (graph mental model) | Lower (define roles + tasks) |
| Checkpointing | Built-in (SQLite/Postgres) | Not built-in |
| Best for | Complex state machines, explicit error paths | Quick role-based delegation prototypes |

## Gotchas

- LangGraph graphs are compiled at import time — adding/removing nodes requires restarting the process
- `interrupt()` for human-in-the-loop requires the graph to be run in "streaming" mode, not `invoke()`
- Checkpointing adds a small write overhead per node execution — use `SqliteSaver` for simplicity, or `AsyncSqliteSaver` in async context

## Resources

- Docs: https://langchain-ai.github.io/langgraph/
- GitHub: https://github.com/langchain-ai/langgraph
