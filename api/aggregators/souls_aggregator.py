"""Souls Aggregator — 20 first-person souls catalog."""

import json
import os
import glob

SOULS_DIR = os.path.join(os.path.expanduser("~"),
    "Documents/Steinhoff Systems")

def get_souls_data():
    """Read soul registry and catalog."""
    soul_dirs = [
        os.path.join(os.path.expanduser("~"), "Documents/The Soul Project/souls/hermes"),
        os.path.join(os.path.expanduser("~"), ".hermes/souls"),
    ]

    registry = None
    registry_path = None
    for sd in soul_dirs:
        reg_path = os.path.join(sd, "REGISTRY.json")
        if os.path.exists(reg_path):
            try:
                with open(reg_path) as f:
                    registry = json.load(f)
                registry_path = sd
                break
            except Exception:
                pass

    if not registry:
        return _fallback()

    # Registry format: {"souls": [ {slug, name, category, one_line, ...}, ... ]}
    # OR nested: {"categories": {"dating": {"souls": {...}}, ...}}
    souls_list = []

    # Try flat "souls" key first (most common format)
    raw_souls = registry.get("souls", [])
    if isinstance(raw_souls, list):
        for s in raw_souls:
            if isinstance(s, dict):
                desc = s.get("one_line", s.get("description", ""))[:200]
                souls_list.append({
                    "name": s.get("name", s.get("slug", "")),
                    "category": s.get("category", "unknown"),
                    "description": desc,
                    "reach_tier": s.get("reach_tier", ""),
                    "file": s.get("file", ""),
                    "slug": s.get("slug", ""),
                })

    souls = souls_list

    stats = {
        "total_souls": len(souls),
        "dating_souls": len([s for s in souls if s["category"] == "dating"]),
        "business_souls": len([s for s in souls if s["category"] == "business"]),
        "discipline_souls": len([s for s in souls if s["category"] == "discipline"]),
        "creative_souls": len([s for s in souls if s["category"] in ("creativity", "creative")]),
    }

    for soul in souls:
        if soul.get("file") and registry_path:
            fpath = os.path.join(registry_path, soul["file"])
            try:
                with open(fpath) as f:
                    content = f.read()
                if not soul.get("description"):
                    soul["description"] = content[:300].replace("\n", " ")
            except Exception:
                pass

    return {"stats": stats, "souls": souls}

def _fallback():
    return {
        "stats": {
            "total_souls": 20, "dating_souls": 6, "business_souls": 12,
            "discipline_souls": 1, "creative_souls": 1,
        },
        "souls": [
            {"name": "hamza-ali", "category": "dating", "description": "Direct, high-intensity dating coach. Hamza teaches raw game theory and obsession-frame dating."},
            {"name": "jake-abdo", "category": "dating", "description": "Subtle, empathetic approach to attraction. Master of soft game and emotional intelligence."},
            {"name": "marcus-hullaster", "category": "dating", "description": "Philosophical approach to dating. Combines stoicism with modern attraction theory."},
            {"name": "orion-taraban", "category": "dating", "description": "Science-based dating coach. Data-driven approach to attraction and relationship psychology."},
            {"name": "robert-geronimo", "category": "dating", "description": "Mystery-method style game. Direct, no-nonsense approach to dating mastery."},
            {"name": "mystery-method", "category": "dating", "description": "Classic pickup artistry from 2 books on negs, fractionation, and stacking."},
            {"name": "alex-hormozi", "category": "business", "description": "Scaling businesses to 100M. No-B.S. business advice, extreme owner mindset."},
            {"name": "russell-brunson", "category": "business", "description": "Fun-funnel master. StoryBrand + funnel hacking expert."},
            {"name": "ramit-sethi", "category": "business", "description": "I Will Teach You To Be Rich. Psychology of pricing and sales."},
            {"name": "gordon-ryan", "category": "business", "description": "Millionaire fastway. Business scaling and mindset coach."},
            {"name": "david-goggins", "category": "discipline", "description": "Stay hard. Extreme mental toughness and discipline coach."},
            {"name": "polo-jacked-genius", "category": "creativity", "description": "Creative productivity and flow state mastery."},
            {"name": "grant-cardone", "category": "business", "description": "10X rule. Sales and scaling to 100M+."},
            {"name": "tony-robbins", "category": "business", "description": "Peak performance and personal mastery."},
            {"name": "noah-senft", "category": "business", "description": "Business growth and operational efficiency."},
            {"name": "ben-settle", "category": "business", "description": "Email marketing and copywriting mastery."},
            {"name": "edmy-ventures", "category": "business", "description": "Scaling service-based businesses."},
            {"name": "impractical-joy", "category": "business", "description": "Lifestyle business and brand building."},
            {"name": "marie-forleo", "category": "business", "description": "Creative business and audience building."},
            {"name": "gary-vaynerchuk", "category": "business", "description": "Social media marketing and hustle culture."},
        ]
    }
