# ADR-002: LiteLLM in SDK Mode (In-Process Router) for v1

**Status:** Accepted  
**Date:** 2026-09-08

## Context

LiteLLM has two deployment modes:
1. **SDK mode** (`litellm.Router` in-process) — imported as a Python library, zero extra processes
2. **Proxy mode** — a standalone HTTP gateway service (Docker, needs Postgres or SQLite backend, admin UI, virtual keys)

The choice affects always-on RAM budget and operational complexity.

## Decision

Use LiteLLM **SDK mode** (in-process `litellm.Router`) for v1. Import it inside the Python brain. No Docker container, no separate database, no always-on extra service.

## Consequences

**Positive:**
- No extra RAM budget item (runs inside the brain process)
- No Docker/Postgres dependency to set up and maintain
- Same API: `router.completion(model="balanced", messages=[...])` — identical to what the proxy would expose
- Retry, fallback chain, and cost callback hooks all work in SDK mode

**Negative:**
- No admin dashboard UI for provider spend/health (proxy mode includes one)
- No virtual keys or shared gateway (other processes like Go watchdog can't route LLM calls through it directly)
- Spend tracking is logged to SQLite manually via LiteLLM's callback, not via the proxy's built-in UI

## Alternatives Considered

**Proxy mode from the start:** The `hwdsl2/docker-litellm` image makes setup easy. But it wants its own process + database (Postgres or SQLite). On a 2 vCPU/8 GB box, every always-on service is a budget item. The admin UI is nice but not necessary for v1 when the brain can log costs to the existing SQLite db.

**OpenRouter as the gateway:** OpenRouter is a hosted multi-model API. Could use it instead of LiteLLM to avoid self-hosting the router. But it adds a dependency on a third-party service for routing logic, and doesn't support in-process usage. Use it as one upstream provider inside LiteLLM rather than as a replacement.

## Upgrade Path

Switch to proxy mode when: the admin spend dashboard becomes valuable as a separate service, or multiple components (Go watchdog, a secondary worker) need to share one LLM routing layer.
