/* ═══════════════════════════════════════════════════
   THE ZEG — War Room View
   Incident tracking + system health watchdog
   ═══════════════════════════════════════════════════ */

const WAR_ISSUES = [
  {
    severity: 'info',
    msg: 'All backend services operational.',
    ts: new Date().toISOString()
  }
];

export function init(container, api) {
  render(container, api);
}

export async function refresh(_api) {
  const container = document.querySelector('.main-content');
  if (container) render(container, _api || window.ZEG?.api);
}

function healthDot(status) {
  const map = {
    online: 'green',
    offline: 'red',
    degraded: 'orange',
    unknown: 'orange'
  };
  return `<span class="status-dot ${map[status] || 'orange'}"></span>`;
}

async function checkService(url, name) {
  try {
    const resp = await fetch(url, { method: 'GET', mode: 'cors' });
    if (resp.ok) return { name, status: 'online', detail: `200 OK` };
    return { name, status: 'degraded', detail: `${resp.status}` };
  } catch (e) {
    return { name, status: 'offline', detail: e.message.substring(0, 40) };
  }
}

async function render(container, api) {
  container.innerHTML = `
    <div id="war-room">
      <div class="card">
        <div class="card-header">System Health Watchdog</div>
        <div id="health-grid" class="stat-grid" style="margin-bottom:0"></div>
      </div>
      <div class="card">
        <div class="card-header">Incident Feed</div>
        <div id="war-list" style="margin-bottom:8px"></div>
        <button class="btn btn-ghost" onclick="addWarIssue()" style="font-size:11px;margin-top:8px">Report Issue</button>
      </div>
    </div>
  `;
  loadData(api);
}

async function loadData(api) {
  // Check services
  const services = [
    { url: 'http://localhost:8700/api/health', name: 'Zeg API (8700)' },
    { url: 'http://localhost:31337', name: 'Neo Brain (31337)' },
    { url: 'http://localhost:8502', name: 'Hermes CC (8502)' },
    { url: 'http://localhost:9120', name: 'Hermes Agent (9120)' },
  ];

  const healthGrid = document.getElementById('health-grid');

  if (healthGrid) {
    healthGrid.innerHTML = `<div class="stat blue"><div class="num">○</div><div class="lbl">Checking…</div></div>`;
  }

  const results = await Promise.allSettled(
    services.map(s => checkService(s.url, s.name))
  );

  const checks = results.map(r => r.status === 'fulfilled' ? r.value : { name: '?', status: 'offline', detail: 'check failed' });
  // Also include local DB checks from API
  const apiHealth = await api.fetch('/api/health');

  const allChecks = [
    ...checks,
    { name: 'state.db', status: apiHealth ? 'online' : 'offline', detail: apiHealth ? 'reachable' : 'unreachable' },
    { name: 'kanban.db', status: apiHealth ? 'online' : 'offline', detail: apiHealth ? 'reachable' : 'unreachable' },
  ];

  healthGrid.innerHTML = allChecks.map(c => `
    <div class="stat ${c.status === 'online' ? 'green' : c.status === 'offline' ? 'red' : 'orange'}">
      <div class="num" style="font-size:13px">${healthDot(c.status)} ${c.name}</div>
      <div class="lbl">${c.detail}</div>
    </div>
  `).join('');

  // Incident list
  const warList = document.getElementById('war-list');
  if (warList) {
    warList.innerHTML = WAR_ISSUES.map(iss => {
      const label = iss.severity === 'err' ? '☠️' : iss.severity === 'warn' ? '⚠️' : 'ℹ️';
      const cls = iss.severity === 'err' ? 'red' : iss.severity === 'warn' ? 'orange' : 'blue';
      return `
        <div class="card" style="margin-bottom:8px;border-left:3px solid var(--${cls})">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div><b>${label}</b> ${iss.msg}</div>
            <span class="badge badge-${cls === 'red' ? 'failed' : cls === 'orange' ? 'pending' : 'running'}">${iss.severity}</span>
          </div>
          <div class="meta mono" style="font-size:10px;color:var(--muted);margin-top:4px">${iss.ts || ''}</div>
        </div>
      `;
    }).join('');
  }
}

window.addWarIssue = function() {
  const msg = prompt('Describe the incident:');
  if (!msg) return;
  const sev = prompt('Severity (err/warn/info):', 'warn') || 'warn';
  WAR_ISSUES.unshift({ severity: sev, msg, ts: new Date().toISOString() });
  const container = document.querySelector('.main-content');
  if (container) render(container, _api || window.ZEG?.api);
};
