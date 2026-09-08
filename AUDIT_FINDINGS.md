# Jarvis Audit Findings
Generated: 2026-09-09

Severity scale: CRITICAL > HIGH > MEDIUM > LOW

---

## CRITICAL

### CRIT-1: Python dependencies not installed in dev environment
- **Component**: brain
- **File**: src/brain/requirements.txt
- **Description**: Running `python -c "import planner"` fails with `ModuleNotFoundError: No module named 'litellm'`. Python 3.14 is present but `requirements.txt` dependencies are not installed in the active environment. All brain imports fail.
- **Fix**: `pip install -r src/brain/requirements.txt` or create a venv and install there. A `Makefile` or `scripts/setup.sh` target would prevent recurrence.

---

## HIGH

### HIGH-1: tool_forge.py — system prompt concatenated to user message
- **Component**: brain
- **File**: src/brain/tool_forge.py:82
- **Description**: `call_llm("smart", _FORGE_SYSTEM + "\n\n" + prompt)` passes the entire system prompt as the user message. The `call_llm` signature is `call_llm(model, prompt, system="")`. The system role instructions (tool format, rules, forbidden patterns) become part of the user turn, which most LLMs treat differently. The LLM may ignore formatting rules or produce malformed tool code.
- **Fix**: `call_llm("smart", prompt, system=_FORGE_SYSTEM)`

### HIGH-2: _base.py — `field(default_factory=list)` on non-dataclass class
- **Component**: brain
- **File**: src/brain/tools/_base.py:18
- **Description**: `tags: list[str] = field(default_factory=list)` assigns a `dataclasses.Field` object to the class attribute `tags`. `JarvisTool` is not a dataclass, so the `field()` factory is never invoked. Any auto-forged tool that doesn't define `tags` will have `self.tags` as a `Field` object; calling `" ".join(self.tags)` in `matches()` raises `TypeError`. All three existing built-in tools override `tags` explicitly, so they work now — but every LLM-forged tool that omits `tags` will crash at scoring time.
- **Fix**: Change line 18 to `tags: list[str] = []`

### HIGH-3: memory_config.py — ChromaDB used instead of architecture-mandated sqlite-vec
- **Component**: brain / memory
- **File**: src/brain/memory_config.py:8-13, src/brain/requirements.txt:9
- **Description**: `docs/architecture.md` explicitly states "Stack: Mem0 + sqlite-vec" and CLAUDE.md states "SQLite only — no Postgres, no standalone vector DB for v1". ChromaDB is a standalone vector database server. It is listed in `requirements.txt` and used as the Mem0 vector store provider. This violates the RAM budget rationale (ChromaDB wants persistent RAM), introduces a dependency that the architecture explicitly rejects, and creates inconsistency between spec and implementation.
- **Fix**: Switch to `sqlite-vec` when mem0ai's sqlite-vec provider stabilises, or add a documented ADR explaining why ChromaDB was chosen despite the constraint. Remove `chromadb>=0.5.0` from requirements.txt when migration is complete.

### HIGH-4: auth.ts — hardcoded fallback JWT secret 'dev-secret'
- **Component**: gateway
- **File**: src/gateway/src/auth.ts:4
- **Description**: `const SECRET = process.env.GATEWAY_SECRET_KEY || 'dev-secret'`. If `GATEWAY_SECRET_KEY` is not set in the production `.env`, any attacker who knows the fallback string `'dev-secret'` can forge valid JWT tokens and gain full gateway access. This is a credential that must never have a fallback in production.
- **Fix**: Replace with a fail-fast check:
  ```typescript
  const SECRET = process.env.GATEWAY_SECRET_KEY
  if (!SECRET) throw new Error('GATEWAY_SECRET_KEY env var is required')
  ```

### HIGH-5: read_file.py — unrestricted filesystem read
- **Component**: brain / tools
- **File**: src/brain/tools/read_file.py:19-20
- **Description**: `path = os.path.abspath(os.path.expanduser(path))` resolves the path but does not check it against any allowed prefix. Any LLM-generated task that resolves to reading a sensitive file (e.g. `~/.ssh/id_rsa`, `/etc/passwd`, `.env`) will succeed silently. Since the brain calls tools automatically based on task routing, this is an LLM-controllable filesystem read with no boundary.
- **Fix**: Restrict to `JARVIS_DATA_DIR`:
  ```python
  allowed = pathlib.Path(os.environ.get("JARVIS_DATA_DIR", "./data")).resolve()
  if not pathlib.Path(path).is_relative_to(allowed):
      return ToolResult(success=False, output="", error="Path outside allowed data directory", tool_name=self.name)
  ```

---

## MEDIUM

### MED-1: planner.py — deprecated asyncio.get_event_loop() in async function
- **Component**: brain
- **File**: src/brain/planner.py:237
- **Description**: `asyncio.get_event_loop().run_in_executor(None, graph.invoke, state)` — `get_event_loop()` is deprecated in Python 3.10+ when called from a running coroutine and will be removed. Should use `asyncio.get_running_loop()`.
- **Fix**: `result_state = await asyncio.get_running_loop().run_in_executor(None, graph.invoke, state)`

### MED-2: heartbeat.go — time.Tick() goroutine leak
- **Component**: watchdog
- **File**: src/watchdog/heartbeat.go:52
- **Description**: `for range time.Tick(10 * time.Second)` creates a ticker via a channel that is never stopped. The goroutine is never cleaned up. `go vet` flags this. The proper pattern is `time.NewTicker` with a deferred stop.
- **Fix**:
  ```go
  func (h *HeartbeatServer) checkStalls() {
      ticker := time.NewTicker(10 * time.Second)
      defer ticker.Stop()
      for range ticker.C {
          // ... stall check body
      }
  }
  ```

### MED-3: watchdog — no SIGTERM/SIGINT graceful shutdown
- **Component**: watchdog
- **File**: src/watchdog/main.go
- **Description**: Go rules require: "Graceful shutdown: catch SIGTERM/SIGINT, drain in-flight work, then exit 0". The watchdog currently has no signal handler. When systemd sends SIGTERM (on service stop/restart), the process is killed abruptly without stopping the supervised child process cleanly.
- **Fix**: Add `signal.Notify` in `main()`:
  ```go
  sigs := make(chan os.Signal, 1)
  signal.Notify(sigs, syscall.SIGTERM, syscall.SIGINT)
  go func() { <-sigs; os.Exit(0) }()
  ```

### MED-4: watchdog — uses log.Printf instead of log/slog
- **Component**: watchdog
- **File**: src/watchdog/main.go, supervisor.go, heartbeat.go (all log calls)
- **Description**: Go rules specify `log/slog` for structured logging (Go 1.21+). The watchdog runs Go 1.22 but uses unstructured `log.Printf` throughout. This makes log parsing/filtering difficult and violates the project's Go rules.
- **Fix**: Replace `import "log"` with `import "log/slog"` and update all `log.Printf(...)` calls to `slog.Info(...)` / `slog.Error(...)` with structured key-value pairs.

### MED-5: ws_handler.ts — no Zod validation on WebSocket input
- **Component**: gateway
- **File**: src/gateway/src/ws_handler.ts:17
- **Description**: TypeScript rules state "WebSocket messages: always parse with a schema before using fields". The handler uses an unsafe type assertion: `JSON.parse(data.toString()) as { id: string; input: string; model?: string }`. Malformed messages (missing `id`, wrong types) silently produce `undefined` values passed to the brain.
- **Fix**: Add a Zod schema and parse with it:
  ```typescript
  import { z } from 'zod'
  const MessageSchema = z.object({ id: z.string(), input: z.string(), model: z.string().optional() })
  const msg = MessageSchema.parse(JSON.parse(data.toString()))
  ```
  Add `zod` to package.json dependencies.

### MED-6: skill_forge.py — existing-skill check uses only first word
- **Component**: brain
- **File**: src/brain/skill_forge.py:47
- **Description**: `existing = get_skill_content(capability_description.split()[0])` looks up a skill by the first word of the description as a name. E.g., for "search the web for news", it looks up a skill named "search". This would hit on an unrelated "search" skill and block forging the needed one (false positive), or miss an existing skill called "web-search" (false negative).
- **Fix**: Replace with `find_skill_for_task(capability_description)` which uses keyword scoring:
  ```python
  existing_name = find_skill_for_task(capability_description)
  if existing_name:
      return {"status": "exists", "skill": existing_name}
  ```

### MED-7: memory_config.py — embedder key silently falls back to GROQ key
- **Component**: brain / memory
- **File**: src/brain/memory_config.py:26-27
- **Description**: `'api_key': os.environ.get('OPENAI_API_KEY', os.environ.get('GROQ_API_KEY', ''))` — when `OPENAI_API_KEY` is not set, the config falls back to `GROQ_API_KEY`. The configured model is `openai/text-embedding-3-small`, which requires an actual OpenAI key. Passing a Groq key to an OpenAI endpoint will result in a 401 authentication error at runtime, with no early warning at startup.
- **Fix**: Either assert `OPENAI_API_KEY` at startup, or switch the default embedding model to one Groq supports (e.g., `groq/` doesn't support embeddings — use `nomic-embed-text` via Ollama or switch to a provider that offers embeddings).

### MED-8: planner.py retry_node — re-executes same plan without strategy change
- **Component**: brain
- **File**: src/brain/planner.py:133-147 (retry_node), :106-118 (execute_node)
- **Description**: When `execute_node` fails, `retry_node` increments attempts and clears the error, then routes back to `execute_node`. `execute_node` re-runs the exact same `call_llm("smart", ...)` call with the same plan. The architecture diagram specifies `retry_node → (different strategy)`. No model escalation or plan-revision occurs on retry.
- **Fix**: Add `retry_model` to TaskState; `retry_node` sets it using `next_model(state['model_used'])`; `execute_node` reads it. This way each retry uses a progressively better model.

### MED-9: run_python.py — string-match sandbox is bypassable
- **Component**: brain / tools
- **File**: src/brain/tools/run_python.py:20-27
- **Description**: The sandbox blocks specific strings (`"os.system"`, `"subprocess"`, etc.) via substring search. This is trivially bypassable: `__import__('subprocess')`, `importlib.import_module('os').system(...)`, `getattr(__builtins__, '__import__')('os')`. The sandbox provides no real security boundary for adversarial or LLM-generated code.
- **Fix**: Document explicitly that `run_python` is not a security sandbox — it is a convenience guard only. For real isolation, use `e2b` (noted in architecture's upgrade paths) or restrict to a dedicated sandbox VM.

### MED-10: .env.example missing several env vars used in code
- **Component**: all
- **File**: .env.example
- **Description**: The following env vars are used in source code but not documented in `.env.example`:
  - `MEM0_CHROMA_PATH` (memory_config.py:13 — vector store path)
  - `MEM0_LLM_MODEL` (memory_config.py:19 — Mem0 LLM model)
  - `MEM0_EMBED_MODEL` (memory_config.py:26 — embedding model)
  - `BRAIN_INTERNAL_URL` (voice/pipeline.py:12 — brain HTTP URL from voice)
  - `BRAIN_PORT` (server.py:30 — brain server port, defaults to 8001)
  - `WORKER_ID` (worker/worker.py:23 — worker identifier, defaults to hostname)
- **Fix**: Add all six to `.env.example` with defaults and comments.

### MED-11: src/memory/ directory is empty
- **Component**: memory
- **File**: src/memory/ (entire directory)
- **Description**: `CLAUDE.md` and the architecture describe `src/memory/` as the "Memory layer extras (Phase 2)" directory. It is empty. The Phase 2 memory implementation lives entirely in `src/brain/memory.py` and `src/brain/memory_config.py`. Either the directory should contain Phase 2 extras or its existence in CLAUDE.md's structure map should be noted as brain-hosted.
- **Fix**: Either add a `__init__.py` or `README.md` placeholder, or update CLAUDE.md structure to reflect that memory lives in `src/brain/`.

---

## LOW

### LOW-1: tool_registry.py — _extract_params maps only 6 fixed param names
- **Component**: brain
- **File**: src/brain/tool_registry.py:88-98
- **Description**: Param auto-fill only handles `query`, `path`, `code`, `text`, `prompt`, `input`. A tool with parameters named `url`, `filename`, `expression`, or any other name won't receive the task string and will use its default value (or fail).
- **Fix**: As a fallback, map the first unrecognised string parameter to `task` if nothing else matches. Or document that tool authors should use one of the supported names.

### LOW-2: cli_registry.py — 'agent' listed as a known CLI
- **Component**: dispatcher
- **File**: src/dispatcher/cli_registry.py:3
- **Description**: `KNOWN_CLIS = ['codex', 'agy', 'kilo', 'grok', 'agent', 'vibe', 'freebuff']` — 'agent' is not a CLI documented in CLAUDE.md, the architecture, or any skill. It will always return `False` from `shutil.which('agent')` on standard installs and clutter the availability detection output.
- **Fix**: Remove 'agent' from `KNOWN_CLIS`.

### LOW-3: gateway/package.json — missing @types/node devDependency
- **Component**: gateway
- **File**: src/gateway/package.json
- **Description**: The gateway uses Node.js types (`http.IncomingMessage`, `http.Server`, `process.env`) without an explicit `@types/node` dependency. These are provided transitively via `@types/express`, but explicit is safer against version drift.
- **Fix**: `npm install --save-dev @types/node`

### LOW-4: learning.py — dead else branch in _persist
- **Component**: brain
- **File**: src/brain/learning.py:53-60
- **Description**: The `else` branch in `_persist` fires for `outcome == 'success'` with `attempts > 1`. The planner never creates this combination — `save_memory_node` sets `outcome = 'retry'` when `attempts > 1`. This branch is unreachable dead code.
- **Fix**: Either remove the else branch or add a comment explaining why it is unreachable.

### LOW-5: planner.py — parameter name 'input' shadows built-in
- **Component**: brain
- **File**: src/brain/planner.py:221
- **Description**: `async def handle_task(task_id: str, input: str, ...)` — `input` shadows Python's built-in `input()`. While harmless here, it makes the code harder to reason about and violates clean-code conventions.
- **Fix**: Rename to `task_input` throughout `handle_task`.

### LOW-6: src/brain/__init__.py missing
- **Component**: brain
- **File**: src/brain/
- **Description**: The brain is loaded via `sys.path.insert(0, ...)` in `server.py:22` and `main.py:6`. Without `__init__.py`, it cannot be imported as a package. This works for the current use case but prevents `pytest` from importing modules cleanly and makes relative imports impossible.
- **Fix**: Add an empty `src/brain/__init__.py`.

---

## Resource / Local Inference Check
No local model inference found. Grep for `transformers`, `torch`, `llama`, `gguf`, `ollama` returned only model name strings in config (e.g. `groq/llama-3.1-8b-instant` — a cloud endpoint name, not a local library). Clean.

## Hardcoded Secret Check
No hardcoded API keys found in source files. The only concern is the `'dev-secret'` JWT fallback in `auth.ts` (HIGH-4 above).

## subprocess shell=True / eval / exec Check
No `shell=True`, `eval(`, or `exec(` in any source file (outside the documented blocklist comment in `run_python.py`). The Go watchdog correctly uses `exec.Command(parts[0], parts[1:]...)` without shell. Clean.
