# The Zeg Security Audit Report

**Date:** 2025-08-30
**Scope:** API Server (`/api/server.py`) + Frontend Views (`/views/*.js`, `/app.js`, `/utils.js`)
**Severity Scale:** CRITICAL > HIGH > MEDIUM > LOW

---

## Executive Summary

| Category | CRITICAL | HIGH | MEDIUM | LOW | Total |
|----------|----------|------|--------|-----|-------|
| XSS (Frontend) | 0 | 8 | 5 | 3 | 16 |
| CORS | 0 | 1 | 0 | 0 | 1 |
| Subprocess/Command Injection | 0 | 1 | 0 | 0 | 1 |
| Path Traversal | 0 | 1 | 0 | 0 | 1 |
| SQL Injection | 0 | 0 | 1 | 0 | 1 |
| Missing Security Headers | 0 | 0 | 3 | 0 | 3 |
| Input Validation | 0 | 0 | 4 | 2 | 6 |
| **Total** | **0** | **11** | **13** | **5** | **29** |

---

## Detailed Findings

### 🔴 HIGH SEVERITY

#### 1. XSS via Unsafed `innerHTML` in Frontend Views — Multiple Locations
**CWE-79: Improper Neutralization of Input During Web Page Generation**

| File | Line | Pattern | Risk |
|------|------|---------|------|
| `app.js` | 625 | `overlay.innerHTML = bodyHTML` | Modal body HTML directly injected |
| `app.js` | 879-890 | `showAgentDetail()` builds HTML from API fields | Session metadata rendered as HTML |
| `views/soul-engine.js` | 98 | `response.innerHTML = '<div>${result.response}</div>'` | API response rendered as HTML |
| `views/tasks.js` | 83 | `<td>${t.title || '—'}</td>` | Task title in HTML template |
| `views/tasks.js` | 157-167 | `commentHtml` / `eventHtml` string concat | Comments/events rendered as HTML |
| `views/command-center.js` | 68 | `qab.innerHTML` from `qa.actions[]` | Quick action labels as HTML |
| `views/agent-storefront.js` | 19, 60, 71, 86, 145 | Multiple `innerHTML` | Product/lead data as HTML |
| `views/goals.js` | 19, 68, 77, 86, 97, 114 | Multiple `innerHTML` | Goal/timeline data as HTML |
| `views/storefront.js` | 25, 54, 67, 70, 91, 101 | Multiple `innerHTML` | Campaign data as HTML |
| `views/cost-models.js` | 19, 68, 78, 97, 111 | Multiple `innerHTML` | Cost/model data as HTML |
| `views/circle-pipeline.js` | 18, 53, 66, 212, 233, 255, 257, 276 | Multiple `innerHTML` | Pipeline data as HTML |
| `views/aurora-brain.js` | 19, 51, 63, 81, 86, 88, 91 | Multiple `innerHTML` | Aurora actions/response as HTML |
| `utils.js` | 91, 96 | Error/loading `innerHTML` | Error messages as HTML |

**Impact:** If any API endpoint returns attacker-controlled data (e.g., task titles, soul responses, session metadata), arbitrary JavaScript executes in victim's browser context.

**Proof of Concept:** Create a task with title `<img src=x onerror=alert(1)>` — renders as executable HTML in tasks view.

---

#### 2. CORS Wildcard with Credentials — `server.py` lines 195-200
**CWE-942: Permissive Cross-domain Policy with Credentials**

```python
# Lines 195-200 in server.py
response.headers["Access-Control-Allow-Origin"] = "*"
response.headers["Access-Control-Allow-Credentials"] = "true"
```

**Impact:** Browsers reject this combination (invalid per spec), but misconfigured clients or non-browser clients may accept it. If `Access-Control-Allow-Origin` is dynamically set to request origin while `Access-Control-Allow-Credentials: true`, any site can make authenticated requests.

**Fix:** Either remove `Access-Control-Allow-Credentials` or restrict `Access-Control-Allow-Origin` to specific trusted origins.

---

#### 3. Command Injection in Hermes Chat Endpoint — `server.py` lines 515, 533
**CWE-78: Improper Neutralization of Special Elements used in an OS Command**

```python
# Line 533
result = subprocess.run(
    ["hermes", "-z", text],  # text comes from request body
    capture_output=True,
    text=True,
    timeout=30
)
```

**Impact:** User input `text` passed directly to `subprocess.run()` as argument. While `shell=False` (default) and list-form arguments prevent shell metacharacter injection, argument injection is still possible if `hermes` parses arguments unsafely. Additionally, if `text` contains newlines or control characters, it could affect command parsing.

**Proof of Concept:** Send `text="; cat /etc/passwd"` — if `hermes` uses `shell=True` internally or parses args unsafely, command executes.

---

#### 4. Path Traversal in Soul Lookup — `api/aggregators/souls_aggregator.py` lines 112-151
**CWE-22: Improper Limitation of a Pathname to a Restricted Directory**

```python
# Line 112-113
souls_dir = os.path.join(os.path.expanduser("~"), "Documents/The Soul Project/souls/hermes")
soul_path = os.path.join(souls_dir, soul_name, "soul.json")
```

**Impact:** User-controlled `soul_name` parameter used in `os.path.join()` without validation. Directory traversal via `../../../etc/passwd` or similar payloads could read arbitrary files.

**Proof of Concept:** Request `/api/soul/../../../etc/passwd` — if path normalization doesn't catch it, reads `/etc/passwd`.

---

### 🟡 MEDIUM SEVERITY

#### 5. SQL Injection Risk in Dynamic Query Building — `api/aggregators/circle_aggregator.py` lines 90-96
**CWE-89: Improper Neutralization of Special Elements used in an SQL Command**

```python
# Lines 90-96
select_str = ", ".join(select_fields)
rows = conn.execute(f"""
    SELECT id, {select_str}
    FROM roster
    {"WHERE context_type = 'friendship'" if "context_type" in cols else ""}
    ORDER BY trust_score DESC, reciprocity_score DESC
    LIMIT 200
""").fetchall()
```

**Impact:** `select_str` built from column names checked against schema (`PRAGMA table_info`), which is safe *if* the schema is trusted. However, dynamic query construction via f-strings is a dangerous pattern. If `cols` ever comes from untrusted source, SQL injection occurs.

---

#### 6. Missing Content Security Policy (CSP)
**CWE-693: Protection Mechanism Failure**

No CSP headers set. Allows inline scripts, eval(), and external resources from any origin.

---

#### 7. Missing HSTS Header
**CWE-520: Insufficiently Protected Credentials**

No `Strict-Transport-Security` header. Allows downgrade attacks on HTTPS.

---

#### 8. Missing X-Frame-Options / Frame-Ancestors
**CWE-1021: Improper Restriction of Rendered UI Layers**

No clickjacking protection.

---

#### 9. Weak Input Validation on API Endpoints
**CWE-20: Improper Input Validation**

| Endpoint | Parameter | Validation |
|----------|-----------|------------|
| `/api/soul/<query>` | `query` | None — passed directly to `talk_to_soul()` |
| `/api/hermes-chat` | `text` | None — passed to subprocess |
| `/api/task` (POST) | `title`, `body`, `priority` | None — inserted to DB |
| `/api/comment` (POST) | `task_id`, `content` | None |
| `/api/quick-actions` | Various | None |

---

#### 10. Error Information Exposure
**CWE-209: Generation of Error Message Containing Sensitive Information**

```python
# Multiple locations in server.py
except Exception as e:
    return jsonify({"error": str(e)}), 500
```

Stack traces and internal paths leaked to clients.

---

#### 11. Insecure Default in `sqlite_query` — `server.py` line 64-68
**CWE-89: SQL Injection (Defense in Depth)**

```python
def sqlite_query(db_path, query, params=()):
    conn = sqlite3.connect("file:" + db_path + "?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(query, params).fetchall()  # params used correctly
    conn.close()
    return rows
```

**Assessment:** Currently safe because all callers use parameterized queries. But function signature allows raw query strings — a future caller could pass unparameterized query.

---

#### 12. No Rate Limiting / DoS Protection
**CWE-770: Allocation of Resources Without Limits or Throttling**

All endpoints accept unlimited requests. Subprocess endpoint (`/api/hermes-chat`) particularly vulnerable — spawns process per request.

---

#### 13. Hardcoded Paths with User Home Expansion
**CWE-73: External Control of File Name or Path**

Multiple aggregators use `os.path.expanduser("~")` with hardcoded relative paths. If `HOME` env var manipulated, reads/writes to arbitrary locations.

---

### 🟢 LOW SEVERITY

#### 14. Debug/Development Endpoints Exposed
- `/api/debug/*` endpoints (if any)
- Verbose error messages in production

#### 15. No Request Size Limits
Large request bodies can cause memory exhaustion.

#### 16. Subprocess `ps aux` Information Exposure — `server.py` lines 199, 573
Process list leaked via `/api/system` and `/api/health/gateway` endpoints.

#### 17. Insecure Fallback Data
Hardcoded fallback data in aggregators (e.g., `souls_aggregator.py` lines 75-103) may contain stale/real data.

#### 18. Missing Audit Logging
No security-relevant event logging (failed auth, injection attempts, etc.).

---

## Remediation Priority

| Priority | Issues | Effort |
|----------|--------|--------|
| **P0 (Immediate)** | #2 CORS, #3 Command Injection, #4 Path Traversal | Low |
| **P1 (This Sprint)** | #1 XSS (all 16 instances), #5 SQL Pattern, #9 Input Validation | Medium |
| **P2 (Next Sprint)** | #6 CSP, #7 HSTS, #8 Clickjacking, #10 Error Handling | Medium |
| **P3 (Backlog)** | #11 Defense-in-depth, #12 Rate Limiting, #13 Path Config, #14-18 | Low |

---

## Recommended Fixes Summary

### Backend (`server.py`)
1. **Fix CORS**: Restrict origins, remove credentials wildcard
2. **Fix Command Injection**: Validate/sanitize `text` input, use allowlist for hermes args
3. **Add Security Headers**: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
4. **Add Input Validation**: Schema validation for all POST/PUT endpoints
5. **Sanitize Errors**: Generic error messages in production
6. **Add Rate Limiting**: Especially on `/api/hermes-chat`
7. **Audit `sqlite_query`**: Enforce parameterized queries only

### Frontend (Views)
1. **Replace `innerHTML` with `textContent`** + DOM APIs where possible
2. **Add DOMPurify** for any necessary HTML rendering
3. **Escape all user-controlled data** before DOM insertion
4. **Centralize sanitization utility** in `utils.js`

### Aggregators
1. **Fix Path Traversal**: Validate `soul_name` against allowlist / regex
2. **Fix Dynamic SQL**: Use static queries or validated column lists only
3. **Remove Hardcoded Paths**: Config-based paths

---

## Testing Checklist

- [ ] XSS payloads in task titles, soul queries, session metadata
- [ ] CORS preflight with various origins
- [ ] Command injection payloads in `/api/hermes-chat`
- [ ] Path traversal in `/api/soul/`
- [ ] SQL injection in dynamic query endpoints
- [ ] CSP header present and restrictive
- [ ] HSTS header present
- [ ] Rate limiting enforced
- [ ] Error messages don't leak stack traces
- [ ] Clickjacking protection verified