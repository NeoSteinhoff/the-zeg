#!/usr/bin/env python3
"""
Deep QA: Fetch all 23 endpoints from both localhost:8700 and Vercel.
Compare structure, field naming, and data freshness.
"""
import json
import urllib.request
import urllib.error
import os
import datetime

ENDPOINTS = [
    "health", "command-center", "circle-pipeline", "mesh-crm", "goals",
    "timeline", "soul-engine", "storefront", "ecosystem", "hermes-control",
    "aurora-brain", "tasks", "delegations", "crons", "ventures",
    "war-room", "system", "ports", "gbrain", "crontab", "email",
    "pipeline-status", "souls",
]

LOCAL_BASE = "http://localhost:8700/api"
VERCEL_BASE = "https://the-zeg.vercel.app/api"

def fetch(base, endpoint):
    url = f"{base}/{endpoint}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8")
            status = resp.status
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        status = e.code
    except Exception as e:
        return {"endpoint": endpoint, "url": url, "error": str(e), "status": 0, "json": None}
    try:
        parsed = json.loads(raw)
    except:
        parsed = None
    return {"endpoint": endpoint, "url": url, "status": status, "json": parsed, "raw_len": len(raw)}

def get_keys_recursive(obj, prefix="", depth=0, max_depth=3):
    """Get nested keys up to max_depth."""
    if depth > max_depth:
        return set()
    keys = set()
    if isinstance(obj, dict):
        for k, v in obj.items():
            full_key = f"{prefix}.{k}" if prefix else k
            keys.add(full_key)
            keys.update(get_keys_recursive(v, full_key, depth+1, max_depth))
    elif isinstance(obj, list) and len(obj) > 0:
        # Get keys from first element
        keys.update(get_keys_recursive(obj[0], prefix + "[0]", depth+1, max_depth))
    return keys

# Fetch all endpoints
results = {}
for ep in ENDPOINTS:
    print(f"[{ep}] fetching LOCAL + VERCEL...", flush=True)
    local = fetch(LOCAL_BASE, ep)
    vercel = fetch(VERCEL_BASE, ep)
    results[ep] = {"local": local, "vercel": vercel}

# Deep comparison
print("\n" + "="*80)
print("DEEP COMPARISON REPORT")
print("="*80)

for ep in ENDPOINTS:
    print(f"\n--- {ep} ---")
    l = results[ep]["local"]
    v = results[ep]["vercel"]

    # Status check
    if l["status"] != v["status"]:
        print(f"  ⚠️  STATUS MISMATCH: local={l['status']} vercel={v['status']}")
    else:
        print(f"  ✓ Status: both={l['status']}")

    # JSON validity
    l_valid = l["json"] is not None
    v_valid = v["json"] is not None
    if not l_valid:
        print(f"  ✗ LOCAL: invalid JSON")
    if not v_valid:
        print(f"  ✗ VERCEL: invalid JSON")

    if l_valid and v_valid:
        # Compare nested keys
        l_keys = get_keys_recursive(l["json"], max_depth=2)
        v_keys = get_keys_recursive(v["json"], max_depth=2)
        l_only = l_keys - v_keys
        v_only = v_keys - l_keys
        if l_only or v_only:
            if l_only:
                print(f"  ⚠️  LOCAL-only keys (depth≤2): {sorted(l_only)}")
            if v_only:
                print(f"  ⚠️  VERCEL-only keys (depth≤2): {sorted(v_only)}")
        else:
            print(f"  ✓ All keys match (depth≤2)")

        # Check for stale timestamps in data
        raw = json.dumps(l["json"]) + json.dumps(v["json"])
        # Look for date patterns
        import re
        dates = re.findall(r'202[0-9]-[0-1][0-9]-[0-9][0-9]', raw)
        if dates:
            print(f"  ℹ️  Dates found in data: {sorted(set(dates))[:5]}")

# Save full raw results
out_path = os.path.join(os.path.dirname(__file__), "qa_deep_results.json")
with open(out_path, "w") as f:
    json.dump(results, f, indent=2, default=str)
print(f"\n\nFull results saved to {out_path}")
