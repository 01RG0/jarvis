"""Jarvis auto-tool forge.

When Jarvis encounters a capability gap, this module:
1. Generates Python tool code via LLM
2. Writes it to src/brain/tools/<name>.py
3. Hot-reloads it into tool_registry
4. Returns the new tool ready to use
"""
import json
import pathlib
import re
import textwrap

from llm_router import call_llm

TOOLS_DIR = pathlib.Path(__file__).parent / "tools"

_FORGE_SYSTEM = textwrap.dedent("""\
    You are Jarvis's tool forge. You generate Python tool modules that extend Jarvis's capabilities.

    A tool module MUST follow this exact structure:

    ```python
    \"\"\"One-line description.\"\"\"
    # standard lib imports only, or imports that are already in requirements.txt
    from ._base import JarvisTool, ToolResult

    TOOL_NAME = "snake_case_name"
    TOOL_DESCRIPTION = "What this tool does in one sentence"
    TOOL_TAGS = ["tag1", "tag2"]  # words users might say to trigger this tool

    class ToolClassName(JarvisTool):
        name = TOOL_NAME
        description = TOOL_DESCRIPTION
        tags = TOOL_TAGS

        def run(self, query: str = "", **kwargs) -> ToolResult:
            try:
                # implementation
                result = ...
                return ToolResult(success=True, output=str(result), tool_name=self.name)
            except Exception as e:
                return ToolResult(success=False, output="", error=str(e), tool_name=self.name)
    ```

    Rules:
    - Only use stdlib or packages already in requirements.txt: litellm, fastapi, httpx, pydantic, mem0ai
    - Never use os.system, subprocess with shell=True, eval, exec
    - The run() method MUST return a ToolResult
    - Keep it under 80 lines
    - Respond with ONLY the Python code, no prose, no markdown fences
""")

_GAP_SIGNALS = [
    "i don't know how to",
    "i can't",
    "i cannot",
    "unable to",
    "i'm not able to",
    "don't have access to",
    "no tool",
    "i lack",
    "i don't have",
]


def detect_gap(llm_output: str) -> bool:
    lower = llm_output.lower()
    return any(sig in lower for sig in _GAP_SIGNALS)


def forge_tool(capability_description: str) -> dict:
    """Generate, write, and register a new Jarvis tool. Returns tool metadata."""
    # Check if a tool already covers this
    from tool_registry import find_for_task, load_all
    load_all()
    existing = find_for_task(capability_description)
    if existing:
        return {"status": "exists", "name": existing.name}

    prompt = f"Create a Jarvis tool for this capability:\n\n{capability_description}"
    response = call_llm("smart", prompt, system=_FORGE_SYSTEM)
    code = response["content"].strip()
    code = re.sub(r"^```python\s*", "", code)
    code = re.sub(r"\s*```$", "", code)

    # Extract tool name from code
    name_match = re.search(r'TOOL_NAME\s*=\s*["\'](\w+)["\']', code)
    if not name_match:
        raise ValueError("LLM did not generate a valid TOOL_NAME in the tool code")
    tool_name = name_match.group(1)

    out_path = TOOLS_DIR / f"{tool_name}.py"
    out_path.write_text(code, encoding="utf-8")

    # Hot-reload into registry
    import importlib
    import sys
    module_name = f"tools.{tool_name}"
    if module_name in sys.modules:
        del sys.modules[module_name]
    from tool_registry import _load_module, _registry
    _load_module(out_path)

    return {
        "status": "created",
        "name": tool_name,
        "path": str(out_path),
    }


def auto_forge_from_gap(llm_output: str, task_description: str) -> dict | None:
    """If llm_output signals a gap, forge a tool. Returns result dict or None."""
    if not detect_gap(llm_output):
        return None
    try:
        return forge_tool(task_description)
    except Exception:
        return None
