import os
import sqlite3
import time

from dotenv import load_dotenv

load_dotenv()

DB_PATH = os.environ.get("SQLITE_PATH", "./data/jarvis.db")


def init_db() -> str:
    os.makedirs(os.path.dirname(os.path.abspath(DB_PATH)), exist_ok=True)
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


if __name__ == "__main__":
    path = init_db()
    print(f"DB initialized at {path}")
