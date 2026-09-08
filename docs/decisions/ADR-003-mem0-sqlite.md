# ADR-003: Mem0 + sqlite-vec for v1 Memory Layer

**Status:** Accepted  
**Date:** 2026-09-08

## Context

Jarvis needs hybrid memory: semantic (vector) retrieval for "what did we talk about that's relevant to this?" and structured retrieval for "what are this user's known preferences / what failed last time?". Options range from lightweight client libraries to full server deployments.

## Decision

Use **Mem0** (Python client library) + **sqlite-vec** (SQLite extension for vector search) for v1.

- `sqlite-vec` stores embedding vectors as a SQLite extension — single `.db` file, zero extra process
- `Mem0` provides the memory client API: store/retrieve/update with embedding + structured metadata
- All data in one `jarvis.db` file alongside the call log and task tables

## Consequences

**Positive:**
- Zero always-on overhead — SQLite is embedded in the brain process
- Single `.db` file to back up / inspect
- Mem0 is framework-agnostic; works with LangGraph out of the box
- Can switch vector backends (Qdrant, Chroma) later by changing Mem0 config, not rewriting memory code

**Negative:**
- sqlite-vec is not as fast as Qdrant for large corpora (>100K vectors) — acceptable for a single-user personal assistant that will have thousands, not millions, of memory entries
- No dedicated memory management UI (Letta's OS-paging model is elegant but heavyweight)
- sqlite-vec is a C extension that needs to be compiled — add to requirements and verify on the target Ubuntu version

## Alternatives Considered

**Letta (MemGPT):** OS-inspired memory with core/"RAM" and archival/"disk" paging. Conceptually elegant and well-matched to the "optimized remembering" goal. Rejected for v1 because it wants its own server process + Postgres — two more always-on services. Revisit if recall quality demands it.

**Graphiti (Zep):** Temporal knowledge-graph memory; better if structured relationships-over-time matter more than semantic similarity. Potentially valuable for Phase 7 (learning loop) — worth revisiting then.

**Qdrant (standalone):** Production-grade vector DB. Would give faster search at scale. But it's a separate Docker service adding ~100–200 MB always-on RAM. Not justified until scale demands it.

## Upgrade Path

`sqlite-vec → Qdrant` when: vector search becomes slow (corpus grows to >100K entries). `Mem0 → Letta` when: OS-style memory paging and archival management become necessary.
