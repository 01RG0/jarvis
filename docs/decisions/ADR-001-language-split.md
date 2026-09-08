# ADR-001: Python + Go + TypeScript Architecture Split

**Status:** Accepted  
**Date:** 2026-09-08

## Context

Jarvis needs:
1. Deep AI/agent tooling (orchestration, memory, voice, LLM routing) — the ecosystem lives in Python
2. An always-on daemon that survives crashes of everything else — needs near-zero footprint and proven reliability
3. Real-time WebSocket server + browser UI — TypeScript/Node owns this space

The question was whether to use a single language for all three roles.

## Decision

Three-language split:
- **Python** for brain, voice, memory, LiteLLM integration
- **Go** for the watchdog daemon exclusively
- **TypeScript/Node** for gateway and website

## Consequences

**Positive:**
- Python gives access to LangGraph, Pipecat, Mem0, openWakeWord, LiteLLM Python SDK without fighting the ecosystem
- Go watchdog binary is ~5–10 MB, zero runtime dependencies, starts in milliseconds — the ideal always-on sentinel
- TypeScript/Node WebSocket ecosystem (ws, socket.io) is mature; code shares types with the browser

**Negative:**
- Three languages means three dev toolchains (Python venv/uv, Go modules, npm)
- Cross-language IPC between brain and gateway needs a defined protocol (HTTP/Unix socket)
- A solo developer context-switches between languages

## Alternatives Considered

**All-Python:** Python has async WebSocket servers (FastAPI + websockets). But Python is not the right choice for a process supervisor that must outlive Python crashes. A Python watchdog supervising Python processes is inherently fragile.

**All-TypeScript:** Node has an AI agent ecosystem (LangChain.js) but it's thinner and lags behind the Python equivalents. Pipecat, openWakeWord, and Mem0 are Python-only.

**Python + Rust (instead of Go):** Rust would produce an even leaner binary. But Go's standard library for process management and concurrency is more ergonomic for this use case, and Go compilation is faster — lower friction for a solo project.
