"""
Hermes Data Aggregator
Reads from Hermes SQLite DBs (state.db, kanban.db) and disk sources.
Includes full token breakdown: input, output, cache_read, cache_write, reasoning.
"""

import json
import os
import glob
import sqlite3
import time

HERMES_HOME = os.path.expanduser("~/.hermes")
STATE_DB = os.path.join(HERMES_HOME, "state.db")
KANBAN_DB = os.path.join(HERMES_HOME, "kanban.db")

def _conn(db_path):
    conn = sqlite3.connect("file:" + db_path + "?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn

def get_overview():
    """High-level stats from Hermes databases — includes cache tokens."""
    from server import sqlite_query
    since = time.time() - (7 * 24 * 60 * 60)  # 7 days ago as unix timestamp

    # Full token breakdown: input + output + cache_read + cache_write + reasoning
    rows = sqlite_query(STATE_DB, """
        SELECT
            COALESCE(SUM(input_tokens), 0) as input_tok,
            COALESCE(SUM(output_tokens), 0) as output_tok,
            COALESCE(SUM(cache_read_tokens), 0) as cache_read_tok,
            COALESCE(SUM(cache_write_tokens), 0) as cache_write_tok,
            COALESCE(SUM(reasoning_tokens), 0) as reasoning_tok,
            COALESCE(SUM(actual_cost_usd), 0) as cost
        FROM sessions WHERE started_at > ?
    """, (since,))
    tot = rows[0] if rows else {}

    # Model-level token breakdown (including cache_write and reasoning)
    model_rows = sqlite_query(STATE_DB, """
        SELECT
            model, billing_provider,
            COALESCE(SUM(input_tokens), 0) as input_tok,
            COALESCE(SUM(output_tokens), 0) as output_tok,
            COALESCE(SUM(cache_read_tokens), 0) as cache_read_tok,
            COALESCE(SUM(cache_write_tokens), 0) as cache_write_tok,
            COALESCE(SUM(reasoning_tokens), 0) as reasoning_tok,
            COALESCE(SUM(estimated_cost_usd), 0) as est_cost,
            COALESCE(SUM(actual_cost_usd), 0) as act_cost,
            COUNT(*) as sess_count
        FROM sessions
        WHERE started_at > ?
        GROUP BY model, billing_provider
        ORDER BY act_cost DESC
    """, (since,))

    s7 = sqlite_query(STATE_DB, "SELECT COUNT(*) as c FROM sessions WHERE started_at > ?", (since,))
    active = sqlite_query(STATE_DB, "SELECT COUNT(*) as c FROM sessions WHERE ended_at IS NULL")
    pending = sqlite_query(KANBAN_DB, "SELECT COUNT(*) as c FROM tasks WHERE status IN ('pending','in_progress')")
    dels = sqlite_query(STATE_DB, "SELECT COUNT(*) as c FROM async_delegations WHERE state = 'running'")

    total_tokens = (tot.get("input_tok", 0) + tot.get("output_tok", 0) +
                    tot.get("cache_read_tok", 0) + tot.get("cache_write_tok", 0) +
                    tot.get("reasoning_tok", 0))

    return {
        "tokens_7d": total_tokens,
        "input_tokens_7d": tot.get("input_tok", 0),
        "output_tokens_7d": tot.get("output_tok", 0),
        "cache_read_tokens_7d": tot.get("cache_read_tok", 0),
        "cache_write_tokens_7d": tot.get("cache_write_tok", 0),
        "reasoning_tokens_7d": tot.get("reasoning_tok", 0),
        "cost_7d_usd": round(tot.get("cost", 0), 4),
        "sessions_7d": s7[0]["c"] if s7 else 0,
        "active_sessions": active[0]["c"] if active else 0,
        "pending_tasks": pending[0]["c"] if pending else 0,
        "active_delegations": dels[0]["c"] if dels else 0,
        "models": model_rows,
    }

def get_sessions(limit=50):
    """List recent sessions — includes cache_read_tokens and cache_write_tokens."""
    from server import sqlite_query
    rows = sqlite_query(STATE_DB, """
        SELECT id, title, started_at, ended_at, end_reason, model,
               input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
               reasoning_tokens, estimated_cost_usd, actual_cost_usd,
               session_key, display_name, billing_provider
        FROM sessions ORDER BY started_at DESC LIMIT ?
    """, (limit,))
    return [dict(r) for r in rows]

def get_skills_info():
    """Read skills directory and memory facts."""
    skills_dir = os.path.join(HERMES_HOME, "skills")
    profiles_dir = os.path.join(HERMES_HOME, "profiles")
    skills_count = len(glob.glob(skills_dir + "/**/*.md", recursive=True))
    profiles = []

    if os.path.isdir(profiles_dir):
        for d in sorted(os.listdir(profiles_dir)):
            p = os.path.join(profiles_dir, d)
            if os.path.isdir(p):
                profiles.append({"name": d, "path": p})

    # Count memory facts
    mem_count = 0
    mem_dir = os.path.join(HERMES_HOME, "memories")
    if os.path.isdir(mem_dir):
        mem_count = len(glob.glob(mem_dir + "/**/*.json", recursive=True))

    # gbrain notes
    gbrain_path = os.path.join(os.path.expanduser("~"),
        "Documents/Steinhoff Systems/gbrain")
    gbrain_count = 0
    if os.path.isdir(gbrain_path):
        gbrain_count = len(glob.glob(gbrain_path + "/**/*.md", recursive=True))

    return {
        "skills_count": skills_count,
        "profiles": profiles,
        "memory_facts": mem_count,
        "gbrain_notes": gbrain_count,
    }
