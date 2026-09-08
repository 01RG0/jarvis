import os
import sqlite3
import time

from dotenv import load_dotenv

load_dotenv()

DB_PATH = os.environ.get("SQLITE_PATH", "./data/jarvis.db")


def init_db() -> str:
    db_dir = os.path.dirname(os.path.abspath(DB_PATH))
    os.makedirs(db_dir, mode=0o700, exist_ok=True)
    # Pre-create with 0o600 (owner read/write only) before sqlite3 opens it.
    # Using os.open avoids the world-readable window that os.chmod after-the-fact would leave.
    fd = os.open(DB_PATH, os.O_CREAT | os.O_WRONLY, 0o600)
    os.fchmod(fd, 0o600)  # enforce on existing files too — no TOCTOU gap
    os.close(fd)
    con = sqlite3.connect(DB_PATH)
    con.execute("""
        CREATE TABLE IF NOT EXISTS calls (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            ts          REAL    NOT NULL,
            prompt      TEXT,
            response    TEXT,
            model       TEXT,
            cost_usd    REAL    DEFAULT 0.0,
            duration_ms INTEGER DEFAULT 0
        )
    """)
    con.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id         TEXT PRIMARY KEY,
            status     TEXT,
            created_at REAL,
            updated_at REAL,
            error      TEXT
        )
    """)
    con.commit()
    con.close()
    return DB_PATH


def log_call(
    prompt: str,
    response: str,
    model: str = "",
    cost: float = 0.0,
    duration_ms: int = 0,
) -> None:
    con = sqlite3.connect(DB_PATH)
    con.execute(
        "INSERT INTO calls (ts, prompt, response, model, cost_usd, duration_ms) VALUES (?,?,?,?,?,?)",
        (time.time(), prompt, response, model, cost, duration_ms),
    )
    con.commit()
    con.close()


def get_spend_summary() -> list[dict]:
    con = sqlite3.connect(DB_PATH)
    rows = con.execute("""
        SELECT model,
               COUNT(*) AS calls,
               ROUND(SUM(cost_usd), 6) AS cost_usd,
               ROUND(AVG(duration_ms)) AS avg_ms
        FROM calls
        GROUP BY model
        ORDER BY cost_usd DESC
    """).fetchall()
    con.close()
    return [{'model': r[0], 'calls': r[1], 'cost_usd': r[2], 'avg_ms': r[3]} for r in rows]


def get_recent_tasks(limit: int = 50) -> list[dict]:
    con = sqlite3.connect(DB_PATH)
    rows = con.execute("""
        SELECT id, prompt, response, datetime(ts, 'unixepoch') AS created_at, cost_usd
        FROM calls
        ORDER BY ts DESC
        LIMIT ?
    """, (limit,)).fetchall()
    con.close()
    return [{'id': str(r[0]), 'input': r[1], 'result': r[2], 'created_at': r[3], 'cost_usd': r[4]} for r in rows]


if __name__ == "__main__":
    path = init_db()
    print(f"DB initialized at {path}")
