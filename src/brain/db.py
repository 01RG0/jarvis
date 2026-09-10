import os
import sqlite3
import threading
import time
import asyncio
import logging
from collections import deque
from functools import lru_cache
from typing import Any

from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger(__name__)

DB_PATH = os.environ.get("SQLITE_PATH", "./data/jarvis.db")

# ── Single persistent connection (WAL mode, one per thread) ──────────────────

_local = threading.local()
_write_lock = threading.Lock()

def _conn() -> sqlite3.Connection:
    """Thread-local connection. WAL allows concurrent reads during writes."""
    c = getattr(_local, "conn", None)
    if c is None:
        c = sqlite3.connect(DB_PATH, check_same_thread=False, isolation_level=None)
        c.row_factory = sqlite3.Row
        _apply_pragmas(c)
        _local.conn = c
    return c


def _apply_pragmas(c: sqlite3.Connection) -> None:
    c.executescript("""
        PRAGMA journal_mode  = WAL;
        PRAGMA synchronous   = NORMAL;
        PRAGMA cache_size    = -65536;
        PRAGMA temp_store    = MEMORY;
        PRAGMA mmap_size     = 268435456;
        PRAGMA foreign_keys  = ON;
        PRAGMA busy_timeout  = 5000;
    """)


# ── Async write queue — never blocks the event loop ─────────────────────────

_write_queue: deque[tuple[str, tuple]] = deque()
_queue_task: asyncio.Task | None = None


async def _flush_loop() -> None:
    """Drain the write queue every 80ms. Batches multiple writes into one transaction."""
    while True:
        await asyncio.sleep(0.08)
        if not _write_queue:
            continue
        batch: list[tuple[str, tuple]] = []
        while _write_queue:
            batch.append(_write_queue.popleft())
        if not batch:
            continue
        try:
            c = _conn()
            with _write_lock:
                c.execute("BEGIN")
                for sql, params in batch:
                    c.execute(sql, params)
                c.execute("COMMIT")
        except Exception as e:
            log.warning("DB flush error: %s", e)
            try:
                _conn().execute("ROLLBACK")
            except Exception:
                pass


def start_flush_loop() -> None:
    global _queue_task
    loop = asyncio.get_event_loop()
    _queue_task = loop.create_task(_flush_loop())


def enqueue_write(sql: str, params: tuple = ()) -> None:
    """Non-blocking: push a write into the async queue."""
    _write_queue.append((sql, params))


# ── Schema init ──────────────────────────────────────────────────────────────

def init_db() -> str:
    db_dir = os.path.dirname(os.path.abspath(DB_PATH))
    os.makedirs(db_dir, mode=0o700, exist_ok=True)
    fd = os.open(DB_PATH, os.O_CREAT | os.O_WRONLY, 0o600)
    os.fchmod(fd, 0o600)
    os.close(fd)

    c = _conn()
    with _write_lock:
        c.executescript("""
            CREATE TABLE IF NOT EXISTS calls (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                ts          REAL    NOT NULL,
                prompt      TEXT,
                response    TEXT,
                model       TEXT,
                cost_usd    REAL    DEFAULT 0.0,
                duration_ms INTEGER DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_calls_ts    ON calls(ts DESC);
            CREATE INDEX IF NOT EXISTS idx_calls_model ON calls(model);

            CREATE TABLE IF NOT EXISTS tasks (
                id         TEXT PRIMARY KEY,
                status     TEXT,
                created_at REAL,
                updated_at REAL,
                error      TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at DESC);

            CREATE TABLE IF NOT EXISTS llm_spend (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                ts          REAL    NOT NULL,
                model       TEXT,
                cost_usd    REAL    DEFAULT 0.0,
                tokens_in   INTEGER DEFAULT 0,
                tokens_out  INTEGER DEFAULT 0,
                duration_ms INTEGER DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_spend_ts    ON llm_spend(ts DESC);
            CREATE INDEX IF NOT EXISTS idx_spend_model ON llm_spend(model);

            CREATE TABLE IF NOT EXISTS system_snapshots (
                id   INTEGER PRIMARY KEY AUTOINCREMENT,
                ts   REAL,
                cpu  REAL,
                ram  REAL,
                disk REAL
            );
            CREATE INDEX IF NOT EXISTS idx_snapshots_ts ON system_snapshots(ts DESC);

            CREATE TABLE IF NOT EXISTS api_health (
                tool_name            TEXT NOT NULL,
                provider             TEXT NOT NULL DEFAULT '',
                status               TEXT NOT NULL DEFAULT 'unknown',
                last_checked         INTEGER,
                last_error           TEXT,
                consecutive_failures INTEGER DEFAULT 0,
                last_success_at      INTEGER,
                PRIMARY KEY (tool_name, provider)
            );
        """)
    return DB_PATH


# ── Write helpers (non-blocking) ─────────────────────────────────────────────

def log_call(
    prompt: str,
    response: str,
    model: str = "",
    cost: float = 0.0,
    duration_ms: int = 0,
) -> None:
    enqueue_write(
        "INSERT INTO calls (ts, prompt, response, model, cost_usd, duration_ms) VALUES (?,?,?,?,?,?)",
        (time.time(), prompt[:4000], response[:8000], model, cost, duration_ms),
    )


def log_spend(model: str, cost_usd: float, tokens_in: int, tokens_out: int, duration_ms: int) -> None:
    enqueue_write(
        "INSERT INTO llm_spend (ts, model, cost_usd, tokens_in, tokens_out, duration_ms) VALUES (?,?,?,?,?,?)",
        (time.time(), model, cost_usd, tokens_in, tokens_out, duration_ms),
    )


def log_snapshot(cpu: float, ram: float, disk: float) -> None:
    enqueue_write(
        "INSERT INTO system_snapshots (ts, cpu, ram, disk) VALUES (?,?,?,?)",
        (time.time(), cpu, ram, disk),
    )


# ── Read helpers (with short TTL cache) ─────────────────────────────────────

_spend_cache: tuple[float, list] = (0.0, [])
_tasks_cache: tuple[float, list] = (0.0, [])
_CACHE_TTL = 30.0


def get_spend_summary() -> list[dict]:
    global _spend_cache
    if time.time() - _spend_cache[0] < _CACHE_TTL:
        return _spend_cache[1]
    rows = _conn().execute("""
        SELECT model,
               COUNT(*)                           AS calls,
               ROUND(SUM(cost_usd), 6)            AS cost_usd,
               ROUND(AVG(duration_ms))            AS avg_ms
        FROM calls
        GROUP BY model
        ORDER BY cost_usd DESC
        LIMIT 50
    """).fetchall()
    result = [dict(r) for r in rows]
    _spend_cache = (time.time(), result)
    return result


def get_recent_tasks(limit: int = 50) -> list[dict]:
    global _tasks_cache
    if time.time() - _tasks_cache[0] < _CACHE_TTL:
        return _tasks_cache[1]
    rows = _conn().execute("""
        SELECT id,
               prompt                             AS input,
               response                           AS result,
               datetime(ts, 'unixepoch')          AS created_at,
               cost_usd
        FROM calls
        ORDER BY ts DESC
        LIMIT ?
    """, (limit,)).fetchall()
    result = [dict(r) for r in rows]
    _tasks_cache = (time.time(), result)
    return result


def get_llm_spend_by_model() -> list[dict]:
    rows = _conn().execute("""
        SELECT model,
               COUNT(*)                           AS calls,
               ROUND(SUM(cost_usd), 6)            AS total_cost,
               SUM(tokens_in + tokens_out)        AS total_tokens,
               ROUND(AVG(duration_ms))            AS avg_ms
        FROM llm_spend
        GROUP BY model
        ORDER BY total_cost DESC
        LIMIT 50
    """).fetchall()
    return [dict(r) for r in rows]


def invalidate_cache() -> None:
    global _spend_cache, _tasks_cache
    _spend_cache = (0.0, [])
    _tasks_cache = (0.0, [])


if __name__ == "__main__":
    path = init_db()
    print(f"DB initialized at {path}")
