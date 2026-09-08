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

import uvicorn
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).parent))

load_dotenv()

from db import init_db, log_call  # noqa: E402
from planner import handle_task  # noqa: E402

BRAIN_PORT = int(os.environ.get("BRAIN_PORT", "8001"))
WATCHDOG_HEARTBEAT_URL = "http://localhost:8099/heartbeat"
VERSION = "0.1.0"


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Jarvis Brain", version=VERSION, lifespan=lifespan)


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


if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=BRAIN_PORT, reload=False)
