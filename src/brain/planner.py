import asyncio
import re
from typing import TypedDict
from llm_router import call_llm
from langgraph.graph import StateGraph, END

ACTION_KEYWORDS = {"deploy", "create", "build", "write", "fix", "search", "read", "find", "run", "execute"}


_WIDGET_PATTERNS: list[tuple[str, str, str]] = [
    ("browser",  "show",   r"\b(show|open)\b.{0,20}\bbrowser\b"),
    ("browser",  "show",   r"\bshow me.{0,30}\bin (a |the )?widget\b"),
    ("logs",     "show",   r"\b(show|open)\b.{0,20}\blogs?\b"),
    ("stats",    "show",   r"\b(show|open)\b.{0,20}\b(stats?|system|monitor)\b"),
    ("memory",   "show",   r"\b(show|open)\b.{0,20}\bmemory\b"),
    ("settings", "show",   r"\b(show|open)\b.{0,20}\bsettings?\b"),
    ("providers","show",   r"\b(show|open)\b.{0,20}\bproviders?\b"),
    ("chat",     "show",   r"\b(show|open)\b.{0,20}\bchat\b"),
    ("browser",  "hide",   r"\b(hide|close)\b.{0,20}\bbrowser\b"),
    ("logs",     "hide",   r"\b(hide|close)\b.{0,20}\blogs?\b"),
    ("stats",    "hide",   r"\b(hide|close)\b.{0,20}\b(stats?|system|monitor)\b"),
    ("memory",   "hide",   r"\b(hide|close)\b.{0,20}\bmemory\b"),
    ("settings", "hide",   r"\b(hide|close)\b.{0,20}\bsettings?\b"),
]


def _detect_widget_cmd(text: str) -> dict | None:
    lower = text.lower()
    for widget, action, pattern in _WIDGET_PATTERNS:
        if re.search(pattern, lower):
            return {"action": action, "widget": widget}
    return None


class TaskState(TypedDict):
    task_id: str
    input: str
    path: str
    plan: str
    result: str
    error: str
    attempts: int
    model_used: str
    cost_usd: float
    duration_ms: int
    memory_context: str
    skill_context: str
    tool_result: str
    widget_cmd: dict


def route_node(state: TaskState) -> TaskState:
    words = set(state["input"].lower().split())
    if len(state["input"]) < 200 and not words.intersection(ACTION_KEYWORDS):
        return {**state, "path": "fast"}
    return {**state, "path": "slow"}


def memory_node(state: TaskState) -> TaskState:
    try:
        from memory import get_memory
        context = get_memory().get_context(state['input'])
    except Exception:
        context = ''
    try:
        import win32gui
        title = win32gui.GetWindowText(win32gui.GetForegroundWindow())
        if title:
            context = f"Active window: {title}\n\n{context}" if context else f"Active window: {title}"
    except Exception:
        pass
    return {**state, 'memory_context': context}


def tool_node(state: TaskState) -> TaskState:
    """Run the best matching Jarvis tool for this task. If none found, auto-forge one."""
    try:
        from tool_registry import find_for_task
        from tool_fallbacks import run_with_fallback
        matched = find_for_task(state['input'])
        result = run_with_fallback(matched.name, query=state['input'], input=state['input']) if matched else None
        if result and result.success:
            return {**state, 'tool_result': f"[{result.tool_name}]: {result.output}"}
        if result and not result.success:
            # Tool exists but failed — try to forge a better one
            from tool_forge import auto_forge_from_gap
            auto_forge_from_gap(result.error, state['input'])
    except Exception:
        pass
    # No tool matched — check if we should forge one
    try:
        from tool_registry import find_for_task
        if not find_for_task(state['input']):
            from tool_forge import forge_tool
            forge_tool(state['input'])
            # Try again after forging
            from tool_registry import run_for_task
            result = run_for_task(state['input'])
            if result and result.success:
                return {**state, 'tool_result': f"[{result.tool_name}]: {result.output}"}
    except Exception:
        pass
    return {**state, 'tool_result': ''}


def skill_node(state: TaskState) -> TaskState:
    try:
        from skill_registry import find_skill_for_task, get_skill_content
        name = find_skill_for_task(state['input'])
        content = get_skill_content(name) if name else None
        skill_context = f"Relevant skill [{name}]:\n{content}" if content else ""
    except Exception:
        skill_context = ""
    return {**state, 'skill_context': skill_context}


def fast_node(state: TaskState) -> TaskState:
    try:
        from memory import get_memory
        context = get_memory().get_context(state['input'])
        try:
            from metrics import inc_memory_hit
            inc_memory_hit()
        except Exception:
            pass
    except Exception:
        context = ''
        try:
            from metrics import inc_memory_error
            inc_memory_error()
        except Exception:
            pass
    prompt = f'{context}\n\n{state["input"]}' if context else state['input']
    res = call_llm('fast', prompt)
    return {
        **state,
        "result": res["content"],
        "model_used": res["model_used"],
        "cost_usd": res["cost_usd"],
        "duration_ms": res["duration_ms"],
    }


def parallel_agents_node(state: TaskState) -> TaskState:
    plan = state.get("plan", "")
    steps = re.findall(r"(?:^|\n)\s*\d+\.\s+(.+)", plan)
    if len(steps) < 3:
        return state
    dep_words = {"then", "after", "next", "following", "result", "above", "previous", "based on"}
    if any(word in step.lower() for step in steps for word in dep_words):
        return state
    try:
        loop = asyncio.get_event_loop()
        futures = [
            loop.run_in_executor(None, call_llm, "fast", f"Answer concisely: {step}")
            for step in steps[:5]
        ]
        results = loop.run_until_complete(asyncio.gather(*futures, return_exceptions=True))
        lines = []
        for i, (step, res) in enumerate(zip(steps, results), 1):
            if isinstance(res, Exception):
                lines.append(f"{i}. [skipped: {step[:60]}]")
            else:
                lines.append(f"{i}. {res['content'][:200]}")
        combined = "Parallel agent results:\n" + "\n".join(lines)
        existing = state.get("tool_result") or ""
        return {**state, "tool_result": (existing + "\n\n" + combined).strip()}
    except Exception:
        return state


def plan_node(state: TaskState) -> TaskState:
    parts = []
    if state.get('memory_context'):
        parts.append(state['memory_context'])
    if state.get('skill_context'):
        parts.append(state['skill_context'])
    if state.get('tool_result'):
        parts.append(f"Tool output:\n{state['tool_result']}")
    parts.append(f'Task: {state["input"]}\n\nBreak this into steps:')
    prompt = '\n\n'.join(parts)
    res = call_llm('balanced', prompt)
    return {**state, "plan": res["content"]}


def execute_node(state: TaskState) -> TaskState:
    try:
        res = call_llm("balanced", "Plan:\n" + state["plan"] + "\n\nExecute and give the final answer")
        return {
            **state,
            "result": res["content"],
            "model_used": res["model_used"],
            "cost_usd": state["cost_usd"] + res["cost_usd"],
            "duration_ms": state["duration_ms"] + res["duration_ms"],
            "error": "",
        }
    except Exception as e:
        return {**state, "error": str(e)}


def verify_node(state: TaskState) -> TaskState:
    if state["error"]:
        return state
    try:
        res = call_llm("fast", "Is this a complete answer? Reply YES or NO only:\n" + state["result"])
        if "NO" in res["content"].upper():
            return {**state, "error": "incomplete"}
    except Exception:
        pass
    return state


def retry_node(state: TaskState) -> TaskState:
    new_attempts = state["attempts"] + 1
    if new_attempts >= 3:
        final_result = f"Unable to complete after 3 attempts. Last error: {state['error']}"
        from learning import record_outcome
        record_outcome(
            task_input=state['input'],
            result=final_result,
            outcome='failure',
            error=state['error'],
            attempts=new_attempts,
            model_used=state['model_used'],
        )
        return {**state, "attempts": new_attempts, "result": final_result, "error": ""}
    return {**state, "attempts": new_attempts, "error": ""}


def widget_node(state: TaskState) -> TaskState:
    cmd = _detect_widget_cmd(state["input"])
    return {**state, "widget_cmd": cmd or {}}


def output_node(state: TaskState) -> TaskState:
    return state


def save_memory_node(state: TaskState) -> TaskState:
    from learning import OutcomeType, record_outcome
    if state['result'] and not state['error']:
        try:
            from memory import get_memory
            get_memory().update_from_conversation(state['input'], state['result'])
            try:
                from metrics import inc_memory_hit
                inc_memory_hit()
            except Exception:
                pass
        except Exception:
            try:
                from metrics import inc_memory_error
                inc_memory_error()
            except Exception:
                pass
        outcome: OutcomeType = 'success' if state['attempts'] <= 1 else 'retry'
        record_outcome(
            task_input=state['input'],
            result=state['result'],
            outcome=outcome,
            attempts=state['attempts'],
            model_used=state['model_used'],
        )
    elif state['error']:
        record_outcome(
            task_input=state['input'],
            result=state.get('result', ''),
            outcome='failure',
            error=state['error'],
            attempts=state['attempts'],
            model_used=state['model_used'],
        )
        # Detect capability gap and auto-forge a skill if needed
        try:
            from skill_forge import auto_forge_from_gap
            auto_forge_from_gap(state.get('result', '') + state['error'], state['input'])
        except Exception:
            pass
    return state


def _route_after_route(state: TaskState) -> str:
    return state["path"]


def _route_after_verify(state: TaskState) -> str:
    if state["error"] and state["attempts"] < 3:
        return "retry_node"
    return "output_node"


def build_graph() -> StateGraph:
    g = StateGraph(TaskState)
    for fn in (route_node, fast_node, plan_node, parallel_agents_node, execute_node, verify_node, retry_node, widget_node, output_node):
        g.add_node(fn.__name__, fn)
    g.add_node('memory_node', memory_node)
    g.add_node('skill_node', skill_node)
    g.add_node('tool_node', tool_node)
    g.add_node('save_memory_node', save_memory_node)
    g.set_entry_point("route_node")
    g.add_conditional_edges("route_node", _route_after_route, {"fast": "fast_node", "slow": "memory_node"})
    g.add_edge('memory_node', 'skill_node')
    g.add_edge('skill_node', 'tool_node')
    g.add_edge('tool_node', 'plan_node')
    g.add_edge("fast_node", "widget_node")
    g.add_edge("plan_node", "parallel_agents_node")
    g.add_edge("parallel_agents_node", "execute_node")
    g.add_edge("execute_node", "verify_node")
    g.add_conditional_edges("verify_node", _route_after_verify, {"retry_node": "retry_node", "output_node": "widget_node"})
    g.add_edge("retry_node", "execute_node")
    g.add_edge("widget_node", "output_node")
    g.add_edge("output_node", "save_memory_node")
    g.add_edge('save_memory_node', END)
    return g


graph = build_graph().compile()


async def handle_task(task_id: str, input: str, model: str = "balanced") -> dict:
    state: TaskState = {
        "task_id": task_id,
        "input": input,
        "path": "",
        "plan": "",
        "result": "",
        "error": "",
        "attempts": 0,
        "model_used": "",
        "cost_usd": 0.0,
        "duration_ms": 0,
        'memory_context': '',
        'skill_context': '',
        'tool_result': '',
        'widget_cmd': {},
    }
    result_state = await asyncio.get_running_loop().run_in_executor(None, graph.invoke, state)
    return {
        "result": result_state["result"],
        "model_used": result_state["model_used"],
        "cost_usd": result_state["cost_usd"],
        "duration_ms": result_state["duration_ms"],
        "widget_cmd": result_state.get("widget_cmd") or None,
    }
