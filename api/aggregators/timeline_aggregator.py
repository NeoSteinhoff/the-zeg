"""Timeline Aggregator — combined activity feed."""

import json, os, datetime, urllib.request

def get_timeline_data():
    events = []
    try:
        req = urllib.request.Request("http://localhost:9120/api/sessions")
        with urllib.request.urlopen(req, timeout=5) as resp:
            sessions = json.loads(resp.read().decode())
        for s in sessions[:20]:
            events.append({
                "timestamp": s.get("started_at", ""),
                "title": f"Session: {s.get('title', 'Untitled')[:40]}",
                "description": f"Model: {s.get('model','?')} · {s.get('message_count',0)} msgs",
                "type": "session", "amount": None,
            })
    except Exception:
        pass

    from goals_aggregator import get_goals_data
    try:
        goal_data = get_goals_data()
        for event in goal_data.get("timeline", []):
            events.append(event)
        goals_data = [{"id": 1, "title": f"Target AED {goal_data['goals']['target_aed']}", "done": False}]
        total_aed = goal_data.get("progress", 0)
        goal_aed = goal_data["goals"]["target_aed"]
    except Exception:
        goals_data = []
        total_aed = 0
        goal_aed = 50000

    events.sort(key=lambda e: e.get("timestamp", ""), reverse=True)
    return {"events": events, "goals": goals_data, "total_aed": total_aed, "goal_aed": goal_aed}
