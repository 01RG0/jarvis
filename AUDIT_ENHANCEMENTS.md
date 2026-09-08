# Jarvis Audit Enhancements
Generated: 2026-09-09

Proposed enhancements ranked by impact/effort ratio. Each includes effort estimate, files affected, and rationale.

---

## ENH-1: Retry with model escalation + plan re-generation
**Effort**: S (2–4 hours)
**Severity addressed**: MED-8 (retry uses same plan and same model)
**Files**: src/brain/planner.py, retry.py

**Problem**: The current retry loop runs the same LLM call with the same plan — identical inputs produce identical (failing) outputs. After 3 such retries, Jarvis gives up.

**Enhancement**:
1. Add `retry_model: str` to `TaskState`.
2. `retry_node` sets it via `retry.next_model(state['model_used'])` — escalates `fast → balanced → smart`.
3. On the 2nd retry attempt, also re-route through `plan_node` with a different prompt prefix ("The previous approach failed. Try a different strategy:") instead of re-using the same plan.
4. This gives 3 genuinely different execution attempts before escalating to the user.

**Expected impact**: Significant reduction in false failures for tasks that need a stronger model or a different plan. Particularly valuable for complex multi-step tasks.

---

## ENH-2: Zod validation + typed error responses in gateway WebSocket handler
**Effort**: S (1–2 hours)
**Severity addressed**: MED-5 (no Zod validation on WebSocket input)
**Files**: src/gateway/src/ws_handler.ts, src/gateway/package.json

**Problem**: Malformed WebSocket messages (missing `id`, wrong types, extra fields) pass through unchecked and produce confusing undefined-field errors downstream.

**Enhancement**:
1. Add `zod` to gateway dependencies.
2. Define `const MessageSchema = z.object({ id: z.string(), input: z.string(), model: z.string().optional() })`.
3. Wrap `JSON.parse` + `MessageSchema.parse()` in ws_handler.ts.
4. On `ZodError`, return `{ id: 'unknown', error: 'invalid message format', details: err.flatten() }`.
5. Add the same Zod validation to voice_proxy.ts for any structured messages it handles.

**Expected impact**: Faster debugging of client bugs, no silent undefined propagation to brain.

---

## ENH-3: Structured logging (log/slog) in Go watchdog + SIGTERM graceful shutdown
**Effort**: S (2–3 hours)
**Severity addressed**: MED-3 (no graceful shutdown), MED-4 (unstructured log)
**Files**: src/watchdog/main.go, supervisor.go, heartbeat.go

**Problem**: The watchdog logs with unstructured `log.Printf` (hard to parse/grep in production). On SIGTERM it exits abruptly without stopping the supervised child process.

**Enhancement**:
1. Replace `import "log"` with `import "log/slog"` across all 3 Go files.
2. Convert all `log.Printf("[watchdog] ...")` to `slog.Info("...", "field", value)` with structured key-value pairs (e.g. `slog.Info("starting process", "cmd", parts[0], "args", parts[1:])`).
3. In `main.go`: add `signal.Notify` for `SIGTERM`/`SIGINT`. On signal, kill the supervised child process and exit 0.
4. In `supervisor.go`: track the `cmd` variable so it can be killed on shutdown.

**Expected impact**: systemd stop/restart works cleanly. Log output is grep-friendly (JSON-structured logs possible with `slog.NewJSONHandler`).

---

## ENH-4: sqlite-vec migration for Mem0 vector store
**Effort**: M (4–8 hours)
**Severity addressed**: HIGH-3 (ChromaDB violates architecture; "SQLite only")
**Files**: src/brain/memory_config.py, src/brain/requirements.txt, docs/decisions/ (new ADR)

**Problem**: The architecture mandates sqlite-vec ("SQLite only — no standalone vector DB for v1") but ChromaDB is currently used. ChromaDB runs as an in-process library (not server) when using the local path config, so RAM impact is limited — but it still violates the architecture constraint and adds a dependency.

**Enhancement**:
1. Research current mem0ai support for sqlite-vec (check mem0ai changelog for `vector_store.provider: "sqlite_vec"`).
2. If supported: switch `memory_config.py` to use `sqlite-vec` provider with the existing `SQLITE_PATH`.
3. If not yet supported: write a thin wrapper that implements the Mem0 vector store interface using `sqlite-vec` directly.
4. Remove `chromadb>=0.5.0` from requirements.txt.
5. Write `docs/decisions/005-sqlite-vec-over-chromadb.md` ADR.

**Expected impact**: Eliminates a major architecture inconsistency. Reduces dependencies. Keeps the always-on memory footprint minimal as specified.

---

## ENH-5: Run-Python tool hardening + optional E2B sandbox
**Effort**: M (4–6 hours)
**Severity addressed**: MED-9 (string-match sandbox is bypassable)
**Files**: src/brain/tools/run_python.py

**Problem**: The current sandbox is a string-blocklist that any LLM or adversarial user can bypass via `importlib`, `getattr(__builtins__, ...)`, etc. It provides false security assurance.

**Enhancement** (two-tier):

**Tier 1 (immediate, no new deps)**: Replace string-blocklist with `ast`-based analysis:
```python
import ast
tree = ast.parse(code)
for node in ast.walk(tree):
    if isinstance(node, ast.Import):
        for alias in node.names:
            if alias.name in BLOCKED_MODULES:
                return ToolResult(success=False, ..., error=f"Import blocked: {alias.name}")
    if isinstance(node, ast.Call):
        # detect __import__, eval, exec
        ...
```
This is much harder to bypass and catches indirect import patterns.

**Tier 2 (Phase 3+, requires API key)**: Route `run_python` executions to E2B (https://e2b.dev) — a sandboxed cloud code execution environment. Add `e2b` to requirements.txt. Cost: ~$0.001/execution. Architecture notes E2B as the "Process isolation" upgrade path.

**Expected impact**: Tier 1 can be shipped immediately and closes obvious bypass vectors. Tier 2 provides a genuine security boundary for production use.

---

## Quick Wins (< 30 min each)

| Item | File | Change |
|------|------|--------|
| Add "search", "read", "find", "run" to ACTION_KEYWORDS | planner.py:6 | Ensures short tool-triggering tasks take the slow (tool) path |
| Raise find_for_task threshold 0.05 → 0.15 | tool_registry.py:67 | Reduces false-positive tool selection |
| Unify gap detection signals | new gap_detector.py | Single source of truth for tool and skill gap detection |
| _extract_params fallback for unknown string params | tool_registry.py | Auto-forged tools with non-standard param names get the task passed |
| fast_node uses state memory_context if populated | planner.py:79-82 | Avoids duplicate memory lookup on fast path |
