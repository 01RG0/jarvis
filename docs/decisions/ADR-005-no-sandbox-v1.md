# ADR-005: No Full Microvm Sandbox for v1 Execution Layer

**Status:** Accepted  
**Date:** 2026-09-08

## Context

When Jarvis dispatches code execution tasks (via CLI sub-agents or directly), those processes run on the Azure VM. A full sandbox (Firecracker microVMs, E2B, agent-sandbox) would isolate each execution in its own VM, preventing a runaway task from affecting the host.

The question was whether to build/configure a full sandbox layer before building the core functionality.

## Decision

**No full sandbox for v1.** Isolation is limited to process-level resource limits:
- systemd unit `MemoryMax=` and `CPUQuota=` per spawned task
- `ulimit` enforcement in the dispatcher
- Separate working directories per task (no shared state between task runs)

## Consequences

**Positive:**
- No ops overhead of setting up Firecracker/Kubernetes before the core value is proven
- The Azure VM is already treated as a disposable test zone — a compromised process can be recovered by reimaging
- systemd resource caps prevent the most common failure mode (runaway memory/CPU consumption) without full isolation

**Negative:**
- A malicious or buggy sub-agent task could theoretically access files outside its working directory
- No network isolation per task — a task could make arbitrary outbound network calls
- Not appropriate for running untrusted third-party code at scale

## Why This Is Acceptable for v1

This is a single-user personal assistant running on the owner's own VM. The sub-agents being dispatched are trusted CLIs (Claude Code, etc.) run by the owner. The threat model is "buggy code that crashes or leaks resources," not "malicious untrusted code execution."

## Upgrade Path

Reach for full sandboxing when: Jarvis starts running untrusted code (e.g., code submitted by external sources), or when the PC worker needs isolated execution on a shared machine.

**E2B** (`e2b-dev/e2b`) — self-hostable via Terraform, the standard reference.  
**agent-sandbox** — open-source, E2B-protocol-compatible, one-command Kubernetes deploy.
