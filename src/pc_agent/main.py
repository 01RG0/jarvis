"""JARVIS PC Agent — asyncio WebSocket client.

Connects outbound to the Azure brain's /pc-ws endpoint.
Dispatches tool calls, sends heartbeats, handles approval flow.
Run at startup via install.bat → Windows Task Scheduler.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from datetime import datetime, timezone

import websockets
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger("pc_agent")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

BRAIN_WS_URL = os.environ.get("JARVIS_BRAIN_WS_URL", "ws://localhost:8001/pc-ws")
PC_TOKEN      = os.environ.get("JARVIS_PC_TOKEN", "dev-token")
HEARTBEAT_S   = int(os.environ.get("WORKER_HEARTBEAT_INTERVAL_SECONDS", "30"))


async def dispatch(msg: dict) -> dict:
    from .tools import TOOLS, load_all
    from .security import classify, request_approval, verify_message
    from .audit import log as audit_log

    if not verify_message(msg, PC_TOKEN):
        return {"id": msg.get("id"), "ok": False, "error": "Invalid signature"}

    tool_name = msg.get("tool", "")
    args = msg.get("args", {})
    req_id = msg.get("id", "unknown")

    if not TOOLS:
        load_all()

    entry = TOOLS.get(tool_name)
    if not entry:
        return {"id": req_id, "ok": False, "error": f"Unknown tool: {tool_name}"}

    tier = entry["tier"]
    approved = True

    if tier == "dangerous":
        detail = json.dumps(args)[:80]
        approved = await asyncio.get_event_loop().run_in_executor(
            None, lambda: request_approval(req_id, tool_name, detail, timeout=10)
        )
        if not approved:
            audit_log(tool_name, args, tier, False, False, 0)
            return {"id": req_id, "ok": False, "error": "Approval denied by user"}

    t0 = time.perf_counter()
    try:
        result = await asyncio.get_event_loop().run_in_executor(
            None, lambda: entry["fn"](**args)
        )
        elapsed = int((time.perf_counter() - t0) * 1000)
        audit_log(tool_name, args, tier, approved, True, elapsed)
        return {"id": req_id, "ok": True, "result": result, "elapsed_ms": elapsed}
    except Exception as e:
        elapsed = int((time.perf_counter() - t0) * 1000)
        audit_log(tool_name, args, tier, approved, False, elapsed)
        return {"id": req_id, "ok": False, "error": str(e)}


async def heartbeat_loop(ws) -> None:
    from .tools.system import get_stats
    while True:
        await asyncio.sleep(HEARTBEAT_S)
        try:
            stats = get_stats()
            payload = json.dumps({
                "type": "heartbeat",
                "ts": datetime.now(timezone.utc).isoformat(),
                "stats": stats,
            })
            await ws.send(payload)
        except Exception:
            break


async def connect_loop() -> None:
    backoff = 2
    while True:
        try:
            log.info(f"Connecting to {BRAIN_WS_URL}")
            async with websockets.connect(
                BRAIN_WS_URL,
                extra_headers={"Authorization": f"Bearer {PC_TOKEN}"},
                ping_interval=20,
                ping_timeout=20,
            ) as ws:
                log.info("PC agent connected to brain")
                backoff = 2
                hb_task = asyncio.create_task(heartbeat_loop(ws))
                try:
                    async for raw in ws:
                        try:
                            msg = json.loads(raw)
                        except json.JSONDecodeError:
                            continue
                        if msg.get("type") == "ping":
                            await ws.send(json.dumps({"type": "pong"}))
                            continue
                        result = await dispatch(msg)
                        await ws.send(json.dumps(result))
                finally:
                    hb_task.cancel()
        except Exception as e:
            log.warning(f"Disconnected ({e}), retrying in {backoff}s")
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 60)


def _start_tray() -> None:
    try:
        import pystray
        from PIL import Image, ImageDraw

        img = Image.new("RGB", (32, 32), color=(0, 40, 80))
        draw = ImageDraw.Draw(img)
        draw.ellipse([8, 8, 24, 24], fill=(0, 168, 255))

        def on_quit(icon, _):
            icon.stop()
            os._exit(0)

        icon = pystray.Icon("JARVIS", img, "JARVIS PC Agent",
                            menu=pystray.Menu(pystray.MenuItem("Quit", on_quit)))
        icon.run()
    except Exception:
        pass


def main() -> None:
    import threading
    tray_thread = threading.Thread(target=_start_tray, daemon=True)
    tray_thread.start()

    # Start clap watcher in background
    try:
        from .clap_trigger import start_clap_watcher
        clap_thread = threading.Thread(target=start_clap_watcher, daemon=True)
        clap_thread.start()
    except Exception:
        pass

    asyncio.run(connect_loop())


if __name__ == "__main__":
    main()
