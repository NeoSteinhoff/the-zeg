/* ═══════════════════════════════════════════════════════════
   THE ZEG — Shared Utilities
   ═══════════════════════════════════════════════════════════ */

// ─── Number Formatting ───
export function fmtNum(n, opts = {}) {
  n = Number(n);
  if (Number.isNaN(n)) return '—';
  if (n >= 1e12) return (n / 1e12).toFixed(opts.decimals || 1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(opts.decimals || 1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(opts.decimals || 1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(opts.decimals || 1) + 'K';
  return String(Math.round(n));
}

export function fmtCurrency(n, currency = 'USD', locale = 'en-US') {
  n = Number(n);
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
}

export function fmtPercent(n, total, opts = {}) {
  if (!total) return '—';
  const pct = (Number(n) / Number(total)) * 100;
  return pct.toFixed(opts.decimals || 1) + '%';
}

export function fmtFileSize(bytes) {
  bytes = Number(bytes);
  if (Number.isNaN(bytes) || bytes <= 0) return '—';
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + 'MB';
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(1) + 'KB';
  return bytes + 'B';
}

export function fmtDuration(ms) {
  if (!ms) return '—';
  if (ms < 1000) return ms + 'ms';
  if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
  if (ms < 3600000) return (ms / 60000).toFixed(1) + 'm';
  return (ms / 3600000).toFixed(1) + 'h';
}

// ─── Date/Time Formatting ───
export function fmtRelative(ts) {
  if (!ts) return '—';
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
  return new Date(ts).toLocaleDateString();
}

export function fmtDateTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

// ─── Status Rendering ───
export function renderStatus(status) {
  const map = {
    healthy: { label: 'Healthy', class: 'badge-ok' },
    ok: { label: 'OK', class: 'badge-ok' },
    online: { label: 'Online', class: 'badge-ok' },
    active: { label: 'Active', class: 'badge-ok' },
    running: { label: 'Running', class: 'badge-ok' },
    pending: { label: 'Pending', class: 'badge-pending' },
    queued: { label: 'Queued', class: 'badge-pending' },
    warning: { label: 'Warning', class: 'badge-warn' },
    warn: { label: 'Warning', class: 'badge-warn' },
    error: { label: 'Error', class: 'badge-failed' },
    failed: { label: 'Failed', class: 'badge-failed' },
    offline: { label: 'Offline', class: 'badge-failed' },
    disconnected: { label: 'Disconnected', class: 'badge-failed' },
    idle: { label: 'Idle', class: 'badge-idle' },
  };
  const s = (status || '').toLowerCase();
  const m = map[s] || { label: status || '—', class: 'badge-idle' };
  return `<span class="badge ${m.class}">${m.label}</span>`;
}

// ─── Empty State ───
export function emptyState(message = 'No data available') {
  return `<div class="empty-state">${message}</div>`;
}

// ─── Toast/Error Helpers ───
export function showError(message, container) {
  const el = container || document.getElementById('main-content');
  if (el) el.innerHTML = `<div class="card"><div class="card-header">Error</div><p>${message}</p></div>`;
}

export function showLoading(message = 'Loading…', container) {
  const el = container || document.getElementById('main-content');
  if (el) el.innerHTML = `<div class="loading-spinner">${message}</div>`;
}

// ─── Table Helpers ───
export function renderTable(headers, rows, opts = {}) {
  const emptyMsg = opts.empty || 'No data';
  if (!rows || rows.length === 0) return `<div class="empty-state">${emptyMsg}</div>`;
  return `
    <table>
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  `;
}

// ─── Debounce ───
export function debounce(fn, delay = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ─── Safe DOM ───
export function el(selector, parent = document) {
  return parent.querySelector(selector);
}

export function elAll(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector));
}