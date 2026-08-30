# The Zeg — View Consistency Guide

This document defines the standard patterns for all views in `/views`. All new views **must** follow these conventions. Existing views should be migrated toward this standard over time.

---

## 1. File Structure & Naming

| Rule | Standard |
|------|----------|
| **File name** | kebab-case: `my-view.js` |
| **Export name** | PascalCase matching file: `MyView` |
| **Global registration** | `window.ZEG.views.register('my-view', { init, destroy, refresh })` |
| **Module type** | ES Modules (`import`/`export`) — no IIFE wrappers |

### Required Exports

```javascript
export async function init(container, api) { ... }
export function destroy() { ... }
export async function refresh() { ... }
```

---

## 2. Imports

**Always import from `../utils.js`** — never duplicate utility functions.

```javascript
import {
  $, $$, on, off, emit, state, api, render,
  debounce, throttle, formatDate, formatCurrency,
  escapeHtml, clamp, uuid, storage,
  showLoading, fmtNum, fmtCurrency, fmtPercent,
  fmtFileSize, fmtDuration, fmtRelative, fmtDateTime,
  renderStatus, emptyState, showError, renderTable,
  el, elAll,
} from '../utils.js';
```

---

## 3. Template Structure (HTML)

Every view renders this base structure:

```html
<div class="view view-{name}">
  <header class="view-header">
    <h1>{Title}</h1>
    <button class="btn btn-secondary" data-action="refresh" aria-label="Refresh">
      ⟳ Refresh
    </button>
  </header>

  <div class="view-loading" data-loading aria-live="polite"></div>
  <section class="view-stats" data-stats aria-label="Statistics"></section>
  <section class="view-content" data-content aria-label="Main content"></section>
</div>
```

### CSS Classes (use exactly these)

| Element | Class |
|---------|-------|
| Root | `view view-{kebab-name}` |
| Header | `view-header` |
| Loading | `view-loading` |
| Stats grid | `view-stats` |
| Content | `view-content` |
| Stat card | `stat-card` |
| Stat value | `stat-value` |
| Stat label | `stat-label` |

---

## 4. Data Loading Pattern

**Always fetch concurrently with `Promise.all` and `.catch(() => null)` per endpoint:**

```javascript
async function loadData() {
  const loadingEl = $('[data-loading]');
  if (loadingEl) showLoading(loadingEl, true);

  try {
    const [data1, data2, data3] = await Promise.all([
      api.fetch('/api/endpoint1').catch(() => null),
      api.fetch('/api/endpoint2').catch(() => null),
      api.fetch('/api/endpoint3').catch(() => null),
    ]);

    renderView(data1, data2, data3);
  } catch (err) {
    showError(err, '[ViewName] loadData');
    renderFallback();
  } finally {
    if (loadingEl) showLoading(loadingEl, false);
  }
}
```

---

## 5. Rendering Pattern

### Stats Cards

```javascript
function renderStats(stats) {
  const container = $('[data-stats]');
  if (!container) return;

  const items = [
    { label: 'Total Items', value: fmtNum(stats?.total) },
    { label: 'Revenue', value: fmtCurrency(stats?.revenue) },
    { label: 'Completion', value: fmtPercent(stats?.rate) },
  ];

  container.innerHTML = items
    .map((s) => `
      <div class="stat-card">
        <div class="stat-value">${escapeHtml(s.value)}</div>
        <div class="stat-label">${escapeHtml(s.label)}</div>
      </div>
    `)
    .join('');
}
```

### Tables

Use `renderTable(headers, rows, options)` from utils:

```javascript
renderTable(
  ['ID', 'Name', 'Status', 'Actions'],
  data.map((item) => [
    escapeHtml(item.id.slice(0, 8)),
    escapeHtml(item.name),
    renderStatus(item.status),
    `<button data-action="detail" data-id="${item.id}">View</button>`,
  ]),
  { emptyMessage: 'No items found' }
);
```

### Status Badges

Use `renderStatus(status)` from utils — it returns standardized badge HTML.

---

## 6. Event Binding

**Use delegated events via `on(root, event, selector, handler)` from utils:**

```javascript
function bindEvents(root) {
  on(root, 'click', '[data-action="refresh"]', () => refresh());
  on(root, 'submit', '[data-form]', handleFormSubmit);
  on(root, 'click', '[data-action="detail"]', (e) => {
    const id = e.currentTarget.dataset.id;
    viewDetail(id);
  });
  on(root, 'change', '[data-filter]', (e) => {
    currentFilter = e.target.value;
    renderView(currentData);
  });
}
```

---

## 7. Error Handling

```javascript
function showError(err, context) {
  console.error(`[${context}]`, err);
  // UI feedback via toast or inline message
}
```

### Fallback UI (when all API calls fail)

```javascript
function renderFallback() {
  $('[data-stats]').innerHTML = Array(5)
    .fill(`<div class="stat-card"><div class="stat-value">○○○</div><div class="stat-label">API Disconnected</div></div>`)
    .join('');

  $('[data-content]').innerHTML = emptyState(
    'No data available',
    'Check your connection and try refreshing.'
  );
}
```

---

## 8. Auto-Refresh

```javascript
let refreshTimer = null;

function startAutoRefresh() {
  refreshTimer = setInterval(() => refresh(), 30000); // 30s default
}

function stopAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
}

export function destroy() {
  stopAutoRefresh();
  // Clean up window-bound handlers
}
```

---

## 9. Window-Bound Handlers (Legacy Pattern)

**Avoid** attaching to `window`. If needed for inline `onclick`:

```javascript
// In init():
window.myViewAction = myAction;

// In destroy():
window.myViewAction = null;
```

**Prefer:** `data-action` + delegated `on()` binding.

---

## 10. API Client Usage

```javascript
// GET
const data = await api.fetch('/api/endpoint');

// POST
await api.post('/api/endpoint', { key: 'value' });

// With query params
const data = await api.fetch(`/api/endpoint?filter=${encodeURIComponent(value)}`);
```

---

## 11. JSDoc Requirements

Every exported function and non-trivial internal function needs JSDoc:

```javascript
/**
 * Load and render all view data
 * @returns {Promise<void>}
 */
async function loadData() { ... }
```

---

## 12. Security

- **Always escape dynamic content** with `escapeHtml()` before inserting via `innerHTML`
- Never interpolate untrusted data directly into template strings
- Use `renderStatus()`, `renderTable()` which handle escaping internally

---

## 13. Accessibility

- All interactive elements need `aria-label` or visible text
- Loading regions: `aria-live="polite"` on `[data-loading]`
- Stats region: `aria-label="Statistics"`
- Content region: `aria-label="Main content"`

---

## 14. Inconsistent Views (Audit Results)

The following 21 views were analyzed. **Inconsistencies** marked with ⚠️:

| View | Issues |
|------|--------|
| **agent-grid.js** | ⚠️ Uses IIFE pattern, no ES exports, inline CSS injection, `window.agentGridRefresh` global |
| **agent-storefront.js** | ⚠️ IIFE, inline CSS, `window.agentStorefrontRefresh`, uses `alert()` for actions |
| **aurora-brain.js** | ⚠️ IIFE, inline CSS, `window.auroraBrainRefresh`, `window.runQuickBenchmark`, `window.clearBenchmarkResults` |
| **circle-pipeline.js** | ⚠️ IIFE, inline CSS, `window.pipelineRefresh`, `window.filterPipeline`, `window.viewPersonDetail` globals |
| **command-center.js** | ⚠️ IIFE, inline CSS, `window.commandCenterRefresh`, `window.runQuickAction`, `window.viewSessionDetail` |
| **cost-models.js** | ⚠️ IIFE, inline CSS, `window.costModelsRefresh`, `window.exportCostData` |
| **cron-monitor.js** | ⚠️ IIFE, inline CSS, `window.cronMonitorRefresh`, `window.viewCronDetail`, `window.toggleCron` |
| **ecosystem.js** | ⚠️ IIFE, inline CSS, `window.ecosystemRefresh`, `window.viewServiceDetail` |
| **goals.js** | ⚠️ IIFE, inline CSS, `window.goalsRefresh`, `window.addGoal`, `window.toggleGoal` |
| **hermes-control.js** | ⚠️ IIFE, inline CSS, `window.hermesControlRefresh`, `window.restartService`, `window.viewLogs` |
| **live-feed.js** | ⚠️ IIFE pattern (no exports), `window.zegFeedRefresh` global, uses `fmtNum` from utils but `showLoading` inline |
| **mesh-crm.js** | ⚠️ IIFE, inline CSS, `window.touchFriend`, `window.MESH_DATA` global, canvas animation loop |
| **mission-control.js** | ⚠️ IIFE, inline CSS, `window.addFeedItem`, `window.addApproval` globals |
| **soul-engine.js** | ⚠️ IIFE, inline CSS, `window.selectSoul`, `window.sendToSoul`, `window.talkToSoul`, `window.quickSoul` |
| **storefront.js** | ⚠️ IIFE, inline CSS, `window.StorefrontView` export, uses `alert()` for actions |
| **system-health.js** | ⚠️ IIFE, inline CSS, missing `fmtFileSize` import (uses undefined function) |
| **tasks.js** | ⚠️ IIFE, inline CSS, `window.viewTaskDetail`, `window.openCreateTaskModal`, `window.submitCreateTask`, depends on undefined `openZegModal`, `closeZegModal`, `showZegToast`, `refreshData`, `fmtTs` |
| **timeline.js** | ⚠️ IIFE, inline CSS, `window.toggleGoal`, hardcoded dates in template |
| **treasury.js** | ⚠️ IIFE, inline CSS, `window.logMoney`, missing `logMoney`, `showFallback`, `fmtTs` implementations |
| **ventures.js** | ⚠️ IIFE, inline CSS, `window.filterVentures`, `window.viewVenture`, `window.addWarIssue` (wrong view?) |
| **war-room.js** | ⚠️ IIFE, inline CSS, `window.addWarIssue` |

### Summary of Violations

| Violation | Count | Views Affected |
|-----------|-------|----------------|
| IIFE wrapper (no ES modules) | 21 | All |
| Inline `<style>` injection | 21 | All |
| Global `window.*` handlers | 21 | All |
| Missing `destroy()` export | 21 | All |
| Missing `refresh()` export | 21 | All |
| Uses `alert()` for UI | 3 | agent-storefront, storefront, goals |
| Missing utility imports | 4 | system-health, tasks, treasury, timeline |
| Hardcoded dates/values | 2 | timeline, treasury |
| Cross-view globals (`addWarIssue`) | 2 | ventures, war-room |

---

## 15. Migration Checklist

For each existing view, apply these changes:

- [ ] Convert to ES Module (`export function init...`)
- [ ] Remove IIFE wrapper
- [ ] Move CSS to global stylesheet (or `<style>` in index.html)
- [ ] Replace `window.*` handlers with `data-action` + delegated `on()`
- [ ] Add `destroy()` export with cleanup
- [ ] Add `refresh()` export
- [ ] Import all utilities from `../utils.js`
- [ ] Use `renderTable()`, `renderStatus()`, `emptyState()` from utils
- [ ] Add JSDoc to all functions
- [ ] Add `aria-label` attributes
- [ ] Register with `window.ZEG.views.register()`

---

## 16. Quick Reference: Utils Functions

| Function | Purpose |
|----------|---------|
| `$(sel, root?)` | Single element query |
| `$$(sel, root?)` | All elements query |
| `on(root, event, sel, fn)` | Delegated event listener |
| `off(root, event, sel, fn)` | Remove listener |
| `showLoading(el, bool)` | Show/hide spinner |
| `fmtNum(n)` | Format number (1.2K, 1.5M) |
| `fmtCurrency(n, currency?)` | Format AED/USD |
| `fmtPercent(n)` | Format percentage |
| `fmtFileSize(bytes)` | Format bytes |
| `fmtDuration(ms)` | Format milliseconds |
| `fmtRelative(date)` | Relative time (2h ago) |
| `fmtDateTime(date)` | Full date/time |
| `renderStatus(status)` | Status badge HTML |
| `emptyState(title, msg)` | Empty state HTML |
| `showError(err, ctx)` | Log + toast error |
| `renderTable(headers, rows, opts)` | Table HTML |
| `escapeHtml(str)` | XSS-safe escape |
| `debounce(fn, ms)` | Debounced function |
| `throttle(fn, ms)` | Throttled function |
| `el(tag, attrs, children)` | Create element |
| `elAll(html)` | Create multiple elements |

---

*Generated from audit of 21 views on 2026-08-30*