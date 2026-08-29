"""Circle Pipeline Aggregator — reads from pipeline API or local SQLite."""

import json
import os
import sqlite3
import datetime
import urllib.request

ROSTER_DB = os.path.join(os.path.expanduser("~"),
    "Documents/Steinhoff Systems/steinvault/leads/roster-db/roster.sqlite")
PIPELINE_API = "http://localhost:8822"

def get_pipeline_data():
    """Main entry: try API first, then local DB, then JSON."""
    try:
        req = urllib.request.Request(PIPELINE_API + "/api/stats")
        with urllib.request.urlopen(req, timeout=5) as resp:
            stats_data = json.loads(resp.read().decode())
        req2 = urllib.request.Request(PIPELINE_API + "/api/roster")
        with urllib.request.urlopen(req2, timeout=5) as resp:
            roster_data = json.loads(resp.read().decode())
        req3 = urllib.request.Request(PIPELINE_API + "/api/lever")
        with urllib.request.urlopen(req3, timeout=5) as resp:
            levers = json.loads(resp.read().decode())
        return {"stats": stats_data, "girls": roster_data, "levers": levers}
    except Exception:
        pass

    try:
        conn = sqlite3.connect("file:" + ROSTER_DB + "?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        rows = conn.execute("""
            SELECT id, name, stage, heat, rotation, last_contact,
                   due, next_due, action, created_at
            FROM roster ORDER BY heat DESC
        """).fetchall()
        conn.close()
        girls = [dict(r) for r in rows]

        stats = {
            "obsession": len([g for g in girls if g.get("rotation") == "obsession"]),
            "active": len([g for g in girls if g.get("rotation") == "active"]),
            "bench": len([g for g in girls if g.get("rotation") == "bench"]),
            "total": len(girls),
            "due_today": len([g for g in girls if g.get("due") and _is_today(g.get("due"))]),
            "cap_max": 10,
        }

        levers = []
        for g in girls:
            if g.get("rotation") == "obsession":
                lever, desc = "L1", "Variable-Ratio Pullback"
            else:
                lever, desc = _lever_for(g)
            levers.append({"girl": g.get("name"), "lever": lever, "reason": desc})

        return {"stats": stats, "girls": girls, "levers": levers}
    except Exception:
        pass

    return {"stats": {"obsession": 0, "active": 0, "bench": 0, "total": 0, "due_today": 0, "cap_max": 10}, "girls": [], "levers": []}

def _is_today(date_str):
    try:
        d = datetime.date.fromisoformat(str(date_str)[:10])
        return d <= datetime.date.today()
    except Exception:
        return False

def _lever_for(person):
    stage = (person.get("stage") or "").lower()
    rotation = (person.get("rotation") or "").lower()
    days = _days_since(person.get("last_contact"))
    if rotation == "obsession":
        return "L1", "Variable-Ratio Pullback"
    if stage in ("talking", "dating"):
        if days >= 14: return "L3", "Comparison Anchor"
        if days >= 7: return "L2", "Uncertainty Hook"
        return "L1", "Variable-Ratio Pullback"
    if stage == "warming":
        if days >= 4: return "L1", "Variable-Ratio Pullback (warm return)"
        return "L1", "Build baseline"
    return None, "Cold — one opener, then Bench"

def _days_since(date_str):
    try:
        d = datetime.date.fromisoformat(str(date_str)[:10])
        return (datetime.date.today() - d).days
    except Exception:
        return 99
