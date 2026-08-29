"""Hermes Control Aggregator — sessions, agents, health."""

import os, glob, sqlite3

HERMES_HOME = os.path.expanduser("~/.hermes")
STATE_DB = os.path.join(HERMES_HOME, "state.db")
KANBAN_DB = os.path.join(HERMES_HOME, "kanban.db")

def _conn(db_path):
    conn = sqlite3.connect("file:" + db_path + "?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn

def get_control_data():
    sessions = []
    try:
        conn = _conn(STATE_DB)
        rows = conn.execute("""
            SELECT id, title, started_at, ended_at, end_reason, model,
                   input_tokens, output_tokens, estimated_cost_usd,
                   session_key, display_name
            FROM sessions ORDER BY started_at DESC LIMIT 50
        """).fetchall()
        conn.close()
        sessions = [dict(r) for r in rows]
    except Exception:
        pass

    active = [s for s in sessions if not s.get("ended_at")]
    skills_dir = os.path.join(HERMES_HOME, "skills")
    skills_count = len(glob.glob(skills_dir + "/**/*.md", recursive=True))
    profiles_dir = os.path.join(HERMES_HOME, "profiles")
    profile_count = len(os.listdir(profiles_dir)) if os.path.isdir(profiles_dir) else 0

    error_count = 0
    try:
        conn = _conn(STATE_DB)
        rows = conn.execute("""
            SELECT COUNT(*) as c FROM sessions
            WHERE end_reason LIKE '%error%' OR end_reason LIKE '%failed%'
        """).fetchall()
        if rows: error_count = rows[0]["c"]
        conn.close()
    except Exception:
        pass

    pending = 0
    try:
        conn = _conn(KANBAN_DB)
        rows = conn.execute("SELECT COUNT(*) as c FROM tasks WHERE status IN ('pending','in_progress')").fetchall()
        if rows: pending = rows[0]["c"]
        conn.close()
    except Exception:
        pass

    # Plugins
    plugins_dir = os.path.join(HERMES_HOME, "plugins")
    plugin_count = len(glob.glob(plugins_dir + "/*")) if os.path.isdir(plugins_dir) else 0

    return {
        "stats": {
            "active_sessions": len(active),
            "running_agents": len([s for s in active if "agent" in (s.get("source") or "")]),
            "pending_tasks": pending,
            "skills": skills_count,
            "errors": error_count,
            "profiles": profile_count,
            "plugins": plugin_count,
        },
        "sessions": active,
        "models": _get_models(),
    }

def _get_models():
    from hermes_aggregator import get_overview
    stats = get_overview()
    return stats.get("models", [])
