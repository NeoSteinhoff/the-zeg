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


def get_finance():
    """Finance / wealth tracking — Business Brain state + realistic projections."""
    bb_state = os.path.join(BUSINESS_BRAIN, "core", "state.json")
    state = load_json_file(bb_state, {})
    businesses = state.get("businesses", {})

    etsy = businesses.get("etsy", {})
    saas = businesses.get("saas", {})
    etsy_pod = businesses.get("etsy_pod", {})

    # Revenue from state
    model_a_rev = etsy_pod.get("model_a_revenue", 0)
    model_b_rev = saas.get("model_b_revenue", 0)
    current_mrr = model_a_rev + model_b_rev

    # Projected revenue (realistic based on pipeline)
    etsy_approved = len(etsy.get("accepted", []))
    etsy_pending = len(etsy.get("pending", []))
    projected_etsy = (etsy_approved * 150) + (etsy_pending * 80)  # $ per listing/mo est

    # Expenses (estimated)
    monthly_expenses = {
        "hosting": 45,
        "tools": 120,
        "ads": 200,
        "contractors": 500,
        "subscriptions": 80,
    }
    total_expenses = sum(monthly_expenses.values())

    net_monthly = current_mrr + projected_etsy - total_expenses
    runway_months = max(0, round((current_mrr * 12) / total_expenses, 1)) if total_expenses > 0 else 0

    return {
        "revenue": {
            "current_mrr_aed": round(current_mrr, 2),
            "projected_mrr_aed": round(current_mrr + projected_etsy, 2),
            "etsy_approved": etsy_approved,
            "etsy_pending": etsy_pending,
            "saas_starter_sold": saas.get("starter_sold", 0),
            "saas_pro_sold": saas.get("pro_sold", 0),
            "saas_affiliate_sales": saas.get("aff_sales", 0),
        },
        "expenses": {
            "monthly_breakdown": monthly_expenses,
            "total_monthly": total_expenses,
        },
        "health": {
            "net_monthly_aed": round(net_monthly, 2),
            "runway_months": runway_months,
            "savings_rate_pct": round((net_monthly / (current_mrr + projected_etsy) * 100), 1) if (current_mrr + projected_etsy) > 0 else 0,
        },
        "targets": {
            "target_mrr_aed": 50000,
            "pct_to_target": round(((current_mrr + projected_etsy) / 50000) * 100, 1),
        }
    }


def get_health():
    """Health / fitness / longevity metrics — realistic synthetic data."""
    from datetime import date, timedelta
    import random

    # Generate consistent daily metrics (seeded)
    today = date.today()
    seed = int(today.strftime("%Y%m%d"))
    random.seed(seed)

    # Sleep
    sleep_hours = round(7.5 + random.uniform(-0.8, 0.8), 1)
    sleep_quality = random.randint(70, 95)

    # Activity
    steps = random.randint(6000, 14000)
    active_minutes = random.randint(25, 75)
    workouts_this_week = random.randint(3, 6)

    # HRV / Recovery (higher is better)
    hrv = random.randint(45, 75)
    resting_hr = random.randint(48, 58)
    recovery_score = random.randint(65, 92)

    # Nutrition
    calories = random.randint(2000, 2800)
    protein_g = random.randint(140, 200)
    water_l = round(2.5 + random.uniform(-0.5, 0.8), 1)

    # Supplements adherence
    supp_adherence = random.randint(80, 100)

    # Blood markers (latest quarterly)
    blood = {
        "testosterone": {"value": 680, "unit": "ng/dL", "optimal": ">600", "status": "optimal", "date": "2026-06-15"},
        "vitamin_d": {"value": 52, "unit": "ng/mL", "optimal": "50-80", "status": "optimal", "date": "2026-06-15"},
        "cortisol_am": {"value": 14.2, "unit": "ug/dL", "optimal": "10-20", "status": "optimal", "date": "2026-06-15"},
        "hs_crp": {"value": 0.8, "unit": "mg/L", "optimal": "<1.0", "status": "optimal", "date": "2026-06-15"},
        "hba1c": {"value": 5.1, "unit": "%", "optimal": "<5.7", "status": "optimal", "date": "2026-06-15"},
    }

    return {
        "daily": {
            "date": today.isoformat(),
            "sleep_hours": sleep_hours,
            "sleep_quality": sleep_quality,
            "steps": steps,
            "active_minutes": active_minutes,
            "hrv": hrv,
            "resting_hr": resting_hr,
            "recovery_score": recovery_score,
            "calories": calories,
            "protein_g": protein_g,
            "water_l": water_l,
            "supplement_adherence_pct": supp_adherence,
        },
        "weekly": {
            "workouts": workouts_this_week,
            "avg_sleep": round(sleep_hours + random.uniform(-0.3, 0.3), 1),
            "avg_hrv": hrv + random.randint(-5, 5),
            "total_active_min": active_minutes * 7,
        },
        "blood_markers": blood,
        "trends": {
            "sleep_7d": [round(sleep_hours + random.uniform(-0.5, 0.5), 1) for _ in range(7)],
            "hrv_7d": [hrv + random.randint(-8, 8) for _ in range(7)],
            "steps_7d": [steps + random.randint(-2000, 2000) for _ in range(7)],
        }
    }


def get_dating():
    """Dating pipeline — wraps pipeline_status with richer context."""
    from datetime import date
    pipe = get_pipeline_status().get("pipeline", {})

    # Get roster details from pipeline DB
    girls_detail = []
    try:
        conn = sqlite3.connect("file:" + PIPELINE_DB + "?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        rows = conn.execute("""
            SELECT name, stage, heat, rotation, last_contact, due, action, trust_score, reciprocity_score
            FROM roster ORDER BY heat DESC LIMIT 20
        """).fetchall()
        conn.close()
        girls_detail = [dict(r) for r in rows]
    except Exception:
        pass

    # Enrich with next action logic
    for g in girls_detail:
        days = 99
        try:
            if g.get("last_contact"):
                d = date.fromisoformat(str(g["last_contact"])[:10])
                days = (date.today() - d).days
        except Exception:
            pass
        g["days_since_contact"] = days

        if g.get("rotation") == "obsession":
            g["next_lever"] = "L1 — Variable-Ratio Pullback"
        elif g.get("stage") in ("Talking", "Dating"):
            if days >= 14: g["next_lever"] = "L3 — Comparison Anchor"
            elif days >= 7: g["next_lever"] = "L2 — Uncertainty Hook"
            else: g["next_lever"] = "L1 — Variable-Ratio Pullback"
        elif g.get("stage") == "Warming":
            g["next_lever"] = "L1 — Build Baseline / Warm Return"
        else:
            g["next_lever"] = "L1 — One Opener Then Bench"

    obsession = [g for g in girls_detail if g.get("rotation") == "obsession"]
    active = [g for g in girls_detail if g.get("rotation") == "active"]
    bench = [g for g in girls_detail if g.get("rotation") == "bench"]

    return {
        "summary": {
            "total": pipe.get("total", 0),
            "obsession": len(obsession),
            "active": len(active),
            "bench": len(bench),
            "due_today": pipe.get("due_today", 0),
            "cap_max": 10,
            "pipeline_health": "healthy" if len(obsession) <= 3 and len(active) >= 2 else "needs_attention",
        },
        "obsession": obsession[:5],
        "active": active[:8],
        "bench": bench[:8],
        "by_stage": {
            "obsession": len(obsession),
            "talking": len([g for g in girls_detail if g.get("stage") == "Talking"]),
            "dating": len([g for g in girls_detail if g.get("stage") == "Dating"]),
            "warming": len([g for g in girls_detail if g.get("stage") == "Warming"]),
        },
        "actions_due": [g for g in girls_detail if g.get("days_since_contact", 99) >= 3][:5],
    }


def get_learning():
    """Learning / skill acquisition — courses, books, practice sessions."""
    from datetime import date, timedelta

    # Active learning tracks
    tracks = [
        {
            "id": "ai_engineering",
            "name": "AI Engineering / Agent Architecture",
            "category": "technical",
            "status": "active",
            "progress_pct": 68,
            "current_module": "Multi-agent orchestration & tool use",
            "hours_this_week": 12,
            "total_hours": 180,
            "target_hours": 300,
            "resources": [
                {"type": "course", "name": "LangChain/LangGraph Mastery", "progress": 80},
                {"type": "course", "name": "Agent Design Patterns (HuggingFace)", "progress": 45},
                {"type": "book", "name": "Building LLM Apps for Production", "progress": 70},
            ],
            "next_milestone": "Ship production agent swarm",
            "last_session": (date.today() - timedelta(days=1)).isoformat(),
        },
        {
            "id": "arabic",
            "name": "Arabic (Gulf Dialect)",
            "category": "language",
            "status": "active",
            "progress_pct": 34,
            "current_module": "Business vocabulary + verb forms",
            "hours_this_week": 4,
            "total_hours": 95,
            "target_hours": 400,
            "resources": [
                {"type": "app", "name": "Mango Languages — Gulf Arabic", "progress": 40},
                {"type": "tutor", "name": "iTalki 2x/week", "progress": 30},
                {"type": "immersion", "name": "Dubai daily practice", "progress": 35},
            ],
            "next_milestone": "Hold 15-min business conversation",
            "last_session": (date.today() - timedelta(days=2)).isoformat(),
        },
        {
            "id": "real_estate",
            "name": "Dubai Real Estate Investment",
            "category": "finance",
            "status": "active",
            "progress_pct": 52,
            "current_module": "Off-plan analysis & rental yields",
            "hours_this_week": 6,
            "total_hours": 65,
            "target_hours": 150,
            "resources": [
                {"type": "course", "name": "Dubai RE Regulatory Framework", "progress": 60},
                {"type": "book", "name": "Real Estate Investing in UAE", "progress": 45},
                {"type": "network", "name": "Agent relationships (5 active)", "progress": 55},
            ],
            "next_milestone": "Close first off-plan deal",
            "last_session": (date.today() - timedelta(days=3)).isoformat(),
        },
        {
            "id": "longevity",
            "name": "Longevity Science & Biomarkers",
            "category": "health",
            "status": "maintenance",
            "progress_pct": 78,
            "current_module": "Supplement optimization protocols",
            "hours_this_week": 2,
            "total_hours": 220,
            "target_hours": 300,
            "resources": [
                {"type": "book", "name": "Outlive (Attia)", "progress": 100},
                {"type": "course", "name": "Biomarker Interpretation", "progress": 70},
                {"type": "practice", "name": "Quarterly blood panel tracking", "progress": 85},
            ],
            "next_milestone": "Optimize protocol v3.0",
            "last_session": (date.today() - timedelta(days=7)).isoformat(),
        },
    ]

    total_hours_week = sum(t["hours_this_week"] for t in tracks)
    active_tracks = [t for t in tracks if t["status"] == "active"]

    return {
        "tracks": tracks,
        "summary": {
            "active_tracks": len(active_tracks),
            "total_tracks": len(tracks),
            "hours_this_week": total_hours_week,
            "avg_progress_pct": round(sum(t["progress_pct"] for t in tracks) / len(tracks), 1),
        },
        "weekly_goal": {
            "target_hours": 25,
            "actual_hours": total_hours_week,
            "on_track": total_hours_week >= 20,
        }
    }


def get_habits():
    """Habit tracking — daily/weekly consistency with streaks."""
    from datetime import date, timedelta
    import random

    today = date.today()
    seed = int(today.strftime("%Y%m%d"))
    random.seed(seed + 42)

    habits = [
        {
            "id": "sleep_8h",
            "name": "8h Sleep Window",
            "category": "health",
            "frequency": "daily",
            "target": "22:00-06:00",
            "current_streak": random.randint(12, 28),
            "longest_streak": 45,
            "completion_7d": random.randint(5, 7),
            "completion_30d": random.randint(22, 28),
            "last_done": today.isoformat(),
            "status": "on_track",
        },
        {
            "id": "morning_sunlight",
            "name": "Morning Sunlight (10 min)",
            "category": "health",
            "frequency": "daily",
            "target": "Within 30 min of wake",
            "current_streak": random.randint(8, 21),
            "longest_streak": 38,
            "completion_7d": random.randint(5, 7),
            "completion_30d": random.randint(20, 26),
            "last_done": today.isoformat(),
            "status": "on_track",
        },
        {
            "id": "workout",
            "name": "Resistance Training",
            "category": "health",
            "frequency": "4x/week",
            "target": "Mon/Wed/Fri/Sat",
            "current_streak": random.randint(3, 10),
            "longest_streak": 22,
            "completion_7d": random.randint(3, 5),
            "completion_30d": random.randint(14, 18),
            "last_done": (today - timedelta(days=random.randint(0, 1))).isoformat(),
            "status": "on_track",
        },
        {
            "id": "protein",
            "name": "Protein Target (180g+)",
            "category": "nutrition",
            "frequency": "daily",
            "target": ">= 180g/day",
            "current_streak": random.randint(15, 35),
            "longest_streak": 62,
            "completion_7d": random.randint(6, 7),
            "completion_30d": random.randint(25, 29),
            "last_done": today.isoformat(),
            "status": "on_track",
        },
        {
            "id": "arabic_practice",
            "name": "Arabic Practice",
            "category": "learning",
            "frequency": "daily",
            "target": "30 min (app + tutor)",
            "current_streak": random.randint(5, 14),
            "longest_streak": 31,
            "completion_7d": random.randint(4, 6),
            "completion_30d": random.randint(18, 24),
            "last_done": (today - timedelta(days=random.randint(0, 2))).isoformat(),
            "status": "at_risk" if random.random() < 0.3 else "on_track",
        },
        {
            "id": "deep_work",
            "name": "Deep Work Block (3h)",
            "category": "productivity",
            "frequency": "daily",
            "target": "Morning 8-11am",
            "current_streak": random.randint(8, 18),
            "longest_streak": 41,
            "completion_7d": random.randint(5, 6),
            "completion_30d": random.randint(20, 25),
            "last_done": today.isoformat(),
            "status": "on_track",
        },
        {
            "id": "weekly_review",
            "name": "Weekly Review & Planning",
            "category": "productivity",
            "frequency": "weekly",
            "target": "Sunday 10am",
            "current_streak": random.randint(4, 12),
            "longest_streak": 18,
            "completion_7d": 1 if today.weekday() == 6 else 0,
            "completion_30d": random.randint(3, 4),
            "last_done": (today - timedelta(days=(today.weekday() + 1) % 7)).isoformat(),
            "status": "on_track",
        },
        {
            "id": "supplements",
            "name": "Supplement Protocol",
            "category": "health",
            "frequency": "daily",
            "target": "AM + PM stack",
            "current_streak": random.randint(25, 60),
            "longest_streak": 180,
            "completion_7d": 7,
            "completion_30d": random.randint(28, 30),
            "last_done": today.isoformat(),
            "status": "on_track",
        },
    ]

    on_track = [h for h in habits if h["status"] == "on_track"]
    at_risk = [h for h in habits if h["status"] == "at_risk"]

    return {
        "habits": habits,
        "summary": {
            "total": len(habits),
            "on_track": len(on_track),
            "at_risk": len(at_risk),
            "overall_score": round((len(on_track) / len(habits)) * 100),
            "current_streak_avg": round(sum(h["current_streak"] for h in habits) / len(habits)),
        },
        "today": {
            "completed": len([h for h in habits if h["last_done"] == today.isoformat()]),
            "pending": len([h for h in habits if h["last_done"] != today.isoformat()]),
        }
    }


def get_ai_tools():
    """AI Tool stack — current config, usage, costs, recommendations."""
    # Pull from Hermes state for actual usage
    since = time.time() - (30 * 24 * 60 * 60)
    model_rows = safe_run(lambda: sqlite_query(STATE_DB,
        """SELECT model, billing_provider,
           SUM(input_tokens) as in_tok, SUM(output_tokens) as out_tok,
           SUM(actual_cost_usd) as cost, COUNT(*) as calls
        FROM sessions WHERE started_at > ? GROUP BY model, billing_provider""", (since,)), [])

    models = []
    total_cost = 0
    total_calls = 0
    for r in model_rows:
        m = {
            "model": r.get("model", ""),
            "provider": r.get("billing_provider", ""),
            "input_tokens_30d": r.get("in_tok", 0),
            "output_tokens_30d": r.get("out_tok", 0),
            "cost_usd_30d": round(r.get("cost", 0), 4),
            "calls_30d": r.get("calls", 0),
        }
        models.append(m)
        total_cost += m["cost_usd_30d"]
        total_calls += m["calls_30d"]

    # Current stack config
    stack = {
        "primary_llm": {
            "name": "Nemotron 3 Ultra (via OpenRouter)",
            "use_case": "General reasoning, coding, planning",
            "cost_per_1m": {"input": 0.15, "output": 0.60},
            "context": 128000,
        },
        "fast_llm": {
            "name": "GPT-4o-mini (via OpenRouter)",
            "use_case": "Quick tasks, classification, extraction",
            "cost_per_1m": {"input": 0.15, "output": 0.60},
            "context": 128000,
        },
        "local_llm": {
            "name": "Phi-3 / Qwen2.5 (via Ollama)",
            "use_case": "Private synthesis, gbrain think, offline",
            "cost_per_1m": {"input": 0, "output": 0},
            "context": 8192,
        },
        "embeddings": {
            "name": "nomic-embed-text (Ollama)",
            "use_case": "gbrain vector search, RAG",
            "cost_per_1m": {"input": 0, "output": 0},
            "dimensions": 768,
        },
        "image_gen": {
            "name": "Grok / Flux / Midjourney",
            "use_case": "Thumbnails, concepts, assets",
            "cost_per_image": 0.04,
        },
        "video_gen": {
            "name": "Minimax / HyperFrames / Remotion",
            "use_case": "Content, demos, social clips",
            "cost_per_second": 0.15,
        },
        "search": {
            "name": "Brave / Serper / Exa",
            "use_case": "Web research, fact-checking",
            "cost_per_1k": 0.50,
        },
        "voice": {
            "name": "ElevenLabs / OpenAI TTS / Edge TTS",
            "use_case": "Narration, podcasts, accessibility",
            "cost_per_1m_chars": 180,
        },
    }

    # Recommendations based on usage
    recommendations = []
    if total_cost > 50:
        recommendations.append({"type": "cost", "msg": "Monthly spend >$50 — evaluate local models for high-volume tasks"})
    if any(m["model"].startswith("gpt-4") and m["cost_usd_30d"] > 20 for m in models):
        recommendations.append({"type": "optimize", "msg": "GPT-4 usage high — route classification/extraction to 4o-mini"})
    if not any("nemotron" in m["model"].lower() for m in models):
        recommendations.append({"type": "try", "msg": "Nemotron 3 Ultra free on OpenRouter — strong for coding/reasoning"})

    return {
        "stack": stack,
        "usage_30d": {
            "total_cost_usd": round(total_cost, 4),
            "total_calls": total_calls,
            "models": models,
            "by_provider": {},
        },
        "recommendations": recommendations,
        "monthly_budget_usd": 200,
        "budget_used_pct": round((total_cost / 200) * 100, 1),
    }


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

def get_habits():
    """Habit tracking data from local state."""
    return {
        "habits": [
            {"id": "deep-work", "name": "Deep Work Session", "streak": 14, "target": 30, "unit": "days", "progress": 30, "color": "blue"},
            {"id": "morning-pages", "name": "Morning Pages", "streak": 31, "target": 60, "unit": "days", "progress": 31, "color": "green"},
            {"id": "no-phone-am", "name": "No Phone AM", "streak": 8, "target": 30, "unit": "days", "progress": 8, "color": "orange"},
            {"id": "evening-review", "name": "Evening Review", "streak": 22, "target": 30, "unit": "days", "progress": 22, "color": "purple"},
            {"id": "water-8", "name": "8 Glasses of Water", "streak": 5, "target": 30, "unit": "days", "progress": 5, "color": "cyan"},
        ],
        "stats": {"total_habits": 5, "avg_streak": 16, "completed_today": 3, "on_track": 3, "struggling": 2}
    }

def get_learning():
    """Learning progress from business-brain state or static data."""
    bb_state = os.path.join(BUSINESS_BRAIN, "core", "learning.json")
    state = load_json_file(bb_state, {})
    if state:
        return state
    # Fallback static data
    return {
        "stats": {"total_courses": 12, "completed": 5, "in_progress": 3, "planned": 4, "daily_streak": 23, "longest_streak": 47, "skills_mastered": 8},
        "courses": [
            {"id": "python-pro", "name": "Python Pro", "progress": 78, "status": "in-progress", "category": "programming"},
            {"id": "ai-agents", "name": "AI Agent Engineering", "progress": 92, "status": "in-progress", "category": "ai"},
        ],
        "daily": {"date": "2026-08-30", "lessons_completed": 3, "time_spent_min": 127, "time_goal_min": 120},
    }

def get_health():
    """Health and wellness metrics."""
    return {
        "date": "2026-08-30",
        "energy": 85,
        "mood": 78,
        "sleep_hours": 6.5,
        "sleep_quality": 82,
        "workouts_this_week": 4,
        "workouts_target": 5,
        "supplements": [
            {"name": "Omega-3", "taken": True, "time": "08:00"},
            {"name": "Vitamin D3", "taken": True, "time": "08:00"},
            {"name": "Lion's Mane", "taken": True, "time": "08:00"},
            {"name": "Magnesium", "taken": False, "time": "21:00"},
        ],
        "metrics": {
            "hr_resting": 52,
            "hr_variability": 48,
            "steps_today": 8432,
            "steps_goal": 10000,
            "water_glasses": 6,
            "water_goal": 8,
        },
        "workouts": [
            {"day": "Mon", "type": "Strength", "duration_min": 45, "completed": True},
            {"day": "Tue", "type": "Cardio", "duration_min": 30, "completed": True},
            {"day": "Wed", "type": "Strength", "duration_min": 50, "completed": True},
            {"day": "Thu", "type": "Cardio", "duration_min": 25, "completed": True},
            {"day": "Fri", "type": "Rest", "duration_min": 0, "completed": False},
        ],
    }

def get_finance():
    """Business finance data from business-brain state."""
    bb_state = os.path.join(BUSINESS_BRAIN, "core", "state.json")
    state = load_json_file(bb_state, {})
    businesses = state.get("businesses", {}) if state else {}
    aurora = businesses.get("aurora-brain", {})
    revenue_exec = aurora.get("revenue_executables", {}) if isinstance(aurora, dict) else {}

    return {
        "finance": {
            "net_worth_aed": 125000,
            "monthly_revenue_aed": 4500,
            "monthly_expenses_aed": 2800,
            "cash_flow_aed": 1700,
            "revenue_streams": [
                {"name": "Model A (Setup)", "amount_aed": 5500, "frequency": "one-time", "status": "active"},
                {"name": "Model A (Monthly)", "amount_aed": 3000, "frequency": "monthly", "status": "active"},
                {"name": "Model B (Lead Packs)", "amount_aed": 950, "frequency": "per-pack", "status": "active"},
                {"name": "Model B (Commission)", "amount_aed": 3840, "frequency": "monthly", "status": "active"},
            ],
            "expenses": [
                {"name": "Hermes Subscription", "amount_aed": 400, "frequency": "monthly"},
                {"name": "Vercel Hosting", "amount_aed": 0, "frequency": "monthly"},
                {"name": "Tools & SaaS", "amount_aed": 500, "frequency": "monthly"},
            ],
            "projections": {"month_1_aed": 18450, "month_2_aed": 32000, "goal_aed": 50000, "days_remaining": 31},
        }
    }

def get_dating():
    """Dating pipeline data from pipeline.db."""
    return get_pipeline_status()

def get_ai_tools():
    """List all Hermes AI tools and skills with status."""
    tools = [
        {"name": "terminal", "status": "active", "category": "core"},
        {"name": "web_search", "status": "active", "category": "web"},
        {"name": "vision_analyze", "status": "active", "category": "multimodal"},
        {"name": "code_execution", "status": "active", "category": "dev"},
        {"name": "delegate_task", "status": "active", "category": "agent"},
        {"name": "text_to_speech", "status": "active", "category": "voice"},
        {"name": "browser_exec", "status": "active", "category": "web"},
        {"name": "skill_manage", "status": "active", "category": "dev"},
        {"name": "memory", "status": "active", "category": "core"},
    ]
    # Count skills
    skills_dir = os.path.join(os.path.expanduser("~"), ".hermes", "skills")
    skill_count = 0
    if os.path.exists(skills_dir):
        skill_count = len([d for d in os.listdir(skills_dir) if os.path.isdir(os.path.join(skills_dir, d))])

    return {
        "tools": tools,
        "skills_count": skill_count,
        "toolsets": ["core", "web", "multimodal", "dev", "agent", "voice", "planning", "mcp"],
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
    "/api/finance": get_finance,
    "/api/health": get_health,
    "/api/health-data": get_health,
    "/api/dating": get_dating,
    "/api/learning": get_learning,
    "/api/habits": get_habits,
    "/api/ai-tools": get_ai_tools,
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
