"""Storefront Aggregator — Lead packs for sale."""

import json, os

SOUL_DIR = os.path.join(os.path.expanduser("~"),
    "Documents/Steinhoff Systems/steinvault/leads/agent-storefront")

def get_storefront_data():
    products = [
        {"id": "starter", "name": "Starter Pack", "price": 950,
         "description": "3,200 verified Dubai real estate leads",
         "lead_count": 3200, "commission": 0.12, "sold": 0},
        {"id": "pro", "name": "Pro Pack", "price": 3200,
         "description": "12,800 verified leads + priority placement",
         "lead_count": 12800, "commission": 0.15, "sold": 0},
    ]
    revenue_breakdown = [
        {"label": "Starter Sales", "value": 0, "category": "revenue"},
        {"label": "Pro Pack Sales", "value": 0, "category": "revenue"},
        {"label": "Commissions Earned", "value": 0, "category": "commission"},
    ]

    sales_path = os.path.join(SOUL_DIR, "sales.json")
    try:
        with open(sales_path) as f:
            sales = json.load(f)
        for p in products:
            p["sold"] = len([s for s in sales if s.get("product_id") == p["id"]])
    except Exception:
        pass

    bb_state = os.path.join(os.path.expanduser("~"), "business-brain/core/state.json")
    try:
        with open(bb_state) as f:
            state = json.load(f)
        biz = state.get("businesses", {})
        revenue_breakdown = [
            {"label": "Starter Sales", "value": biz.get("etsy_pod", {}).get("starter_revenue", 0), "category": "revenue"},
            {"label": "Pro Pack Sales", "value": biz.get("etsy_pod", {}).get("pro_revenue", 0), "category": "revenue"},
            {"label": "Commissions Earned", "value": biz.get("etsy_pod", {}).get("commission_revenue", 0), "category": "commission"},
        ]
    except Exception:
        pass

    stats = {
        "total_sales": sum(p.get("sold", 0) for p in products),
        "revenue": sum(r["value"] for r in revenue_breakdown),
        "packs_sold": sum(p.get("sold", 0) for p in products),
        "active_campaigns": 3,
    }

    leads = [
        {"id": 1, "name": "Sarah K.", "source": "Instagram DM", "score": 92, "status": "sold"},
        {"id": 2, "name": "Ahmed T.", "source": "Facebook Group", "score": 87, "status": "contacted"},
        {"id": 3, "name": "Fatima A.", "source": "WhatsApp Blast", "score": 78, "status": "new"},
        {"id": 4, "name": "Omar M.", "source": "Real Estate Forum", "score": 95, "status": "sold"},
        {"id": 5, "name": "Laila H.", "source": "Instagram DM", "score": 65, "status": "new"},
    ]

    return {"stats": stats, "products": products, "leaders": leads, "revenue_breakdown": revenue_breakdown}
