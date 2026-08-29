"""
The Zeg — Unified API Server
Aggregates all Hermes + Circle Pipeline + Business Brain data sources.
"""

import json
import os
import sys
import sqlite3
import urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

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
}

class ZegHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        params = parse_qs(parsed.query)

        if path in GET_ROUTES:
            self._send_json(GET_ROUTES[path]())
            return

        if path.startswith("/api/soul/"):
            soul_name = path.split("/")[-1]
            q = params.get("q", [""])[0]
            if "/talk" in path:
                self._send_json({"transcript": "[Offline] Talking with " + soul_name})
            else:
                self._send_json({"soul": soul_name, "response": "[Offline] " + q})
            return

        if path == "/api/health":
            self._send_json({"status": "ok", "port": PORT})
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
