import sqlite3
import os
import json
import bcrypt

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "autopilot.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT CHECK(role IN ('admin', 'developer', 'viewer')) NOT NULL DEFAULT 'developer',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    # Create approval_requests table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS approval_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        tool_name TEXT NOT NULL,
        tool_input TEXT NOT NULL,
        status TEXT CHECK(status IN ('pending', 'approved', 'denied', 'executed')) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_by INTEGER,
        reviewed_at TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(reviewed_by) REFERENCES users(id)
    );
    """)
    
    conn.commit()
    
    # Seed users if empty
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        admin_hash = bcrypt.hashpw(b"admin", bcrypt.gensalt()).decode("utf-8")
        dev_hash = bcrypt.hashpw(b"developer", bcrypt.gensalt()).decode("utf-8")
        
        cursor.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
            ("admin", admin_hash, "admin")
        )
        cursor.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
            ("developer", dev_hash, "developer")
        )
        conn.commit()
        
    conn.close()

def get_user_by_username(username: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def get_user_by_id(user_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def create_approval_request(user_id: int, tool_name: str, tool_input: dict) -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO approval_requests (user_id, tool_name, tool_input, status) VALUES (?, ?, ?, ?)",
        (user_id, tool_name, json.dumps(tool_input), "pending")
    )
    request_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return request_id

def get_all_requests():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT r.*, u.username as requester_name, rev.username as reviewer_name
        FROM approval_requests r
        JOIN users u ON r.user_id = u.id
        LEFT JOIN users rev ON r.reviewed_by = rev.id
        ORDER BY r.created_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_request_by_id(request_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT r.*, u.username as requester_name, rev.username as reviewer_name
        FROM approval_requests r
        JOIN users u ON r.user_id = u.id
        LEFT JOIN users rev ON r.reviewed_by = rev.id
        WHERE r.id = ?
    """, (request_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def update_request_status(request_id: int, status: str, reviewed_by: int = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    if reviewed_by:
        from datetime import datetime
        now = datetime.now().isoformat()
        cursor.execute(
            "UPDATE approval_requests SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?",
            (status, reviewed_by, now, request_id)
        )
    else:
        cursor.execute(
            "UPDATE approval_requests SET status = ? WHERE id = ?",
            (status, request_id)
        )
    conn.commit()
    conn.close()

# Initialize on import
init_db()
