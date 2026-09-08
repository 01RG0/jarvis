# Jarvis Audit Optimizations
Generated: 2026-09-09

---

## OPT-1: planner.py graph routing — tool_node before plan_node is correct, but tool_result is not used in fast-path

**Component**: brain / planner.py

**Before**: The fast-path (`route_node → fast_node → save_memory_node → END`) bypasses the tool, skill, and memory nodes entirely. A short question that matches a tool (e.g. "search for X") would take the fast-path because it's under 200 chars and doesn't contain an ACTION_KEYWORD. The DuckDuckGo tool would never run.

**After**: The `route_node` keyword check is too coarse. Add "search" and "read" to `ACTION_KEYWORDS`:
```python
ACTION_KEYWORDS = {"deploy", "create", "build", "write", "fix", "search", "read", "find", "run"}
```
This routes more tasks through the slow-path tool pipeline where the correct tool can execute.

**Note**: After this change, verify `fast_node` does not use memory_context/skill_context (it doesn't — it calls `get_memory().get_context()` itself, which is a duplicate call. One optimisation: remove the duplicate memory lookup in `fast_node` and instead route all tasks with context through the slow-path. But that's a Phase 3 change — out of scope for this audit.)

---

## OPT-2: tool_registry.py — find_for_task threshold is too aggressive at 0.05

**Component**: brain / tool_registry.py:66-67

**Before**: `return best_tool if best_score > 0.05 else None`. A 0.05 threshold means 1 matching word out of 20 total words in description+tags. This is very permissive and could select the wrong tool.

**Analysis**: Looking at the scoring algorithm in `_base.py.matches()`: tags count as 2 hits, description words as 1. Normalizer is `max(len(tags)*2, 1)`. For `web_search` with 8 tags, normalizer = 16. A score of 0.05 would fire on 0.8 hits — essentially any vague match. Combined with short description tasks, this can pick the wrong tool.

**After**: Raise threshold to `0.15` (roughly 2-3 word hits needed). Monitor false-negatives and tune. The forge pathway handles genuine gaps, so false-negatives are recoverable.

```python
return best_tool if best_score > 0.15 else None
```

---

## OPT-3: tool_forge.py hot-reload is correct but doesn't update _registry on re-forge

**Component**: brain / tool_forge.py:97-103

**Before**:
```python
if module_name in sys.modules:
    del sys.modules[module_name]
from tool_registry import _load_module, _registry
_load_module(out_path)
```

**Analysis**: `_load_module` skips if `module_name in sys.modules` (line 22-23). We delete from sys.modules first, so the new module loads correctly. However `_registry` is a module-level dict — the new tool instance is added, but if the old tool instance with the same name existed in `_registry` before the deletion, it has already been replaced by `_load_module`'s `_registry[obj.name] = obj()`. This is correct.

**Verdict**: Hot-reload logic is correct as-is. No change needed.

---

## OPT-4: tool_registry.py _extract_params — add fallback for unrecognised string params

**Component**: brain / tool_registry.py:88-98

**Before**: Only maps 6 fixed param names (`query`, `path`, `code`, `text`, `prompt`, `input`). Auto-forged tools that use `url`, `filename`, `expression`, `command` etc. would get no params passed.

**After**: Add a catch-all fallback for any first unrecognised string parameter:
```python
def _extract_params(task: str, tool: JarvisTool, overrides: dict) -> dict:
    params = dict(overrides)
    import inspect
    sig = inspect.signature(tool.run)
    KNOWN_STRING_PARAMS = {"query", "path", "code", "text", "prompt", "input"}
    first_fallback_filled = False
    for param_name, param in sig.parameters.items():
        if param_name in ("self", "kwargs") or param_name in params:
            continue
        if param_name in KNOWN_STRING_PARAMS:
            params.setdefault(param_name, task)
        elif not first_fallback_filled and param.annotation in (str, inspect.Parameter.empty):
            params.setdefault(param_name, task)
            first_fallback_filled = True
    return params
```

---

## OPT-5: skill_forge.py — gap detection shares signals with tool_forge, should be unified

**Component**: brain / skill_forge.py:101-110, tool_forge.py:54-63

**Before**: Both modules define their own `_GAP_SIGNALS` / `gap_signals` lists with slightly different entries:
- `tool_forge._GAP_SIGNALS`: includes `"i lack"`, `"i don't have"`, excludes `"no tool available"`
- `skill_forge.gap_signals`: includes `"no tool available"`, excludes `"i lack"`, `"i don't have"`

**After**: Extract to a shared constant in a new `src/brain/gap_detector.py` or add to `_base.py`:
```python
GAP_SIGNALS = [
    "i don't know how to", "i can't", "i cannot", "unable to",
    "i'm not able to", "i cannot", "don't have access to",
    "no tool", "no tool available", "i lack", "i don't have",
]
```
Import in both tool_forge and skill_forge. This ensures consistent gap detection and prevents divergence.

---

## OPT-6: planner.py retry_node — should escalate model on retry

**Component**: brain / planner.py:133-147

**Before**: `retry_node` increments `attempts` and clears `error`, then routes back to `execute_node`. `execute_node` always calls `call_llm("smart", ...)` regardless of attempt number. The retry is identical to the original execution — no escalation or strategy change.

**After**: Add `retry_model` field to `TaskState` and use `retry.next_model()`:
```python
# In TaskState:
retry_model: str  # model to use on next retry

# In retry_node:
from retry import next_model
current = state.get("model_used") or "smart"
escalated = next_model(current) or current
return {**state, "attempts": new_attempts, "error": "", "retry_model": escalated}

# In execute_node:
model = state.get("retry_model") or "smart"
res = call_llm(model, "Plan:\n" + state["plan"] + "\n\nExecute and give the final answer")
```

**Note**: `retry.next_model()` escalates `fast → balanced → smart`. Since execute_node already uses `smart`, retries would loop on smart. Consider a different escalation strategy: `smart → smart with different plan` (re-run plan_node with higher temperature, a Phase 3+ enhancement).

---

## OPT-7: planner.py save_memory_node — fast-path skips memory save

**Component**: brain / planner.py:208

**Before**:
```python
g.add_edge("fast_node", "save_memory_node")
```

The fast-path does go through `save_memory_node`. However, `fast_node` calls `get_memory().get_context()` independently (not using the shared `memory_context` state field), creating a duplicate memory lookup on every fast-path task. The `memory_node` result is stored in `state['memory_context']` but `fast_node` ignores it.

**After**: Since fast-path bypasses `memory_node`, add memory_context to fast-path at a lower cost: route fast through memory_node first, or have fast_node use `state['memory_context']` if populated:
```python
# In fast_node:
context = state.get('memory_context') or get_memory().get_context(state['input'])
```
This saves a memory lookup on the fast-path when memory_context is pre-populated.

---

## Summary of Changes Applied in Phase 2

| Fix | File | Before | After |
|-----|------|--------|-------|
| HIGH-1: system prompt passed wrong | tool_forge.py:82 | `call_llm("smart", SYSTEM + "\n\n" + prompt)` | `call_llm("smart", prompt, system=_FORGE_SYSTEM)` |
| HIGH-2: field() on non-dataclass | _base.py:18 | `field(default_factory=list)` | `[]` |
| HIGH-4: dev-secret JWT fallback | auth.ts:4-5 | `\|\| 'dev-secret'` | fail-fast throw if missing |
| HIGH-5: unrestricted file read | read_file.py | no path restriction | restricted to JARVIS_DATA_DIR |
| MED-1: deprecated get_event_loop | planner.py:237 | `get_event_loop()` | `get_running_loop()` |
| MED-2: time.Tick leak | heartbeat.go:52 | `time.Tick(...)` | `time.NewTicker(...); defer Stop()` |
| MED-6: skill existence check | skill_forge.py:47 | `split()[0]` lookup | `find_skill_for_task()` keyword match |
| LOW-2: 'agent' in CLI list | cli_registry.py:3 | included | removed |
| MED-10: missing env vars | .env.example | 6 vars missing | all added with defaults |

Note: _base.py was also independently updated by another agent to improve the `matches()` scoring algorithm (tags weighted 2x, better normalizer). This is a valid optimization and has been retained.
