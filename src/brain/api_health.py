"""API health tracking — records per-tool success/failure in SQLite.

Tracks consecutive failures and marks a tool 'degraded' after 3 failures,
'fail' after 5. Used by tool_fallbacks.run_with_fallback to skip unhealthy
providers before trying them.
"""
import logging
import sqlite3
import threading
import time
from typing import Any

log = logging.getLogger(__name__)

_DEGRADE_AFTER = 3
_FAIL_AFTER = 5

_lock = threading.Lock()
_conn_local = threading.local()


def _get_conn() -> sqlite3.Connection:
    c = getattr(_conn_local, "conn", None)
    if c is None:
        from db import DB_PATH, _apply_pragmas
        c = sqlite3.connect(DB_PATH, check_same_thread=False, isolation_level=None)
        c.row_factory = sqlite3.Row
        _apply_pragmas(c)
        _conn_local.conn = c
    return c


def init_health_table() -> None:
    with _lock:
        _get_conn().executescript("""
            CREATE TABLE IF NOT EXISTS api_health (
                tool_name           TEXT NOT NULL,
                provider            TEXT NOT NULL DEFAULT '',
                status              TEXT NOT NULL DEFAULT 'unknown',
                last_checked        INTEGER,
                last_error          TEXT,
                consecutive_failures INTEGER DEFAULT 0,
                last_success_at     INTEGER,
                PRIMARY KEY (tool_name, provider)
            );
        """)


def record_success(tool_name: str, provider: str = "") -> None:
    now = int(time.time())
    with _lock:
        _get_conn().execute("""
            INSERT INTO api_health (tool_name, provider, status, last_checked,
                                    consecutive_failures, last_success_at)
            VALUES (?, ?, 'ok', ?, 0, ?)
            ON CONFLICT(tool_name, provider) DO UPDATE SET
                status               = 'ok',
                last_checked         = excluded.last_checked,
                consecutive_failures = 0,
                last_success_at      = excluded.last_success_at
        """, (tool_name, provider, now, now))


def record_failure(tool_name: str, provider: str = "", error: str = "") -> None:
    now = int(time.time())
    with _lock:
        c = _get_conn()
        c.execute("""
            INSERT INTO api_health (tool_name, provider, status, last_checked,
                                    last_error, consecutive_failures)
            VALUES (?, ?, 'fail', ?, ?, 1)
            ON CONFLICT(tool_name, provider) DO UPDATE SET
                last_checked         = excluded.last_checked,
                last_error           = excluded.last_error,
                consecutive_failures = consecutive_failures + 1,
                status               = CASE
                    WHEN consecutive_failures + 1 >= ? THEN 'fail'
                    WHEN consecutive_failures + 1 >= ? THEN 'degraded'
                    ELSE 'fail'
                END
        """, (tool_name, provider, now, error[:500], _FAIL_AFTER, _DEGRADE_AFTER))


def is_healthy(tool_name: str, provider: str = "") -> bool:
    try:
        row = _get_conn().execute(
            "SELECT status, consecutive_failures FROM api_health WHERE tool_name=? AND provider=?",
            (tool_name, provider),
        ).fetchone()
        if row is None:
            return True  # never recorded = assume ok
        return row["status"] not in ("fail",)
    except Exception as e:
        log.warning("api_health.is_healthy error: %s", e)
        return True  # on DB error, don't block tools


def get_health() -> dict[str, Any]:
    try:
        rows = _get_conn().execute(
            "SELECT * FROM api_health ORDER BY tool_name, provider"
        ).fetchall()
        return {
            f"{r['tool_name']}{'/' + r['provider'] if r['provider'] else ''}": {
                "status": r["status"],
                "consecutive_failures": r["consecutive_failures"],
                "last_error": r["last_error"],
                "last_checked": r["last_checked"],
                "last_success_at": r["last_success_at"],
            }
            for r in rows
        }
    except Exception as e:
        log.warning("api_health.get_health error: %s", e)
        return {}


def probe_all() -> dict[str, str]:
    """Cheap liveness probe for each tool — call at startup or on schedule."""
    results: dict[str, str] = {}

    def _probe(tool_name: str, fn: Any, args: dict) -> None:
        try:
            fn(**args)
            record_success(tool_name)
            results[tool_name] = "ok"
        except Exception as e:
            record_failure(tool_name, error=str(e))
            results[tool_name] = f"fail: {e}"

    try:
        from tools.web_search import _ddg, _wikipedia
        try:
            _ddg("test")
            record_success("web_search", "ddg")
            results["web_search/ddg"] = "ok"
        except Exception as e:
            record_failure("web_search", "ddg", str(e))
            results["web_search/ddg"] = f"fail: {e}"

        try:
            _wikipedia("test")
            record_success("web_search", "wikipedia")
            results["web_search/wikipedia"] = "ok"
        except Exception as e:
            record_failure("web_search", "wikipedia", str(e))
            results["web_search/wikipedia"] = f"fail: {e}"
    except Exception as e:
        log.warning("probe web_search: %s", e)

    try:
        from tools.weather import _wttr
        try:
            _wttr("London")
            record_success("get_weather", "wttr")
            results["get_weather/wttr"] = "ok"
        except Exception as e:
            record_failure("get_weather", "wttr", str(e))
            results["get_weather/wttr"] = f"fail: {e}"
    except Exception as e:
        log.warning("probe weather: %s", e)

    return results
