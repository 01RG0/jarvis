"""Brain-side thin RPC client for the home PC agent.

The PC agent connects to /pc-ws on the brain. This module queues calls
into that WebSocket and awaits the response.

Usage:
    from tools.pc_agent_client import pc
    result = await pc.call("screenshot", {})
    result = await pc.call("open_app", {"name": "chrome"})
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import os
import uuid
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect

log = logging.getLogger("pc_agent_client")

PC_TOKEN = os.environ.get("JARVIS_PC_TOKEN", "dev-token")


class PCAgentClient:
    def __init__(self) -> None:
        self._ws: WebSocket | None = None
        self._pending: dict[str, asyncio.Future] = {}
        self._recv_task: asyncio.Task | None = None

    def attach(self, ws: WebSocket) -> None:
        """Called by /pc-ws handler when the PC agent connects."""
        self._ws = ws
        if self._recv_task:
            self._recv_task.cancel()
        self._recv_task = asyncio.create_task(self._receive_loop())
        log.info("PC agent attached")

    def detach(self) -> None:
        self._ws = None
        if self._recv_task:
            self._recv_task.cancel()
        # Fail all pending calls
        for fut in self._pending.values():
            if not fut.done():
                fut.set_exception(RuntimeError("PC agent disconnected"))
        self._pending.clear()
        log.info("PC agent detached")

    @property
    def connected(self) -> bool:
        return self._ws is not None

    async def call(self, tool: str, args: dict | None = None, timeout: float = 30.0) -> Any:
        if not self._ws:
            raise RuntimeError("PC agent not connected")
        req_id = f"req_{uuid.uuid4().hex[:8]}"
        msg: dict = {"id": req_id, "tool": tool, "args": args or {}}
        msg["sig"] = self._sign(msg)
        fut: asyncio.Future = asyncio.get_event_loop().create_future()
        self._pending[req_id] = fut
        await self._ws.send_text(json.dumps(msg))
        try:
            result = await asyncio.wait_for(fut, timeout=timeout)
        except asyncio.TimeoutError:
            self._pending.pop(req_id, None)
            raise RuntimeError(f"PC tool '{tool}' timed out after {timeout}s")
        if not result.get("ok"):
            raise RuntimeError(result.get("error", "PC tool call failed"))
        return result.get("result")

    async def _receive_loop(self) -> None:
        try:
            while self._ws:
                raw = await self._ws.receive_text()
                data = json.loads(raw)
                # Route to pending future
                req_id = data.get("id")
                if req_id and req_id in self._pending:
                    fut = self._pending.pop(req_id)
                    if not fut.done():
                        fut.set_result(data)
                elif data.get("type") == "heartbeat":
                    log.debug(f"Heartbeat: {data.get('stats', {})}")
        except WebSocketDisconnect:
            self.detach()
        except Exception as e:
            log.warning(f"PC receive loop error: {e}")
            self.detach()

    def _sign(self, msg: dict) -> str:
        payload = json.dumps({k: v for k, v in msg.items() if k != "sig"}, sort_keys=True)
        return hmac.new(PC_TOKEN.encode(), payload.encode(), hashlib.sha256).hexdigest()


# Singleton shared across the brain
pc = PCAgentClient()
