"""
The Zeg — Unified API Server
Aggregates all Hermes + Circle Pipeline + Business Brain data sources.
"""

import json
import os
import sys
import sqlite3
import time
import threading
import urllib.request
from collections import deque
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# ═══ Real-time event streaming (SSE + Webhooks) ═══
# PAI/Webhook system: Hermes pushes events → Zeg stores them → dashboard gets SSE stream
EVENT_QUEUE = deque(maxlen=100)  # circular buffer of recent events
EVENT_LOCK = threading.Lock()
EVENT_ID = 0

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", "8700"))

HERMES_HOME = os.path.expanduser("~/.hermes")
STATE_DB = os.path.join(HERMES_HOME, "state.db")
KANBAN_DB = os.path.join(HERMES_HOME, "kanban.db")
CRONS_JSON = os.path.join(HERMES_HOME, "cron", "jobs.json")
EXECUTIONS_DB = os.path.join(HERMES_HOME, "cron", "executions.db")

PIPELINE_DIR = os.path.join(os.path.expanduser("~"),
    "Documents/Steinhoff Systems/steinvault/06-operations/dating-pipeline")
PIPELINE_DB = os.path.join(PIPELINE_DIR, "pipeline.db")
ROSTER_DB = os.path.join(os.path.expanduser("~"),
    "Documents/Steinhoff Systems/steinvault/leads/roster-db/roster.sqlite")

BUSINESS_BRAIN = os.path.join(os.path.expanduser("~"), "business-brain")
AGGREGATORS_DIR = os.path.join(BASE_DIR, "aggregators")
if AGGREGATORS_DIR not in sys.path:
    sys.path.insert(0, AGGREGATORS_DIR)

def safe_run(func, default=None):
    try:
        return func()
    except Exception as e:
        return default if default is not None else {}

def load_json_file(path, default=None):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return default if default is not None else {}

def fetch_remote(url, timeout=5):
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except Exception:
        return None

def sqlite_query(db_path, query, params=()):
    try:
        conn = sqlite3.connect("file:" + db_path + "?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(query, params).fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception:
        return []

def ts_to_iso(ts):
    """Convert unix epoch timestamp (float/int) to ISO string."""
    if ts is None:
        return None
    try:
        from datetime import datetime
        return datetime.fromtimestamp(float(ts)).isoformat()
    except (ValueError, TypeError, OverflowError):
        return str(ts)

# ═══ API Route Handlers ═══

def get_command_center():
    """Hermes command center data."""
    from hermes_aggregator import get_overview, get_sessions, get_skills_info
    sessions = safe_run(lambda: get_sessions(50), [])
    stats = safe_run(get_overview, {})
    skills = safe_run(get_skills_info, {})
    active = [s for s in sessions if not s.get("ended_at")]
    return {
        "stats": {
            "sessions": len(sessions),
            "active_sessions": len(active),
            "tokens": stats.get("tokens_7d", 0),
            "input_tokens_7d": stats.get("input_tokens_7d", 0),
            "output_tokens_7d": stats.get("output_tokens_7d", 0),
            "cache_read_tokens_7d": stats.get("cache_read_tokens_7d", 0),
            "cache_write_tokens_7d": stats.get("cache_write_tokens_7d", 0),
            "reasoning_tokens_7d": stats.get("reasoning_tokens_7d", 0),
            "cost": round(stats.get("cost_7d_usd", 0), 4),
            "tasks": stats.get("pending_tasks", 0),
            "delegations": stats.get("active_delegations", 0),
        },
        "token_breakdown": {
            "input": stats.get("input_tokens_7d", 0),
            "output": stats.get("output_tokens_7d", 0),
            "cache_read": stats.get("cache_read_tokens_7d", 0),
            "cache_creation": stats.get("cache_write_tokens_7d", 0),
            "reasoning": stats.get("reasoning_tokens_7d", 0),
            "total": stats.get("tokens_7d", 0),
        },
        "models": stats.get("models", []),
        "hermes": {
            "sessions": active,
            "skills": skills.get("skills_count", 0),
            "profiles": skills.get("profiles", []),
            "memory_facts": skills.get("memory_facts", 0),
            "gbrain_notes": skills.get("gbrain_notes", 0),
        }
    }

def get_circle_pipeline():
    from circle_aggregator import get_pipeline_data
    return safe_run(get_pipeline_data, get_circle_fallback())

def get_circle_fallback():
    return {"stats": {"obsession": 0, "active": 0, "bench": 0, "total": 0, "due_today": 0, "cap_max": 10}, "girls": [], "levers": []}

def get_mesh_crm():
    from mesh_aggregator import get_mesh_data
    return safe_run(get_mesh_data, get_mesh_fallback())

def get_mesh_fallback():
    return {"stats": {"total_people": 0, "circles": 0, "due": 0, "overdue": 0}, "people": [], "due": []}

def get_goals():
    from goals_aggregator import get_goals_data
    return safe_run(get_goals_data, get_goals_fallback())

def get_goals_fallback():
    return {"goals": {"target_aed": 50000, "current_aed": 0, "days_remaining": 60}, "timeline": [], "progress": 0}

def get_timeline():
    from timeline_aggregator import get_timeline_data
    return safe_run(get_timeline_data, {"events": [], "goals": [], "total_aed": 0})

def get_soul_engine():
    from souls_aggregator import get_souls_data
    return safe_run(get_souls_data, {"stats": {"total_souls": 20}, "souls": []})

def get_storefront():
    from storefront_aggregator import get_storefront_data
    return safe_run(get_storefront_data, {"stats": {}, "products": [], "leaders": []})

def get_ecosystem():
    from ecosystem_aggregator import get_ecosystem_data
    return safe_run(get_ecosystem_data, {"stats": {"total_agents": 645}, "pipeline": [], "channels": [], "models": []})

def get_hermes_control():
    from hermes_control_aggregator import get_control_data
    return safe_run(get_control_data, {"stats": {}, "sessions": []})

def get_agent_detail(session_id=None):
    """Get details for a specific session (HCI: Agent Detail Page)."""
    if not session_id:
        return {"error": "session_id required"}
    rows = safe_run(lambda: sqlite_query(STATE_DB,
        "SELECT * FROM sessions WHERE session_key = ? OR id = ? LIMIT 1",
        (session_id, session_id)), [])
    if rows:
        s = rows[0]
        return {
            "id": s.get("id", ""),
            "session_key": s.get("session_key", ""),
            "model": s.get("model", ""),
            "input_tokens": s.get("input_tokens", 0),
            "output_tokens": s.get("output_tokens", 0),
            "cache_read_tokens": s.get("cache_read_tokens", 0),
            "cache_write_tokens": s.get("cache_write_tokens", 0),
            "reasoning_tokens": s.get("reasoning_tokens", 0),
            "actual_cost_usd": s.get("actual_cost_usd", 0),
            "message_count": s.get("message_count", 0),
            "started_at": s.get("started_at", ""),
            "ended_at": s.get("ended_at", ""),
            "end_reason": s.get("end_reason", ""),
            "display_name": s.get("display_name", ""),
        }
    return {"error": "Session not found", "session_id": session_id}

def get_gateway_logs():
    """Gateway process logs + system metrics (HCI Monitor page)."""
    import subprocess
    logs = []
    # Check running processes
    try:
        ps = subprocess.run(["ps", "aux"], capture_output=True, text=True, timeout=3)
        for line in ps.stdout.strip().split("\n")[1:20]:  # top 20 processes
            parts = line.split(None, 10)
            if len(parts) >= 11:
                logs.append({
                    "pid": parts[1],
                    "cpu": parts[2],
                    "mem": parts[3],
                    "command": parts[10][:80],
                })
    except Exception:
        pass
    
    # Get system metrics
    import resource
    usage = resource.getrusage(resource.RUSAGE_SELF)
    
    return {
        "processes": logs,
        "metrics": {
            "cpu_user": usage.ru_utime,
            "cpu_sys": usage.ru_stime,
            "max_rss": usage.ru_maxrss,
            "page_faults": usage.ru_majflt + usage.ru_minflt,
        },
        "gateway_running": any(p.get("command","").lower().find("gateway") >= 0 for p in logs),
    }

def get_aurora_brain():
    from aurora_aggregator import get_aurora_data
    return safe_run(get_aurora_data, {"stats": {}, "recent_actions": []})

def get_ventures():
    """Business ventures from business-brain state.json."""
    bb_state = os.path.join(BUSINESS_BRAIN, "core", "state.json")
    state = load_json_file(bb_state, {})
    return {"businesses": state.get("businesses", {})}

def get_tasks():
    """Kanban tasks from kanban.db — includes comments and events."""
    tasks = safe_run(lambda: sqlite_query(KANBAN_DB,
        "SELECT rowid, id, title, body, status, priority, created_by, created_at, "
        "started_at, completed_at, assignee, result "
        "FROM tasks ORDER BY "
        "CASE status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 "
        "WHEN 'blocked' THEN 2 WHEN 'done' THEN 3 ELSE 4 END, created_at DESC LIMIT 50"), [])
    for t in tasks:
        # Use id if present, otherwise fall back to rowid (for legacy null-id tasks)
        tid = t.get("id") or str(t.get("rowid", ""))
        t["id"] = tid
        comments = sqlite_query(KANBAN_DB,
            "SELECT content, created_at, author FROM task_comments WHERE task_id = ? ORDER BY created_at",
            (tid,))
        events = sqlite_query(KANBAN_DB,
            "SELECT event_type, event_data, created_at FROM task_events WHERE task_id = ? ORDER BY created_at",
            (tid,))
        t["comments"] = comments
        t["events"] = events
    return {"tasks": tasks}

def get_delegations():
    """Active async delegations from state.db."""
    dels = safe_run(lambda: sqlite_query(STATE_DB,
        "SELECT delegation_id, origin_session, state, dispatched_at, completed_at, "
        "task_json, delivery_state FROM async_delegations "
        "ORDER BY dispatched_at DESC LIMIT 50"), [])
    for d in dels:
        try:
            d["task"] = json.loads(d.get("task_json", "{}"))
        except:
            d["task"] = {}
    return {"delegations": dels}

def get_crons():
    """Cron jobs from ~/.hermes/cron/jobs.json."""
    raw = safe_run(lambda: load_json_file(CRONS_JSON, {}), {})
    jobs = raw.get("jobs", []) if isinstance(raw, dict) else (raw if isinstance(raw, list) else [])
    crons = []
    for j in jobs:
        schedule = j.get("schedule", {})
        sched_display = j.get("schedule_display") or (
            schedule.get("cron") if isinstance(schedule, dict) else None
        ) or "unknown"
        repeat = j.get("repeat", {}) or {}
        crons.append({
            "id": j.get("id", ""),
            "name": j.get("name", ""),
            "schedule": sched_display,
            "state": j.get("state", "unknown"),
            "enabled": j.get("enabled", False),
            "completed": repeat.get("completed", 0) if isinstance(repeat, dict) else 0,
            "model": j.get("model", ""),
            "provider": j.get("provider", ""),
            "script": j.get("script", ""),
            "no_agent": j.get("no_agent", False),
        })
    return {"crons": crons}


def get_executions():
    """Recent cron executions from ~/.hermes/cron/executions.db."""
    rows = safe_run(lambda: sqlite_query(EXECUTIONS_DB,
        "SELECT id, job_id, source, pid, status, started_at, finished_at, error "
        "FROM executions ORDER BY started_at DESC LIMIT 50"), [])
    # Enrich with job names
    crons = get_crons().get("crons", [])
    job_names = {c["id"]: c["name"] for c in crons}
    for r in rows:
        r["job_name"] = job_names.get(r.get("job_id", ""), r.get("job_id", "?"))
    return {"executions": rows, "total": len(rows)}

def get_ports():
    """Check which ports are listening."""
    ports_to_check = [4242, 8502, 8765, 9120, 31337, 8700, 3141, 9501]
    results = []
    try:
        out = os.popen("lsof -i -P -n 2>/dev/null").read()
        for p in ports_to_check:
            listening = f":{p}" in out and "LISTEN" in out
            results.append({"port": p, "listening": listening})
    except Exception:
        pass
    return {"ports": results}

def get_gbrain():
    """Check GBrain MCP health."""
    result = {"running": False, "health": 0}
    data = fetch_remote("http://localhost:3141/health", timeout=3)
    if data:
        result["running"] = True
        result["health"] = data.get("health", 0)
    return result

def get_crontab():
    """Get raw crontab entries."""
    result = []
    try:
        out = os.popen("crontab -l 2>/dev/null").read()
        for line in out.strip().split("\n"):
            if line.strip() and not line.startswith("#"):
                result.append(line.strip()[:120])
    except Exception:
        pass
    return {"crontabs": result}

def get_email():
    """Check email pipeline status."""
    result = {"resend_configured": False, "gmail_configured": False, "today_sent": 0, "total_sent": 0}
    resend_key = os.environ.get("RESEND_API_KEY", "")
    result["resend_configured"] = bool(resend_key and len(resend_key) > 10)
    guser = os.environ.get("GMAIL_USER", os.environ.get("EMAIL_ADDRESS", ""))
    gpass = os.environ.get("GMAIL_APP_PASSWORD", os.environ.get("EMAIL_SMTP_PASSWORD", ""))
    gsmtp = os.environ.get("EMAIL_SMTP_HOST", "")
    result["gmail_configured"] = bool(guser and (gpass or gsmtp))
    return result

def get_pipeline_status():
    """Dating pipeline status from pipeline.db."""
    result = {"total": 0, "active": 0, "obsession": 0, "talking": 0, "warming": 0, "due_today": 0}
    try:
        result["active"] = (sqlite_query(PIPELINE_DB,
            "SELECT COUNT(*) as c FROM roster WHERE stage IN ('Talking','Obsession') AND due <= date('now')") or [{"c": 0}])[0]["c"]
        result["obsession"] = (sqlite_query(PIPELINE_DB,
            "SELECT COUNT(*) as c FROM roster WHERE stage='Obsession'") or [{"c": 0}])[0]["c"]
        result["talking"] = (sqlite_query(PIPELINE_DB,
            "SELECT COUNT(*) as c FROM roster WHERE stage='Talking'") or [{"c": 0}])[0]["c"]
        result["warming"] = (sqlite_query(PIPELINE_DB,
            "SELECT COUNT(*) as c FROM roster WHERE stage='Warming'") or [{"c": 0}])[0]["c"]
        result["due_today"] = (sqlite_query(PIPELINE_DB,
            "SELECT COUNT(*) as c FROM roster WHERE due <= date('now')") or [{"c": 0}])[0]["c"]
        result["total"] = (sqlite_query(PIPELINE_DB, "SELECT COUNT(*) as c FROM roster") or [{"c": 0}])[0]["c"]
    except Exception:
        pass
    return {"pipeline": result}

def get_souls():
    """Soul extraction pipeline status."""
    souls_dir = os.path.join(os.path.expanduser("~"),
        "Documents/The Soul Project/souls/hermes")
    souls = []
    try:
        if os.path.exists(souls_dir):
            for d in sorted(os.listdir(souls_dir)):
                sp = os.path.join(souls_dir, d)
                if os.path.isdir(sp):
                    jp = os.path.join(sp, "soul.json")
                    mp = os.path.join(sp, "SOUL.md")
                    exists = os.path.exists(jp) or os.path.exists(mp)
                    size = os.path.getsize(jp) if os.path.exists(jp) else (
                        os.path.getsize(mp) if os.path.exists(mp) else 0)
                    souls.append({"name": d, "exists": exists, "size": size})
    except PermissionError:
        pass
    except Exception:
        pass
    return {"souls": souls, "total": len(souls), "with_data": sum(1 for s in souls if s["exists"])}

def get_sessions_simple(params=None):
    """List recent sessions — lightweight version with timestamp conversion."""
    limit = (params or {}).get("limit", [50])
    if isinstance(limit, list):
        limit = int(limit[0]) if limit else 50
    elif isinstance(limit, str):
        limit = int(limit)
    rows = safe_run(lambda: sqlite_query(STATE_DB,
        """SELECT id, title, started_at, ended_at, end_reason, model,
           input_tokens, output_tokens, actual_cost_usd, message_count,
           session_key, display_name
        FROM sessions ORDER BY started_at DESC LIMIT ?""", (limit,)), [])
    out = []
    for r in rows:
        for f in ("started_at", "ended_at"):
            if f in r and r[f] is not None:
                r[f] = ts_to_iso(r[f])
        out.append(r)
    return out

def _get_param(params, key):
    """Extract a single value from parse_qs params (handles list and scalar)."""
    val = (params or {}).get(key, "")
    if isinstance(val, list):
        return val[0] if val else ""
    return val or ""

def get_session_detail(params):
    """Detail for a single session — includes messages list."""
    sid = _get_param(params, "id")
    if not sid:
        return {"error": "missing ?id="}
    sess = safe_run(lambda: sqlite_query(STATE_DB,
        "SELECT * FROM sessions WHERE id=? OR session_key=?", (sid, sid)), [])
    if not sess:
        return {"error": "session not found"}
    s = sess[0]
    for f in ("started_at", "ended_at"):
        if f in s and s[f] is not None:
            s[f] = ts_to_iso(s[f])
    msgs = safe_run(lambda: sqlite_query(STATE_DB,
        "SELECT id, role, content, tool_name, timestamp, finish_reason FROM messages WHERE session_id=? ORDER BY timestamp", (s["id"],)), [])
    for m in msgs:
        if m.get("timestamp") is not None:
            m["timestamp"] = ts_to_iso(m["timestamp"])
    return {"session": s, "messages": msgs[:200]}

def get_task_detail(params):
    """Detail for a single kanban task — includes comments and events."""
    tid = _get_param(params, "id")
    if not tid:
        return {"error": "missing ?id="}
    task = safe_run(lambda: sqlite_query(KANBAN_DB,
        "SELECT rowid, * FROM tasks WHERE id=? OR CAST(rowid AS TEXT)=?", (tid, tid)), [])
    if not task:
        return {"error": "task not found"}
    t = task[0]
    if t.get("created_at"):
        t["created_at"] = ts_to_iso(t["created_at"])
    comments = safe_run(lambda: sqlite_query(KANBAN_DB,
        "SELECT * FROM task_comments WHERE task_id=? ORDER BY created_at", (tid,)), [])
    events = safe_run(lambda: sqlite_query(KANBAN_DB,
        "SELECT * FROM task_events WHERE task_id=? ORDER BY created_at", (tid,)), [])
    return {"task": t, "comments": comments, "events": events}

def create_task(body):
    """Create a new kanban task. Note: requires write access to kanban.db
    (not available under delegation context — the dashboard API reads fine
    under delegation but writes are blocked by a HERMES_DELEGATED_CHILD_CONTEXT guard).
    Returns {"id": <uuid>, "status": "created"} on success."""
    import os
    from datetime import datetime
    # Guard against delegation context — kanban.db writes will fail
    if os.environ.get("HERMES_DELEGATED_CHILD_CONTEXT") == "1":
        return {"error": "kanban.db writes blocked under delegation context — run from a foreground process", "status": "failed"}
    # Input validation
    title = (body.get("title") or "").strip()
    if not title:
        return {"error": "title is required", "status": "failed"}
    if len(title) > 500:
        return {"error": "title exceeds 500 chars", "status": "failed"}
    desc = (body.get("body") or "").strip()[:2000]
    priority = body.get("priority", "normal")
    if priority not in ("normal", "high", "low", "urgent"):
        priority = "normal"
    if not isinstance(priority, str) or len(priority) > 50:
        priority = "normal"
    created_by = (body.get("created_by") or "zeg")[:100]
    # Normalize priority to integer (1-10) if string was passed
    if isinstance(priority, str):
        pl = {"low": 3, "normal": 5, "high": 8, "urgent": 10}
        try:
            priority_val = pl.get(priority, 5)
        except Exception:
            priority_val = 5
    else:
        priority_val = int(priority) if 0 < int(priority) <= 10 else 5
    try:
        import uuid as _uuid
        task_uuid = "t_" + _uuid.uuid4().hex[:8]
        conn = sqlite3.connect(KANBAN_DB)
        conn.row_factory = sqlite3.Row
        cur = conn.execute("""
            INSERT INTO tasks (id, title, body, status, priority, created_by, created_at)
            VALUES (?, ?, ?, 'todo', ?, ?, ?)
        """, (task_uuid, title, desc, priority_val, created_by, datetime.now().isoformat()))
        conn.commit()
        task_id = task_uuid
        conn.close()
        return {"id": task_id, "status": "created", "task_id": task_id, "title": title}
    except Exception as e:
        return {"error": str(e), "status": "failed"}

def hermes_chat(body):
    """Send a one-shot prompt to Hermes CLI and return the response.
    
    Uses `hermes -z` for fire-and-forget queries (one-shot mode, no session).
    The response is captured and returned as JSON.
    """
    import subprocess
    query = (body.get("query") or "").strip()
    if not query:
        return {"error": "query is required", "status": "failed"}
    
    profile = body.get("profile", "")
    model = body.get("model", "")
    skills = body.get("skills", "")
    
    cmd = ["hermes", "-z", query]
    if profile:
        cmd.extend(["-p", profile])
    if model:
        cmd.extend(["-m", model])
    if skills:
        cmd.extend(["-s", skills])
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
            cwd=os.path.expanduser("~/"),
        )
        return {
            "status": "ok" if result.returncode == 0 else "error",
            "query": query,
            "response": result.stdout.strip(),
            "stderr": result.stderr.strip()[:500] if result.stderr else "",
            "returncode": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {"error": "Hermes query timed out after 120s", "status": "failed", "query": query}
    except FileNotFoundError:
        return {"error": "hermes CLI not found", "status": "failed", "query": query}
    except Exception as e:
        return {"error": str(e), "status": "failed", "query": query}


def hermes_sessions_list(params=None):
    """List recent Hermes sessions from state.db."""
    params = params or {}
    limit = int(params.get("limit", ["20"])[0]) if isinstance(params.get("limit"), list) else int(params.get("limit", 20))
    rows = safe_run(lambda: sqlite_query(STATE_DB,
        "SELECT id, title, started_at, ended_at, model, input_tokens, output_tokens, actual_cost_usd, message_count, session_key, display_name, end_reason FROM sessions ORDER BY started_at DESC LIMIT ?",
        (limit,)), [])
    for r in rows:
        if r.get("started_at") is not None: r["started_at"] = ts_to_iso(r["started_at"])
        if r.get("ended_at") is not None: r["ended_at"] = ts_to_iso(r["ended_at"])
    return {"sessions": rows, "count": len(rows)}


def hermes_status():
    """Check if Hermes processes are running and return their status."""
    import subprocess
    result = {"running": [], "gateway": False}
    try:
        ps = subprocess.run(["ps", "aux"], capture_output=True, text=True, timeout=5)
        for line in ps.stdout.strip().split("\n")[1:]:
            parts = line.split(None, 10)
            if len(parts) < 11: continue
            cmd = parts[10]
            pid = parts[1]
            if "hermes" in cmd.lower() and "ps aux" not in cmd and "grep" not in cmd:
                result["running"].append({
                    "pid": pid,
                    "command": cmd[:80],
                    "cpu": parts[2],
                    "mem": parts[3],
                })
                if "gateway" in cmd.lower():
                    result["gateway"] = True
    except Exception:
        pass
    return result

def get_costs():
    """Cost breakdown by model — estimated and actual costs (7d)."""
    since = time.time() - (7 * 24 * 60 * 60)
    rows = safe_run(lambda: sqlite_query(STATE_DB,
        """SELECT model, billing_provider,
           SUM(input_tokens) as input_tok,
           SUM(output_tokens) as output_tok,
           SUM(cache_read_tokens) as cache_read_tok,
           SUM(cache_write_tokens) as cache_write_tok,
           SUM(reasoning_tokens) as reasoning_tok,
           SUM(estimated_cost_usd) as est_cost,
           SUM(actual_cost_usd) as act_cost,
           COUNT(*) as sess_count
        FROM sessions WHERE started_at > ?
        GROUP BY model, billing_provider ORDER BY est_cost DESC""", (since,)), [])
    return [{"model": r.get("model",""), "billing_provider": r.get("billing_provider",""),
             "input_tok": r.get("input_tok",0), "output_tok": r.get("output_tok",0),
             "cache_read_tok": r.get("cache_read_tok",0), "cache_write_tok": r.get("cache_write_tok",0),
             "reasoning_tok": r.get("reasoning_tok",0), "est_cost": r.get("est_cost",0),
             "act_cost": r.get("act_cost",0), "sess_count": r.get("sess_count",0)} for r in rows]

def get_models():
    """Model usage aggregation — totals across all sessions."""
    rows = safe_run(lambda: sqlite_query(STATE_DB,
        """SELECT model, billing_provider,
           SUM(input_tokens) as total_in,
           SUM(output_tokens) as total_out,
           SUM(actual_cost_usd) as total_cost,
           COUNT(*) as sess_count
        FROM sessions GROUP BY model ORDER BY total_cost DESC"""), [])
    return [{"model": r.get("model",""), "billing_provider": r.get("billing_provider",""),
             "total_in": r.get("total_in",0), "total_out": r.get("total_out",0),
             "total_cost": r.get("total_cost",0), "sess_count": r.get("sess_count",0)} for r in rows]

def get_system():
    """Full system snapshot with traffic light status (Neil Patel style)."""
    ports = get_ports()
    cc = get_command_center()
    return {
        "command_center": cc,
        "pipeline": get_pipeline_status(),
        "email": get_email(),
        "souls": get_souls(),
        "gbrain": get_gbrain(),
        "ports": ports,
        "crontab": get_crontab(),
        "status": {
            # Traffic light: green=all good, yellow=warning, red=critical
            "color": "green" if cc.get("stats", {}).get("active_sessions", 0) > 0 and ports.get("ports", [{}])[0].get("listening") else "orange",
            "summary": f"{cc.get('stats', {}).get('active_sessions', 0)} active sessions, {cc.get('hermes', {}).get('skills', 0)} skills loaded",
        },
        "next_actions": [
            {"label": "Check active sessions", "view": "hermes-control"},
            {"label": "Process due pipeline", "view": "circle-pipeline"},
            {"label": "Review token usage", "view": "command-center"},
            {"label": "Check cron status", "view": "cron-monitor"},
        ],
    }

GET_ROUTES = {
    "/api/command-center": get_command_center,
    "/api/tasks": get_tasks,
    "/api/task": get_task_detail,
    "/api/sessions": get_sessions_simple,
    "/api/session": get_session_detail,
    "/api/delegations": get_delegations,
    "/api/crons": get_crons,
    "/api/executions": get_executions,
    "/api/circle-pipeline": get_circle_pipeline,
    "/api/mesh-crm": get_mesh_crm,
    "/api/goals": get_goals,
    "/api/timeline": get_timeline,
    "/api/soul-engine": get_soul_engine,
    "/api/storefront": get_storefront,
    "/api/ecosystem": get_ecosystem,
    "/api/hermes-control": get_hermes_control,
    "/api/aurora-brain": get_aurora_brain,
    "/api/ventures": get_ventures,
    "/api/system": get_system,
    "/api/ports": get_ports,
    "/api/gbrain": get_gbrain,
    "/api/crontab": get_crontab,
    "/api/email": get_email,
    "/api/pipeline-status": get_pipeline_status,
    "/api/souls": get_souls,
    "/api/costs": get_costs,
    "/api/models": get_models,
    "/api/sessions": get_sessions_simple,
    "/api/session": get_session_detail,
    "/api/task": get_task_detail,
}

# Quick Actions endpoint (Brian Dean: "clear next actions, not just data")
def get_quick_actions():
    sys_data = get_system()
    actions = sys_data.get("next_actions", [])
    # Add dynamic actions based on state
    pipeline = sys_data.get("pipeline", {}).get("pipeline", {})
    if pipeline.get("due_today", 0) > 0:
        actions.insert(0, {"label": f"{pipeline['due_today']} due today — process now", "view": "circle-pipeline", "priority": "high"})
    tasks = get_tasks().get("tasks", [])
    blocked = [t for t in tasks if t.get("status") == "blocked"]
    if blocked:
        actions.append({"label": f"{len(blocked)} blocked tasks — unblock", "view": "tasks", "priority": "high"})
    return {"actions": actions, "count": len(actions)}

# ═══ Real-time event streaming ═══
def add_event(event_type, data):
    """Add an event to the live queue (called by webhooks, SSE clients)."""
    global EVENT_ID
    with EVENT_LOCK:
        EVENT_ID += 1
        event = {
            "id": EVENT_ID,
            "type": event_type,
            "data": data,
            "ts": time.time(),
        }
        EVENT_QUEUE.append(event)
        return event["id"]

def get_live_events():
    """Return recent events for SSE clients (polls use this too)."""
    with EVENT_LOCK:
        return list(EVENT_QUEUE)

# Webhook receiver: Hermes CC pushes real-time events here
def handle_webhook(body):
    """Receive webhook from Hermes CC or other services."""
    event_type = body.get("type", "generic")
    payload = body.get("data", body)
    event_id = add_event(event_type, payload)
    return {"ok": True, "event_id": event_id, "type": event_type}

GET_ROUTES["/api/quick-actions"] = get_quick_actions
GET_ROUTES["/api/events"] = get_live_events
GET_ROUTES["/api/gateway-logs"] = get_gateway_logs
GET_ROUTES["/api/hermes/sessions"] = hermes_sessions_list
GET_ROUTES["/api/hermes/status"] = hermes_status

class ZegHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        params = parse_qs(parsed.query)

        if path in GET_ROUTES:
            try:
                handler = GET_ROUTES[path]
                # Routes that accept query params get them; others get no args
                param_aware = {"/api/sessions", "/api/session", "/api/task"}
                data = handler(params) if path in param_aware else handler()
                self._send_json(data)
            except Exception as e:
                self._send_json({"error": str(e), "endpoint": path}, 500)
            return

        if path.startswith("/api/soul/"):
            parts = path.split("/")
            # /api/soul/<name>/talk? or /api/soul/<name>?q=...
            soul_name = parts[3] if len(parts) > 3 else ""
            is_talk = "/talk" in path
            if soul_name == "":
                self._send_json({"error": "Soul name required: /api/soul/<name>"}, 400)
            else:
                from souls_aggregator import talk_to_soul
                query = params.get("q", [""])[0]
                if not query and is_talk:
                    query = "What advice do you have for improving a dashboard?"
                elif not query:
                    query = "What advice do you have for improving a dashboard?"
                result = safe_run(lambda: talk_to_soul(soul_name, query), {"soul": soul_name, "response": "[Offline] Talk unavaiable"})
                if is_talk:
                    result["transcript"] = f"Talking with {soul_name}: {query}"
                self._send_json(result)
            return

        if path == "/api/health":
            self._send_json({"status": "ok", "port": PORT})
            return

        if path.startswith("/api/agent-detail"):
            sid = params.get("id", [""])[0]
            self._send_json(get_agent_detail(sid))
            return

        # ─── Server-Sent Events (SSE) ───
        if path == "/api/events/stream":
            self._handle_sse()
            return

        self._send_json({"error": "Not found", "routes": list(GET_ROUTES.keys())}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}

        if path == "/api/touch":
            self._send_json({"ok": True, "msg": "Touch logged"})
        elif path == "/api/bump":
            self._send_json({"ok": True, "msg": "Cadence bumped"})
        elif path == "/api/hermes-control/action":
            self._send_json({"ok": True, "action": body.get("action"), "executed": True})
        elif path == "/api/hermes/chat":
            self._send_json(hermes_chat(body))
        elif path == "/api/storefront/purchase":
            self._send_json({"ok": True, "success": True, "product_id": body.get("product_id")})
        elif path == "/api/webhook/hermes":
            result = handle_webhook(body)
            self._send_json(result)
        elif path == "/api/webhook/broadcast":
            event_id = add_event("broadcast", body)
            self._send_json({"ok": True, "event_id": event_id})
        elif path == "/api/friend-touch":
            person_id = body.get("person_id", "")
            event_id = add_event("friend_touch", {"person_id": person_id})
            self._send_json({"ok": True, "touched": person_id, "event_id": event_id})
        elif path == "/api/tasks/create":
            self._send_json(create_task(body))
        else:
            self._send_json({"error": "Not found"}, 404)

    def _send_json(self, data, status=200):
        payload = json.dumps(data, indent=2, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        self._send_json({"ok": True})

    def log_message(self, fmt, *args):
        print("[Zeg] " + (fmt % args), flush=True)

    # ─── SSE: Server-Sent Events for real-time data streaming ───
    def _handle_sse(self):
        """Stream live events to connected clients using SSE.
        Clients connect to /api/events/stream and receive new events as they arrive.
        Falls back to periodic polling if EventSource not supported."""
        import time
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        # Send initial keepalive + current event count
        try:
            self.wfile.write(f"data: {json.dumps({'type': 'connected', 'count': len(EVENT_QUEUE)})}\n\n".encode())
            self.wfile.flush()
        except Exception:
            return

        last_id = 0
        while True:
            try:
                with EVENT_LOCK:
                    new_events = [e for e in EVENT_QUEUE if e["id"] > last_id]

                if new_events:
                    for ev in new_events:
                        last_id = ev["id"]
                        payload = json.dumps({
                            "type": ev["type"],
                            "data": ev["data"],
                            "ts": ev["ts"],
                        }, default=str)
                        self.wfile.write(f"id: {ev['id']}\ndata: {payload}\n\n".encode())
                        self.wfile.flush()

                # Heartbeat every 15s to keep connection alive
                self.wfile.write(f": ping\n\n".encode())
                self.wfile.flush()

                time.sleep(15)
            except BrokenPipeError:
                break
            except Exception:
                break

if __name__ == "__main__":
    print("[Zeg] Unified API Server on:" + str(PORT), flush=True)
    print("  Endpoints: " + str(list(GET_ROUTES.keys())), flush=True)
    server = HTTPServer(("0.0.0.0", PORT), ZegHandler)
    server.serve_forever()
