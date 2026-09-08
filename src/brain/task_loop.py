import asyncio
import httpx
import time
from typing import Dict, Any

WATCHDOG_HEARTBEAT_URL = "http://localhost:8099/heartbeat"
HEARTBEAT_INTERVAL = 30  # seconds


class TaskLoop:
    def __init__(self):
        self.queue: asyncio.Queue = asyncio.Queue()
        self.running: Dict[str, str] = {}  # task_id -> status

    async def add_task(self, task_id: str, input: str):
        self.running[task_id] = "pending"
        await self.queue.put({"task_id": task_id, "input": input})

    def get_status(self, task_id: str) -> str:
        return self.running.get(task_id, "unknown")

    async def _emit_heartbeat(self, task_id: str):
        try:
            async with httpx.AsyncClient() as client:
                await client.post(WATCHDOG_HEARTBEAT_URL, json={"task_id": task_id}, timeout=2.0)
        except Exception:
            pass

    async def process_loop(self):
        from planner import handle_task

        while True:
            item = await self.queue.get()
            task_id = item["task_id"]
            self.running[task_id] = "running"

            async def run_with_heartbeat():
                last_heartbeat = time.time()
                result_holder: Dict[str, Any] = {}

                async def execute():
                    result_holder["result"] = await handle_task(task_id, item["input"])

                async def heartbeat_loop():
                    nonlocal last_heartbeat
                    while True:
                        await asyncio.sleep(HEARTBEAT_INTERVAL)
                        await self._emit_heartbeat(task_id)

                exec_task = asyncio.create_task(execute())
                hb_task = asyncio.create_task(heartbeat_loop())

                try:
                    await asyncio.wait_for(exec_task, timeout=300)
                finally:
                    hb_task.cancel()

                return result_holder.get("result")

            try:
                await run_with_heartbeat()
                self.running[task_id] = "done"
            except Exception as e:
                self.running[task_id] = f"error: {e}"
            finally:
                self.queue.task_done()
