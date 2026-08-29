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

def talk_to_soul(soul_name, query):
    """Simple soul response — reads soul.json metadata and returns a structured reply."""
    if not soul_name or soul_name == "query":
        # If soul_name is the query itself (from /api/soul/<query> route)
        query = soul_name or ""
        soul_name = "aurora-brain"
    
    souls_dir = os.path.join(os.path.expanduser("~"), "Documents/The Soul Project/souls/hermes")
    soul_path = os.path.join(souls_dir, soul_name, "soul.json")
    
    # Try to find a matching soul by name — check directory first, then registry slugs
    if not os.path.exists(soul_path):
        # Load registry to match by slug
        reg_path = os.path.join(souls_dir, "REGISTRY.json")
        if os.path.exists(reg_path):
            try:
                with open(reg_path) as f:
                    registry = json.load(f)
                for s in registry.get("souls", []):
                    sname = s.get("name", "").lower().replace(" ", "-")
                    sslug = s.get("slug", "").lower()
                    # Match if any of: exact slug, exact name, name without spaces
                    if (sname == soul_name.lower() or sslug == soul_name.lower() 
                            or s.get("name","").lower() == soul_name.lower().replace("-", " ")
                            or soul_name.lower() in sslug.lower() or soul_name.lower() in sname.lower()):
                        # Resolve actual directory name
                        fpath = s.get("file", "")
                        dirs = [d for d in os.listdir(souls_dir) if os.path.isdir(os.path.join(souls_dir, d))]
                        if fpath and fpath in dirs:
                            soul_name = fpath
                        elif sname in dirs:
                            soul_name = sname
                        soul_path = os.path.join(souls_dir, soul_name, "soul.json")
                        break
            except Exception:
                pass
        # Fallback: check any directory that starts with the name (handles hamza-ali → hamza-ali-biz)
        if not os.path.exists(soul_path):
            try:
                for d in sorted(os.listdir(souls_dir)):
                    sp = os.path.join(souls_dir, d)
                    if os.path.isdir(sp) and d.startswith(soul_name):
                        soul_name = d
                        soul_path = os.path.join(sp, "soul.json")
                        break
            except Exception:
                pass
        # Final fallback: soul not found after all lookups
        if not os.path.exists(soul_path):
            available = ", ".join(d for d in os.listdir(souls_dir) 
                                  if os.path.isdir(os.path.join(souls_dir, d)) and not d.startswith('.') and d != 'REGISTRY.json' and d != 'REGISTRY.md')
            return {
                "soul": soul_name,
                "response": f"I don't recognize that soul. Available: {available[:200]}",
                "source": "registry"
            }
    
    # Read the soul's data for a contextual response
    try:
        with open(soul_path) as f:
            soul = json.load(f)
        persona = soul.get("persona", soul.get("character", ""))
        if isinstance(persona, dict):
            persona = persona.get("voice", persona.get("style", str(persona)[:200]))
        
        # Build response based on query topic
        categories = soul.get("category", "")
        desc = soul.get("description", soul.get("one_line", ""))
        
        if "dashboard" in query.lower() or "ui" in query.lower() or "ux" in query.lower():
            response = f"As a {categories} coach, I'd say: The dashboard needs better visual hierarchy. Put the most important metric first (Hormozi: 'duration first'). Add traffic light status — green for go, red for stop. Users should know in 3 seconds what's working and what's not."
        elif "mobile" in query.lower():
            response = f"Mobile-first: touch targets ≥44px, safe-area insets for notch, viewport units for iOS 100vh bug. The hamburger→drawer pattern is correct ({categories} soul approves)."
        elif "real-time" in query.lower() or "webhook" in query.lower():
            response = f"Real-time is king. Use SSE for live updates, webhooks for push from Hermes CC. Don't poll — get pushed. ({categories} perspective)"
        else:
            response = f"As {soul.get('name', soul_name)} ({categories}): {desc[:200]}"
        
        return {
            "soul": soul_name,
            "category": categories,
            "query": query[:200],
            "response": response[:500],
            "source": "soul.json",
            "persona_voice": str(persona)[:100] if persona else "",
        }
    except Exception as e:
        return {
            "soul": soul_name,
            "response": f"[{soul_name}] I'm processing... error: {str(e)[:100]}",
            "source": "error"
        }
