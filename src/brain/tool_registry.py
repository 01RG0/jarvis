"""Jarvis runtime tool registry.

Discovers all JarvisTool subclasses in src/brain/tools/ (built-in + auto-forged),
picks the best tool for a task, and executes it.
"""
import importlib
import importlib.util
import pathlib
import sys
from typing import Optional

from tools._base import JarvisTool, ToolResult

TOOLS_DIR = pathlib.Path(__file__).parent / "tools"
_registry: dict[str, JarvisTool] = {}


def _load_module(path: pathlib.Path) -> None:
    if path.stem.startswith("_"):
        return
    module_name = f"tools.{path.stem}"
    if module_name in sys.modules:
        return
    spec = importlib.util.spec_from_file_location(module_name, path)
    if not spec or not spec.loader:
        return
    mod = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = mod
    try:
        spec.loader.exec_module(mod)
    except Exception:
        del sys.modules[module_name]
        return
    for attr in dir(mod):
        obj = getattr(mod, attr)
        try:
            if (
                isinstance(obj, type)
                and issubclass(obj, JarvisTool)
                and obj is not JarvisTool
                and obj.name
            ):
                _registry[obj.name] = obj()
        except Exception:
            pass


def load_all() -> None:
    for path in sorted(TOOLS_DIR.glob("*.py")):
        _load_module(path)


def get(name: str) -> Optional[JarvisTool]:
    if not _registry:
        load_all()
    return _registry.get(name)


def find_for_task(task: str) -> Optional[JarvisTool]:
    if not _registry:
        load_all()
    scored = sorted(
        ((tool.matches(task), name, tool) for name, tool in _registry.items()),
        reverse=True,
    )
    best_score, _, best_tool = scored[0] if scored else (0, None, None)
    # Require at least one tag match (score > 0) and a meaningful hit rate
    return best_tool if best_score >= 0.12 else None


def run_for_task(task: str, **kwargs) -> Optional[ToolResult]:
    tool = find_for_task(task)
    if not tool:
        return None
    params = _extract_params(task, tool, kwargs)
    return tool.run(**params)


def register(tool: JarvisTool) -> None:
    _registry[tool.name] = tool


def list_tools() -> list[dict]:
    if not _registry:
        load_all()
    return [{"name": t.name, "description": t.description, "tags": t.tags} for t in _registry.values()]


def _extract_params(task: str, tool: JarvisTool, overrides: dict) -> dict:
    """Best-effort param extraction from task string."""
    params = dict(overrides)
    import inspect
    sig = inspect.signature(tool.run)
    for param_name in sig.parameters:
        if param_name in ("self", "kwargs") or param_name in params:
            continue
        if param_name in ("query", "path", "code", "text", "prompt", "input"):
            params.setdefault(param_name, task)
    return params
