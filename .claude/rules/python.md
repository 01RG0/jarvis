---
paths:
  - "src/brain/**/*.py"
  - "src/voice/**/*.py"
  - "src/memory/**/*.py"
  - "src/dispatcher/**/*.py"
---

# Python Rules

- Python 3.11+, type hints everywhere
- Use `asyncio` for all I/O — no sync blocking calls in async context
- `os.open(path, os.O_CREAT|os.O_WRONLY, 0o600)` for any file holding credentials or sensitive data
- Load env with `python-dotenv`; assert required keys at module load, fail fast
- Pydantic v2 models for all data structures crossing module boundaries
- `litellm.Router` in SDK mode — never import `litellm.completion` directly in app code; go through `llm_router.py`
- No bare `except:` — catch specific exceptions or `Exception` with a log
- Update `src/brain/requirements.txt` when adding deps
