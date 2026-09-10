"""Jarvis Brain HTTP server.

Receives tasks from the Node.js gateway, runs the LangGraph planner, and
forwards task heartbeats to the Go watchdog.
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.request
from contextlib import asynccontextmanager
from pathlib import Path

import asyncio
import logging

import psutil
import uvicorn
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).parent))

load_dotenv()

from db import init_db, log_call, get_spend_summary, get_recent_tasks, start_flush_loop, get_llm_spend_by_model  # noqa: E402
from planner import handle_task  # noqa: E402
from notifier import notify_task_complete, notify_error  # noqa: E402

BRAIN_PORT = int(os.environ.get("BRAIN_PORT", "8001"))
WATCHDOG_HEARTBEAT_URL = "http://localhost:8099/heartbeat"
VERSION = "0.1.0"


_stats_cache: dict = {}
_stats_lock = asyncio.Lock()


async def _collect_stats() -> None:
    """Pre-collect psutil stats every 2s so /ws/stats never blocks."""
    psutil.cpu_percent()  # prime the baseline (first call always returns 0)
    while True:
        await asyncio.sleep(2)
        try:
            mem  = psutil.virtual_memory()
            disk = psutil.disk_usage("/")
            net  = psutil.net_io_counters()
            _stats_cache.update({
                "cpu":        psutil.cpu_percent(interval=None),
                "ram":        mem.percent,
                "ram_used_gb": round(mem.used / 1e9, 1),
                "disk":       disk.percent,
                "net_sent_kb": net.bytes_sent // 1024,
                "net_recv_kb": net.bytes_recv // 1024,
            })
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    start_flush_loop()
    asyncio.create_task(_collect_stats())
    from scheduler import get_scheduler
    get_scheduler().start()
    yield
    get_scheduler().shutdown(wait=False)


app = FastAPI(title="Jarvis Brain", version=VERSION, lifespan=lifespan)
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])

_log_subscribers: list[WebSocket] = []


class _WSLogHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        msg = {
            "ts":     self.formatTime(record, "%H:%M:%S.%f")[:-3],
            "level":  record.levelname,
            "msg":    self.format(record),
            "logger": record.name,
        }
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.call_soon_threadsafe(self._broadcast, msg)
        except RuntimeError:
            pass

    @staticmethod
    def _broadcast(msg: dict) -> None:
        for ws in _log_subscribers[:]:
            try:
                asyncio.ensure_future(ws.send_json(msg))
            except Exception:
                pass


_ws_log_handler = _WSLogHandler()
_ws_log_handler.setLevel(logging.DEBUG)
logging.getLogger().addHandler(_ws_log_handler)


class TaskRequest(BaseModel):
    id: str
    input: str
    model: str = "balanced"


class TaskResponse(BaseModel):
    task_id: str
    result: str
    model_used: str
    cost_usd: float
    duration_ms: int


class HealthResponse(BaseModel):
    status: str
    version: str


class HeartbeatRequest(BaseModel):
    task_id: str
    status: str


def _forward_heartbeat(task_id: str, status: str) -> None:
    """POST a heartbeat to the watchdog. Errors are swallowed (fire-and-forget)."""
    try:
        payload = json.dumps({"task_id": task_id, "status": status}).encode("utf-8")
        req = urllib.request.Request(
            WATCHDOG_HEARTBEAT_URL,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=2) as resp:
            resp.read()
    except Exception:
        pass


def _normalize_result(raw, default_model: str, elapsed_ms: int) -> tuple[str, str, float, int]:
    if isinstance(raw, dict):
        text = raw.get("result", raw.get("content", ""))
        if not isinstance(text, str):
            text = "" if text is None else str(text)
        model_used = raw.get("model_used") or default_model
        cost_usd = float(raw.get("cost_usd") or 0.0)
        duration_ms = int(raw.get("duration_ms") or elapsed_ms)
        return text, str(model_used), cost_usd, duration_ms
    return str(raw), default_model, 0.0, elapsed_ms


@app.post("/task", response_model=TaskResponse)
async def submit_task(task: TaskRequest) -> TaskResponse:
    start = time.perf_counter()
    raw = await handle_task(task.id, task.input, task.model)
    elapsed_ms = int((time.perf_counter() - start) * 1000)

    result, model_used, cost_usd, duration_ms = _normalize_result(
        raw, task.model, elapsed_ms
    )
    log_call(task.input, result, model_used, cost_usd, duration_ms)
    if cost_usd > 0 or len(result) > 50:
        notify_task_complete(task.id, result, cost_usd)
    return TaskResponse(
        task_id=task.id,
        result=result,
        model_used=model_used,
        cost_usd=cost_usd,
        duration_ms=duration_ms,
    )


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", version=VERSION)


@app.post("/heartbeat")
async def heartbeat(body: HeartbeatRequest, background_tasks: BackgroundTasks) -> dict:
    background_tasks.add_task(_forward_heartbeat, body.task_id, body.status)
    return {"ok": True}


@app.get("/dashboard/spend")
async def dashboard_spend() -> list:
    return get_spend_summary()


@app.get("/dashboard/tasks")
async def dashboard_tasks() -> list:
    return get_recent_tasks(50)


@app.get("/dashboard/memory")
async def dashboard_memory() -> list:
    try:
        from memory import get_memory
        raw = get_memory().memory.get_all(user_id='jarvis_user') or []
        if isinstance(raw, dict):
            raw = raw.get('results', [])
        return [{'id': str(i), 'memory': m.get('memory', '') if isinstance(m, dict) else str(m)} for i, m in enumerate(raw)]
    except Exception:
        return []


@app.get("/dashboard/alerts")
async def dashboard_alerts() -> list:
    return []


class ForgeToolRequest(BaseModel):
    capability: str


@app.post("/forge-tool")
async def forge_tool_endpoint(body: ForgeToolRequest) -> dict:
    from tool_forge import forge_tool
    return forge_tool(body.capability)


@app.get("/tools")
async def list_tools_endpoint() -> list:
    from tool_registry import list_tools
    return list_tools()


@app.get("/api/providers")
async def get_providers() -> dict:
    import yaml as _yaml
    from llm_router import _CONFIG_PATH
    with open(_CONFIG_PATH) as f:
        cfg = _yaml.safe_load(f)

    KEY_ENV_MAP = {
        "groq":      "GROQ_API_KEY",
        "gemini":    "GEMINI_API_KEY",
        "anthropic": "ANTHROPIC_API_KEY",
        "deepseek":  "DEEPSEEK_API_KEY",
        "openai":    "OPENAI_API_KEY",
        "perplexity":"PERPLEXITY_API_KEY",
        "xai":       "XAI_API_KEY",
        "mistral":   "MISTRAL_API_KEY",
        "together_ai": "TOGETHER_API_KEY",
        "fireworks_ai": "FIREWORKS_AI_API_KEY",
    }

    models = []
    for m in cfg.get("model_list", []):
        model_str = m["litellm_params"]["model"]
        provider = model_str.split("/")[0] if "/" in model_str else "unknown"
        key_env = KEY_ENV_MAP.get(provider, f"{provider.upper()}_API_KEY")
        models.append({
            "alias":    m["model_name"],
            "model":    model_str,
            "provider": provider,
            "key_env":  key_env,
            "key_set":  bool(os.environ.get(key_env)),
        })

    rs = cfg.get("router_settings", {})
    raw_fallbacks = rs.get("fallbacks", [])
    fallbacks: dict = {}
    if isinstance(raw_fallbacks, list):
        for item in raw_fallbacks:
            if isinstance(item, dict):
                fallbacks.update(item)
    elif isinstance(raw_fallbacks, dict):
        fallbacks = raw_fallbacks

    return {
        "models": models,
        "fallbacks": fallbacks,
        "router_settings": {
            "routing_strategy": rs.get("routing_strategy", "latency-based-routing"),
            "num_retries":      rs.get("num_retries", 2),
            "timeout":          rs.get("timeout", 30),
            "allowed_fails":    rs.get("allowed_fails", 2),
            "cooldown_time":    rs.get("cooldown_time", 60),
        },
    }


class ProviderUpdate(BaseModel):
    models: list[dict]
    fallbacks: dict
    router_settings: dict


@app.put("/api/providers")
async def update_providers(body: ProviderUpdate) -> dict:
    import yaml as _yaml
    import llm_router
    from llm_router import _CONFIG_PATH

    model_list = []
    for m in body.models:
        provider = m["model"].split("/")[0] if "/" in m["model"] else m["provider"]
        key_env = m.get("key_env", f"{provider.upper()}_API_KEY")
        model_list.append({
            "model_name": m["alias"],
            "litellm_params": {
                "model":   m["model"],
                "api_key": f"os.environ/{key_env}",
            },
        })

    fallback_list = [{k: v} for k, v in body.fallbacks.items()]
    cfg = {
        "model_list": model_list,
        "router_settings": {
            **body.router_settings,
            "fallbacks": fallback_list,
        },
    }

    with open(_CONFIG_PATH, "w") as f:
        _yaml.dump(cfg, f, default_flow_style=False, allow_unicode=True)

    llm_router._router = None
    return {"ok": True, "models_saved": len(model_list)}


@app.post("/api/providers/test/{alias}")
async def test_provider(alias: str) -> dict:
    from llm_router import call_llm_async
    start = time.perf_counter()
    try:
        result = await call_llm_async(
            messages=[{"role": "user", "content": "Respond with exactly: OK"}],
            model=alias,
        )
        return {
            "ok":          True,
            "alias":       alias,
            "model_used":  result.get("model_used", alias),
            "latency_ms":  int((time.perf_counter() - start) * 1000),
            "response":    (result.get("content") or "")[:120],
        }
    except Exception as e:
        return {
            "ok":         False,
            "alias":      alias,
            "latency_ms": int((time.perf_counter() - start) * 1000),
            "error":      str(e)[:200],
        }


@app.get("/api/providers/spend")
async def providers_spend() -> list:
    try:
        return get_llm_spend_by_model()
    except Exception:
        return []


@app.websocket("/ws/stats")
async def stats_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            if _stats_cache:
                await websocket.send_json(_stats_cache)
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        pass


@app.websocket("/ws/logs")
async def logs_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    _log_subscribers.append(websocket)
    try:
        while True:
            await asyncio.sleep(30)
    except WebSocketDisconnect:
        pass
    finally:
        if websocket in _log_subscribers:
            _log_subscribers.remove(websocket)


@app.websocket("/pc-ws")
async def pc_agent_ws(websocket: WebSocket) -> None:
    """Home PC agent connects here. One connection at a time."""
    token = websocket.headers.get("Authorization", "").removeprefix("Bearer ")
    if token != os.environ.get("JARVIS_PC_TOKEN", "dev-token"):
        await websocket.close(code=4001)
        return
    await websocket.accept()
    from tools.pc_agent_client import pc
    pc.attach(websocket)
    try:
        # Keep alive — pc_agent_client's receive loop does the real work
        while True:
            await asyncio.sleep(30)
    except WebSocketDisconnect:
        pass
    finally:
        pc.detach()


@app.get("/api/pc/status")
async def pc_status() -> dict:
    from tools.pc_agent_client import pc
    return {"connected": pc.connected}


@app.post("/api/pc/tool/{tool_name}")
async def pc_tool_call(tool_name: str, body: dict = None) -> dict:
    if body is None:
        body = {}
    from tools.pc_agent_client import pc
    if not pc.connected:
        return {"ok": False, "error": "PC agent not connected"}
    try:
        result = await pc.call(tool_name, body)
        return {"ok": True, "result": result}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.post("/api/clap-wake")
async def clap_wake() -> dict:
    """Called by the PC agent's clap trigger — signal JARVIS to listen."""
    logging.getLogger("jarvis").info("Clap wake trigger received from PC agent")
    return {"ok": True}


if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=BRAIN_PORT, reload=False)
