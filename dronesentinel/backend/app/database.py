"""
SQLite persistence layer for detection session history.
Uses the standard library sqlite3 (synchronous) since all callers
run in background threads — no async complexity needed.
"""
import sqlite3
from datetime import datetime

from .config import DB_FILE


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create tables if they don't exist. Called once at startup."""
    conn = _connect()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS detection_sessions (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            start_time    TEXT NOT NULL,
            end_time      TEXT,
            model         TEXT,
            source        TEXT,
            total_drones  INTEGER DEFAULT 0,
            alerts_sent   INTEGER DEFAULT 0,
            total_frames  INTEGER DEFAULT 0,
            avg_confidence REAL DEFAULT 0.0,
            success       INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS drone_records (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id      INTEGER REFERENCES detection_sessions(id) ON DELETE CASCADE,
            track_id        INTEGER,
            first_frame     INTEGER,
            last_frame      INTEGER,
            detection_count INTEGER,
            max_confidence  REAL
        );
    """)
    conn.commit()
    conn.close()


def save_session(
    start_time: datetime,
    end_time: datetime,
    model: str,
    source: str,
    total_drones: int,
    alerts_sent: int,
    total_frames: int,
    avg_confidence: float,
    success: bool,
) -> int:
    """Insert a detection session record and return its id."""
    conn = _connect()
    cursor = conn.execute(
        """INSERT INTO detection_sessions
           (start_time, end_time, model, source, total_drones, alerts_sent,
            total_frames, avg_confidence, success)
           VALUES (?,?,?,?,?,?,?,?,?)""",
        (
            start_time.isoformat() if isinstance(start_time, datetime) else start_time,
            end_time.isoformat() if isinstance(end_time, datetime) else end_time,
            model, source, total_drones, alerts_sent,
            total_frames, avg_confidence, 1 if success else 0,
        ),
    )
    session_id = int(cursor.lastrowid or 0)
    conn.commit()
    conn.close()
    return session_id


def save_drone_records(session_id: int, drone_records: dict):
    """Insert per-drone records for a completed session."""
    conn = _connect()
    for track_id, d in drone_records.items():
        conn.execute(
            """INSERT INTO drone_records
               (session_id, track_id, first_frame, last_frame, detection_count, max_confidence)
               VALUES (?,?,?,?,?,?)""",
            (
                session_id, int(track_id),
                d.get("first_detected", 0), d.get("last_detected", 0),
                d.get("detection_count", 0), d.get("max_confidence", 0.0),
            ),
        )
    conn.commit()
    conn.close()


def get_sessions(limit: int = 50) -> list:
    conn = _connect()
    rows = conn.execute(
        "SELECT * FROM detection_sessions ORDER BY id DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_session_drones(session_id: int) -> list:
    conn = _connect()
    rows = conn.execute(
        "SELECT * FROM drone_records WHERE session_id = ?", (session_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
