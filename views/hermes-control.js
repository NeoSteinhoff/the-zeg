/* ═══════════════════════════════════════════════════
   THE ZEG — Hermes Control View
   Integrates the Hermes Control Interface functionality
   ═══════════════════════════════════════════════════ */

export function init(container, api) {
  render(container, api);
}

export async function refresh(_api) {
  const container = document.querySelector('.main-content');
  if (container) render(container, _api || window.ZEG?.api);
}

function render(container, api) {
  container.innerHTML = `
    <div id="hermes-control">
      <div class="stat-grid" id="hc-stats"></div>
      <div class="card">
        <div class="card-header">Hermes Sessions</div>
        <table id="hc-sessions">
          <thead>
            <tr><th>ID</th><th>Name</th><th>Model</th><th>Type</th><th>Status</th><th>Usage</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="card">
        <div class="card-header">Quick Actions</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
          <button class="btn btn-primary" onclick="hcAction('new-session')">New Session</button>
          <button class="btn btn-primary" onclick="hcAction('health-check')">Health Check</button>
          <button class="btn btn-primary" onclick="hcAction('clear-cache')">Clear Cache</button>
          <button class="btn btn-ghost" onclick="hcAction('reload-skills')">Reload Skills</button>
          <button class="btn btn-ghost" onclick="hcAction('sync-config')">Sync Config</button>
          <button class="btn btn-ghost" onclick="hcAction('export-logs')">Export Logs</button>
        </div>
      </div>
      <div class="card">
        <div class="card-header">Hermes Configuration</div>
        <div style="font-family:var(--mono);font-size:11px;white-space:pre-wrap;background:var(--panel-2);padding:12px;border-radius:var(--radius)">
          DEFAULT model: poolside/laguna-s-2.1:free
          Models: 5 free (1 Laguna + 3 OpenRouter + 1 OpenCheap)
          RPM limit: 250 aggregate
          Reasoning: xhigh
          YOLO mode: auto-approve
        </div>
      </div>
    </div>
  `;
  loadData(api);
}

async function loadData(api) {
  const data = await api.fetch('/api/hermes-control');
  if (!data) { showFallback(); return; }

  const stats = data.stats || {};
  document.getElementById('hc-stats').innerHTML = `
    <div class="stat blue"><div class="num">${stats.active_sessions || 0}</div><div class="lbl">Active Sessions</div></div>
    <div class="stat green"><div class="num">${stats.running_agents || 0}</div><div class="lbl">Running Agents</div></div>
    <div class="stat orange"><div class="num">${stats.pending_tasks || 0}</div><div class="lbl">Pending Tasks</div></div>
    <div class="stat purple"><div class="num">${stats.skills || 20}</div><div class="lbl">Loaded Skills</div></div>
    <div class="stat red"><div class="num">${stats.errors || 0}</div><div class="lbl">Errors</div></div>
  `;

  const sessions = data.sessions || [];
  const tbody = document.querySelector('#hc-sessions tbody');
  if (tbody) {
    tbody.innerHTML = sessions.map(s => `
      <tr onclick="showAgentDetail('${s.id || ''}')" style="cursor:pointer">
        <td><span style="font-family:var(--mono);font-size:11px">#${(s.session_key || s.id || '').slice(0,8)}</span></td>
        <td>${s.display_name || '—'}</td>
        <td><span style="font-family:var(--mono);font-size:11px">${(s.model || '—').slice(0, 20)}</span></td>
        <td><span class="badge ${s.type === 'agent' ? 'badge-agent' : 'badge-running'}">${s.type || '—'}</span></td>
        <td><span class="badge ${s.status === 'active' ? 'badge-ok' : 'badge-pending'}">${s.status || '—'}</span></td>
        <td>${s.tokens ? `${(s.tokens / 1000).toFixed(1)}K` : '—'}</td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="empty">No active sessions</td></tr>';
  }
}

async function hcAction(action) {
  try {
    await ZEG.api.post('/api/hermes-control/action', { action });
    await refresh();
  } catch (e) {
    console.error(e);
  }
}

window.hcAction = hcAction;

function showFallback() {
  document.getElementById('hc-stats').innerHTML =
    '<div class="stat orange"><div class="num">○○○</div><div class="lbl">API Disconnected</div></div>';
}