# Research: Mem0

**Verdict: Use it for v1. Lightweight, framework-agnostic, sqlite-vec backend keeps always-on overhead near zero.**

## What it is

Mem0 is a Python memory library for AI agents. It provides a simple `add/search/update/delete`
API backed by a vector store + optional structured metadata. The agent (or the brain wrapping
the agent) calls `memory.add("user prefers dark mode")` and later `memory.search("UI preferences")`.

It's not a server — it's a library. It embeds into the Python brain process.

## Setup with sqlite-vec

```python
from mem0 import Memory

config = {
    "vector_store": {
        "provider": "chroma",        # or "qdrant", "pgvector"
        "config": {"collection_name": "jarvis", "path": "./data/mem0_chroma"},
    },
    "llm": {
        "provider": "litellm",
        "config": {"model": "anthropic/claude-haiku-4-5-20251001"},
    },
    "embedder": {
        "provider": "litellm",
        "config": {"model": "text-embedding-3-small"},
    },
}

memory = Memory.from_config(config)
```

For true SQLite-only (no Chroma), use `sqlite-vec` directly as the vector store:

```python
# Mem0 + sqlite-vec via a custom provider (or use Mem0's sqlite backend if released)
# Alternative: use chromadb with DuckDB+Parquet backend (single-file, no server)
```

## Core Operations

```python
user_id = "jarvis_user"   # single user, constant

# Store a memory
memory.add("Ahmed prefers concise responses with no emojis", user_id=user_id)

# Search before planning
relevant = memory.search("how does Ahmed like responses formatted?", user_id=user_id, limit=5)
for m in relevant:
    print(m["memory"], m["score"])

# Update (Mem0 handles deduplication automatically)
memory.add("Ahmed now prefers markdown tables for data", user_id=user_id)

# Get all memories
all_memories = memory.get_all(user_id=user_id)
```

## What to Store

| Category | Examples | Store as |
|----------|----------|---------|
| User preferences | "prefers dark mode", "uses metric units" | vector |
| Project state | "working on Jarvis Phase 0" | vector + structured |
| Conversation summaries | "talked about LiteLLM config on 2026-09-08" | vector |
| Task outcomes | task_id, result, model_used, duration | structured SQLite |
| Failure postmortems | what_failed, what_fixed_it, task_type | structured SQLite |
| Provider health | last_failure, provider, error_code | structured SQLite |

## Integration with LangGraph

Inject retrieved memories into the plan node's context:

```python
def plan_node(state: TaskState) -> TaskState:
    relevant_memories = memory.search(state["input"], user_id="jarvis_user", limit=5)
    memory_context = "\n".join([m["memory"] for m in relevant_memories])
    
    plan = llm_call(f"""
    User context from memory:
    {memory_context}
    
    Task: {state["input"]}
    Create a step-by-step plan.
    """)
    return {**state, "plan": plan}
```

## Comparison with Alternatives

| | Mem0 | Letta (MemGPT) | Graphiti (Zep) |
|---|---|---|---|
| Deployment | Library | Server + Postgres | Server + Postgres |
| Always-on RAM | ~0 (embedded) | ~500MB+ | ~300MB+ |
| Memory model | Embedding + retrieval | OS-inspired paging | Temporal knowledge graph |
| Best for | Simple semantic recall | Long-horizon agents needing memory management | Structured facts / relationships over time |
| v1 fit | ✅ | ❌ too heavy | Maybe — revisit for Phase 7 |

## Gotchas

- Mem0 calls an LLM to extract and format memories before storing them — this adds latency and cost to the write path. Use async writes so it doesn't block the response.
- The LLM used for memory extraction should be fast/cheap (Haiku/Groq) not smart — it's doing simple extraction, not planning.
- Deduplication: Mem0 checks for existing similar memories before writing. This is done via vector similarity — configure the dedup threshold to avoid over-merging distinct facts.

## Resources

- Docs: https://docs.mem0.ai
- GitHub: https://github.com/mem0ai/mem0
