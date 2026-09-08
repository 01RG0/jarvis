import asyncio
from typing import TypedDict
from llm_router import call_llm
from langgraph.graph import StateGraph, END

ACTION_KEYWORDS = {"deploy", "create", "build", "write", "fix", "search"}


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


def route_node(state: TaskState) -> TaskState:
    words = set(state["input"].lower().split())
    if len(state["input"]) < 200 and not words.intersection(ACTION_KEYWORDS):
        return {**state, "path": "fast"}
    return {**state, "path": "slow"}


def memory_node(state: TaskState) -> TaskState:
    from memory import get_memory
    context = get_memory().get_context(state['input'])
    return {**state, 'memory_context': context}


def fast_node(state: TaskState) -> TaskState:
    from memory import get_memory
    context = get_memory().get_context(state['input'])
    prompt = f'{context}\n\n{state["input"]}' if context else state['input']
    res = call_llm('fast', prompt)
    return {
        **state,
        "result": res["content"],
        "model_used": res["model_used"],
        "cost_usd": res["cost_usd"],
        "duration_ms": res["duration_ms"],
    }


def plan_node(state: TaskState) -> TaskState:
    prompt = f'{state["memory_context"]}\n\nTask: {state["input"]}\n\nBreak this into steps:' if state['memory_context'] else f'Task: {state["input"]}\nBreak this into steps:'
    res = call_llm('balanced', prompt)
    return {**state, "plan": res["content"]}


def execute_node(state: TaskState) -> TaskState:
    try:
        res = call_llm("smart", "Plan:\n" + state["plan"] + "\n\nExecute and give the final answer")
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
        return {
            **state,
            "attempts": new_attempts,
            "result": f"Unable to complete after 3 attempts. Last error: {state['error']}",
            "error": "",
        }
    return {**state, "attempts": new_attempts, "error": ""}


def output_node(state: TaskState) -> TaskState:
    return state


def save_memory_node(state: TaskState) -> TaskState:
    if state['result'] and not state['error']:
        from memory import get_memory
        get_memory().update_from_conversation(state['input'], state['result'])
    return state


def _route_after_route(state: TaskState) -> str:
    return state["path"]


def _route_after_verify(state: TaskState) -> str:
    if state["error"] and state["attempts"] < 3:
        return "retry_node"
    return "output_node"


def build_graph() -> StateGraph:
    g = StateGraph(TaskState)
    for fn in (route_node, fast_node, plan_node, execute_node, verify_node, retry_node, output_node):
        g.add_node(fn.__name__, fn)
    g.add_node('memory_node', memory_node)
    g.add_node('save_memory_node', save_memory_node)
    g.set_entry_point("route_node")
    g.add_conditional_edges("route_node", _route_after_route, {"fast": "fast_node", "slow": "memory_node"})
    g.add_edge('memory_node', 'plan_node')
    g.add_edge("fast_node", "save_memory_node")
    g.add_edge("plan_node", "execute_node")
    g.add_edge("execute_node", "verify_node")
    g.add_conditional_edges("verify_node", _route_after_verify, {"retry_node": "retry_node", "output_node": "output_node"})
    g.add_edge("retry_node", "execute_node")
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
    }
    result_state = await asyncio.get_event_loop().run_in_executor(None, graph.invoke, state)
    return {
        "result": result_state["result"],
        "model_used": result_state["model_used"],
        "cost_usd": result_state["cost_usd"],
        "duration_ms": result_state["duration_ms"],
    }
