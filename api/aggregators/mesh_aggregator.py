"""
Mesh CRM Aggregator
Friendship circles with trust, reciprocity, and cadence metrics.
Reads from friendships DB or roster with friendship context_type column.
Falls back to static data when no friendship DB exists.
"""

import json
import os
import sqlite3
import datetime

ROSTER_DB = os.path.join(os.path.expanduser("~"),
    "Documents/Steinhoff Systems/steinvault/leads/roster-db/roster.sqlite")
FRIENDSHIPS_DB = os.path.join(os.path.expanduser("~"),
    "Documents/Steinhoff Systems/steinvault/06-operations/dating-pipeline/friendships.db")

CIRCLE_ORDER = ["inner", "close", "locked_in", "high_value", "guys", "medium", "acquaintance", "romantic"]

CIRCLE_COLORS = {
    "inner": "#ff4d5e", "close": "#ffb020", "locked_in": "#3fd07f",
    "high_value": "#a371ff", "guys": "#4ea8ff", "medium": "#5b6473",
    "acquaintance": "#3a3a3a", "romantic": "#ff4d5e",
}

def _conn(db_path):
    conn = sqlite3.connect("file:" + db_path + "?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn

def get_mesh_data():
    """Get all people organized by friendship circles."""
    # Try friendships DB first
    people = _try_friendships_db()

    if not people:
        # Try roster with friendship context_type
        people = _try_roster_friendships()

    if not people:
        people = []

    return _build_response(people)

def _try_friendships_db():
    """Try reading from a dedicated friendships database."""
    try:
        conn = _conn(FRIENDSHIPS_DB)
        cols = [r[1] for r in conn.execute("PRAGMA table_info(people)").fetchall()]

        if "trust_score" in cols and "circle_type" in cols:
            rows = conn.execute("""
                SELECT name, trust_score, reciprocity_score, days_since_contact,
                       circle_type, context_type, stage, heat, due, last_contact
                FROM people
                ORDER BY trust_score DESC, reciprocity_score DESC
            """).fetchall()
            conn.close()
            return [dict(r) for r in rows]
        conn.close()
    except Exception:
        pass
    return None

def _try_roster_friendships():
    """Try reading friendship people from the roster DB if it has friendship columns."""
    try:
        conn = _conn(ROSTER_DB)
        cols = [r[1] for r in conn.execute("PRAGMA table_info(roster)").fetchall()]

        # Check if friendship columns exist
        if "trust_score" in cols and "circle_type" in cols:
            rows = conn.execute("""
                SELECT name, trust_score, reciprocity_score, days_since_contact,
                       circle_type, context_type, stage, heat, due, last_contact
                FROM roster
                WHERE context_type = 'friendship'
                ORDER BY trust_score DESC
            """).fetchall()
            conn.close()
            return [dict(r) for r in rows]
        conn.close()
    except Exception:
        pass
    return None

def _build_response(people):
    circles_present = set(p.get("circle_type", "acquaintance") for p in people)
    due_today = [p for p in people if _is_due(p.get("due"))]
    overdue = [p for p in people if _is_overdue(p.get("due"))]
    low_recip = [p for p in people if (p.get("reciprocity_score") or 100) < 40]

    due_actions = []
    for p in due_today:
        lever_code, _ = _friendship_lever(p)
        due_actions.append({
            "id": p.get("id", 0),
            "name": p.get("name", ""),
            "circle_type": p.get("circle_type", ""),
            "circle_color": CIRCLE_COLORS.get(p.get("circle_type", ""), "#5b6473"),
            "trust_score": p.get("trust_score", 0),
            "reciprocity_score": p.get("reciprocity_score", 0),
            "days_overdue": p.get("days_since_contact", 0),
            "lever_code": lever_code,
            "action": _next_action(p),
        })

    return {
        "stats": {
            "total_people": len(people),
            "circles": len(circles_present),
            "due": len(due_today),
            "overdue": len(overdue),
            "low_reciprocity": len(low_recip),
        },
        "people": people,
        "due": due_actions,
    }

def _is_due(due_date):
    if not due_date: return False
    try:
        d = datetime.date.fromisoformat(str(due_date)[:10])
        return d <= datetime.date.today()
    except Exception:
        return False

def _is_overdue(due_date):
    if not due_date: return False
    try:
        d = datetime.date.fromisoformat(str(due_date)[:10])
        return d < datetime.date.today()
    except Exception:
        return False

def _friendship_lever(person):
    days = person.get("days_since_contact", 99)
    trust = person.get("trust_score", 50)
    recip = person.get("reciprocity_score", 50)
    if recip < 30: return "L2", "Reciprocity Check"
    if trust < 40: return "L1", "Trust Maintenance"
    if days > 30: return "L1", "Check In"
    return "L3", "Circle Upgrade"

def _next_action(person):
    recip = person.get("reciprocity_score", 50)
    days = person.get("days_since_contact", 99)
    if recip < 30: return "Match their energy"
    if days > 30: return "Send a message"
    return "Initiate contact"
