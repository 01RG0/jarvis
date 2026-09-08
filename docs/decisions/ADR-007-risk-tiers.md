# ADR-007: Four-Tier Risk/Autonomy Model

**Status:** Accepted  
**Date:** 2026-09-08

## Context

How autonomous should Jarvis be? A global "always ask" or "always act" setting is too coarse — it would either be annoyingly cautious for simple reads or dangerously permissive for deploys. The right level depends on the action.

## Decision

Four-tier risk classification, applied per-action before execution:

| Tier | Name | Examples | Behavior |
|------|------|----------|----------|
| 0 | Autonomous | Read files, web search, draft code on a branch, answer questions, status checks | Acts immediately, no notification |
| 1 | Notify-after | Multi-step task completion, writing to memory, minor config changes | Acts, then logs to dashboard + reports |
| 2 | Confirm-first | Deploy code, push to production, delete data, modify another live project | Prepares the action, **asks before executing** |
| 3 | Always manual | Spending money (API credit top-ups), etc. | Deferred — revisit once real costs are visible |

## Consequences

**Positive:**
- Tier 0 actions (the majority of daily use) proceed without friction
- Tier 2 actions are always gated — the blast radius of a mistake is bounded
- The tier classification itself can be improved over time as real usage reveals where friction actually is

**Negative:**
- The exact boundary between tiers requires tuning in practice — the initial table is a starting sketch
- Tier 3 is a deliberate placeholder: spending money autonomously is explicitly not decided until real API costs are visible

## Implementation Notes

The brain classifies an action into a tier before executing. Classification is a lightweight rule-based check (not an LLM call) — e.g., "does this action touch production? → Tier 2." The rules table is the first thing to update after a few weeks of real usage.

## Alternatives Considered

**Global autonomy slider:** A single setting (0–10 scale). Simple to configure but too coarse — any setting that allows deploys also allows deletes, and any setting that blocks deletes also blocks harmless reads.

**Per-tool autonomy config:** Each tool registers its own tier. More granular but harder to reason about at a glance. The tier model is more legible.
