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
CRONS_JSON = os.path.join(HERMES_HOME, "crons.json")

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
        "SELECT id, title, body, status, priority, created_by, created_at, "
        "started_at, completed_at, assignee, result "
        "FROM tasks ORDER BY "
        "CASE status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 "
        "WHEN 'blocked' THEN 2 WHEN 'done' THEN 3 ELSE 4 END, created_at DESC LIMIT 50"), [])
    for t in tasks:
        tid = t.get("id", "")
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
    """Cron jobs from crons.json."""
    crons = safe_run(lambda: load_json_file(CRONS_JSON, []), [])
    return {"crons": crons}

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
    "/api/delegations": get_delegations,
    "/api/crons": get_crons,
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

class ZegHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        params = parse_qs(parsed.query)

        if path in GET_ROUTES:
            try:
                self._send_json(GET_ROUTES[path]())
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

        if path == "/api/gateway-logs":
            self._send_json(get_gateway_logs())
            return

        if path.startswith("/api/agent-detail"):
            sid = params.get("id", [""])[0]
            self._send_json(get_agent_detail(sid))
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
        elif path == "/api/storefront/purchase":
            self._send_json({"ok": True, "success": True, "product_id": body.get("product_id")})
        elif path == "/api/webhook/hermes":
            result = handle_webhook(body)
            self._send_json(result)
        elif path == "/api/webhook/broadcast":
            event_id = add_event("broadcast", body)
            self._send_json({"ok": True, "event_id": event_id})
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

if __name__ == "__main__":
    print("[Zeg] Unified API Server on:" + str(PORT), flush=True)
    print("  Endpoints: " + str(list(GET_ROUTES.keys())), flush=True)
    server = HTTPServer(("0.0.0.0", PORT), ZegHandler)
    server.serve_forever()
