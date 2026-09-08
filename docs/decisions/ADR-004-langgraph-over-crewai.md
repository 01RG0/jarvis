# ADR-004: LangGraph Over CrewAI for Core Orchestration Loop

**Status:** Accepted  
**Date:** 2026-09-08

## Context

The brain needs to orchestrate multi-step tasks with retry/fallback when steps fail. Two leading Python agent frameworks were considered: LangGraph (explicit state machines) and CrewAI (role-based delegation with implicit coordination).

The key requirement is G5: *"on failure, try a different strategy/tool before escalating"* — i.e., explicit, inspectable retry/fallback paths that don't turn into silent infinite loops.

## Decision

**LangGraph** for the core orchestration loop.

## Consequences

**Positive:**
- Retry/fallback edges are literal graph edges — you can see, draw, and debug the exact paths a failing task can take
- LangGraph's `StateGraph` with checkpointing means the loop state can be persisted (survives a crash, resumes)
- State is typed (`TypedDict`) — errors and retries are explicit fields, not hidden in agent chatter
- Integrates with LiteLLM, Mem0, and tool-calling out of the box

**Negative:**
- More boilerplate than CrewAI for simple tasks — a 3-node graph takes more code than a 2-line CrewAI crew
- Steeper learning curve for graph-based thinking vs. "just define roles and tasks"

## Alternatives Considered

**CrewAI:** Fast to prototype role-based delegation ("you are the planner, you are the executor"). Error handling is coarser — you define retry policies per task, but the retry logic is implicit. For a system where "never stuck in a loop" is a first-class requirement, implicit retry feels risky.

**OpenHands (OpenDevin):** Full CodeAct agent that executes arbitrary code. More of an end-to-end solution than an orchestration framework. Considered for the CLI dispatcher component (Phase 3) rather than the core loop.

**AutoGen:** Multi-agent conversation framework from Microsoft. Good for multi-agent debates/reviews but not the right fit for a deterministic plan→execute→verify loop with explicit failure modes.
