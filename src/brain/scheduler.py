from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime
from typing import Any, Callable

import psutil
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.interval import IntervalTrigger
from langchain_core.tools import tool

from db import DB_PATH

log = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None
_start_time: float = time.time()


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler()
        _register_builtin_jobs(_scheduler)
    return _scheduler


def add_cron_job(job_id: str, cron_expr: str, fn: Callable, *args: Any) -> str:
    parts = cron_expr.split()
    minute, hour, day, month, day_of_week = (parts + ["*"] * 5)[:5]
    get_scheduler().add_job(
        fn, CronTrigger(minute=minute, hour=hour, day=day,
                        month=month, day_of_week=day_of_week),
        id=job_id, args=list(args), replace_existing=True,
    )
    return job_id


def add_interval_job(job_id: str, seconds: int, fn: Callable, *args: Any) -> str:
    get_scheduler().add_job(
        fn, IntervalTrigger(seconds=seconds),
        id=job_id, args=list(args), replace_existing=True,
    )
    return job_id


def add_once_job(job_id: str, run_at: datetime, fn: Callable, *args: Any) -> str:
    get_scheduler().add_job(
        fn, DateTrigger(run_date=run_at),
        id=job_id, args=list(args), replace_existing=True,
    )
    return job_id


def remove_job(job_id: str) -> bool:
    scheduler = get_scheduler()
    job = scheduler.get_job(job_id)
    if job is None:
        return False
    scheduler.remove_job(job_id)
    return True


def list_jobs() -> list[dict]:
    return [
        {
            "id": job.id,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
            "trigger_type": type(job.trigger).__name__.replace("Trigger", "").lower(),
        }
        for job in get_scheduler().get_jobs()
    ]


def _heartbeat_log() -> None:
    uptime_m = int((time.time() - _start_time) / 60)
    log.info("JARVIS heartbeat — uptime %dm", uptime_m)


def _stats_snapshot() -> None:
    from db import log_snapshot
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    log_snapshot(psutil.cpu_percent(), mem.percent, disk.percent)


def _daily_summary() -> None:
    log.info("Good morning. Daily summary ready.")


def _register_builtin_jobs(scheduler: AsyncIOScheduler) -> None:
    scheduler.add_job(_heartbeat_log, IntervalTrigger(seconds=60), id="heartbeat_log", replace_existing=True)
    scheduler.add_job(_stats_snapshot, IntervalTrigger(seconds=300), id="stats_snapshot", replace_existing=True)
    scheduler.add_job(_daily_summary, CronTrigger(hour=8, minute=0), id="daily_summary", replace_existing=True)


# ── LangGraph tools ──────────────────────────────────────────────────────────

@tool
def schedule_reminder(message: str, when: str) -> str:
    """Schedule a one-time reminder at a specific ISO datetime (e.g. '2026-09-10T15:00:00')."""
    try:
        run_at = datetime.fromisoformat(when)
    except ValueError:
        return f"Invalid datetime format: {when}. Use ISO format like '2026-09-10T15:00:00'."
    job_id = f"reminder_{int(run_at.timestamp())}"

    def _fire() -> None:
        log.info("JARVIS reminder: %s", message)

    add_once_job(job_id, run_at, _fire)
    return f"Reminder scheduled for {run_at.isoformat()}: '{message}' (id: {job_id})"


@tool
def list_scheduled_tasks() -> str:
    """List all currently scheduled JARVIS tasks."""
    jobs = list_jobs()
    if not jobs:
        return "No scheduled tasks."
    lines = [f"- {j['id']} | {j['trigger_type']} | next: {j['next_run']}" for j in jobs]
    return "\n".join(lines)


@tool
def cancel_task(job_id: str) -> str:
    """Cancel a scheduled task by its ID."""
    removed = remove_job(job_id)
    return f"Task '{job_id}' cancelled." if removed else f"No task found with id '{job_id}'."
