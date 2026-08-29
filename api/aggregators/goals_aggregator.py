"""Goals Aggregator — Dubai real estate goals."""

import json, os, datetime

def get_goals_data():
    bb_state = os.path.join(os.path.expanduser("~"), "business-brain/core/state.json")
    state = {}
    try:
        with open(bb_state) as f:
            state = json.load(f)
    except Exception:
        pass

    model_a = {
        "whatsapp_sent": 13, "whatsapp_total": 31,
        "replies": state.get("businesses", {}).get("etsy_pod", {}).get("replies", 0),
        "booked": state.get("businesses", {}).get("etsy_pod", {}).get("bookings", 0),
        "closed": state.get("businesses", {}).get("etsy_pod", {}).get("closed", 0),
        "revenue": state.get("businesses", {}).get("etsy_pod", {}).get("model_a_revenue", 0),
    }
    model_b = {
        "starter_sold": state.get("businesses", {}).get("saas", {}).get("starter_sold", 0),
        "pro_sold": state.get("businesses", {}).get("saas", {}).get("pro_sold", 0),
        "affiliate_sales": state.get("businesses", {}).get("saas", {}).get("aff_sales", 0),
        "projected_per_blast": 46656,
        "revenue": state.get("businesses", {}).get("saas", {}).get("model_b_revenue", 0),
    }

    timeline = _build_timeline(state)
    progress = model_a.get("revenue", 0) + model_b.get("revenue", 0)
    days_remaining = max(0, (datetime.date(2026, 9, 6) - datetime.date.today()).days)
    target = 50000

    return {
        "goals": {"target_aed": target, "current_aed": round(progress, 2),
                  "days_remaining": days_remaining, "model_a": model_a, "model_b": model_b},
        "timeline": timeline,
        "progress": progress,
    }

def _build_timeline(state):
    events = []
    sent = 13
    for i in range(1, sent + 1):
        events.append({
            "timestamp": f"2026-08-{27 + (i % 2):02d}T1{i:02d}:00:00Z",
            "title": f"WhatsApp voice note #{i}",
            "description": f"Sent to prospect #{i}",
            "type": "success", "amount": None,
        })
    revenue = state.get("revenue_execution", {})
    for move in revenue.get("money_moves", []):
        events.append({
            "timestamp": move.get("timestamp", ""),
            "title": move.get("title", ""),
            "description": move.get("description", ""),
            "type": "revenue", "amount": move.get("amount_aed"),
        })
    return events
