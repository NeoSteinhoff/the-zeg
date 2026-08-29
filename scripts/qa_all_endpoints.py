#!/usr/bin/env python3
"""
QA Script: Hit all 23 API endpoints on both localhost:8700 and Vercel.
Capture HTTP status, JSON validity, top-level structure, and field comparison.
"""
import json
import urllib.request
import urllib.error
import sys
import os
import time

ENDPOINTS = [
    "health",
    "command-center",
    "circle-pipeline",
    "mesh-crm",
    "goals",
    "timeline",
    "soul-engine",
    "storefront",
    "ecosystem",
    "hermes-control",
    "aurora-brain",
    "tasks",
    "delegations",
    "crons",
    "ventures",
    "war-room",
    "system",
    "ports",
    "gbrain",
    "crontab",
    "email",
    "pipeline-status",
    "souls",
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
        return {"url": url, "error": str(e), "status": 0, "raw": "", "json": None}

    # Try to parse JSON
    parsed = None
    parse_error = None
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        parse_error = str(e)

    # Get top-level keys (for dicts) or type
    structure = "N/A"
    if isinstance(parsed, dict):
        structure = sorted(parsed.keys())
    elif isinstance(parsed, list):
        structure = f"list[{len(parsed)}]"

    return {
        "url": url,
        "status": status,
        "raw_len": len(raw),
        "json_valid": parsed is not None,
        "parse_error": parse_error,
        "structure": structure,
        "json": parsed,
    }

def get_top_level_keys(obj):
    """Get top-level keys recursively for comparison."""
    if isinstance(obj, dict):
        return sorted(obj.keys())
    elif isinstance(obj, list):
        if len(obj) > 0 and isinstance(obj[0], dict):
            return f"list[{len(obj)}] keys: {sorted(obj[0].keys())}"
        return f"list[{len(obj)}]"
    return str(type(obj))

results = {}
for ep in ENDPOINTS:
    print(f"\n{'='*80}")
    print(f"ENDPOINT: /api/{ep}")
    print(f"{'='*80}")

    # Local
    local = fetch(LOCAL_BASE, ep)
    # Vercel
    vercel = fetch(VERCEL_BASE, ep)

    results[ep] = {"local": local, "vercel": vercel}

    # Print comparison
    print(f"  LOCAL:   status={local['status']}  valid_json={local['json_valid']}  keys={local['structure']}")
    if local.get("parse_error"):
        print(f"  LOCAL PARSE ERROR: {local['parse_error']}")
    print(f"  VERCEL:  status={vercel['status']}  valid_json={vercel['json_valid']}  keys={vercel['structure']}")
    if vercel.get("parse_error"):
        print(f"  VERCEL PARSE ERROR: {vercel['parse_error']}")

    # Compare top-level keys
    if local["json_valid"] and vercel["json_valid"]:
        local_keys = get_top_level_keys(local["json"])
        vercel_keys = get_top_level_keys(vercel["json"])
        if local_keys == vercel_keys:
            print(f"  MATCH: top-level keys identical")
        else:
            print(f"  MISMATCH: top-level keys differ")
            print(f"    LOCAL only:   {set(local_keys) - set(vercel_keys) if isinstance(local_keys, list) and isinstance(vercel_keys, list) else 'N/A'}")
            print(f"    VERCEL only:  {set(vercel_keys) - set(local_keys) if isinstance(local_keys, list) and isinstance(vercel_keys, list) else 'N/A'}")

# Save full results
out_path = "/Users/neosteinhoff/the-zeg/scripts/qa_results.json"
# Strip the huge JSON payloads for the summary, keep structure
summary = {}
for ep, pair in results.items():
    summary[ep] = {
        "local": {k: v for k, v in pair["local"].items() if k != "json"},
        "vercel": {k: v for k, v in pair["vercel"].items() if k != "json"},
    }
with open(out_path, "w") as f:
    json.dump(summary, f, indent=2, default=str)
print(f"\n\nSummary saved to {out_path}")

# Save full JSON payloads
full_path = "/Users/neosteinhoff/the-zeg/scripts/qa_full_results.json"
with open(full_path, "w") as f:
    full = {}
    for ep, pair in results.items():
        full[ep] = {
            "local": pair["local"]["json"],
            "vercel": pair["vercel"]["json"],
        }
    json.dump(full, f, indent=2, default=str)
print(f"Full payloads saved to {full_path}")
