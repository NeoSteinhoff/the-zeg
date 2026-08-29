/* ═══════════════════════════════════════════════════
   THE ZEG — Cron Monitor View
   Shows cron job status, failures, and timing
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
    <div id="cron-monitor">
      <div class="stat-grid" id="cron-stats"></div>
      <div class="card">
        <div class="card-header">Cron Jobs <button class="btn btn-ghost" onclick="refreshCrons()" style="float:right;font-size:10px;padding:2px 6px">↻</button></div>
        <table id="cron-table">
          <thead>
            <tr><th>Name</th><th>Schedule</th><th>Status</th><th>Last Run</th><th>Last Error</th><th>Actions</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="card">
        <div class="card-header">Recent Executions</div>
        <div id="cron-recent" style="max-height:200px;overflow-y:auto"></div>
      </div>
    </div>
  `;
  loadData(api);
}

async function loadData(api) {
  const data = await api.fetch('/api/crons');
  if (!data) {
    showFallback();
    return;
  }

  const crons = data.crons || [];
  const errors = crons.filter(c => c.state === 'error' || (c.enabled && c.state !== 'running')).length;
  const active = crons.filter(c => c.enabled && c.state !== 'error').length;

  document.getElementById('cron-stats').innerHTML = `
    <div class="stat blue"><div class="num">${crons.length}</div><div class="lbl">Total Cron Jobs</div></div>
    <div class="stat green"><div class="num">${active}</div><div class="lbl">Healthy</div></div>
    <div class="stat red"><div class="num">${errors}</div><div class="lbl">Errors</div></div>
    <div class="stat orange"><div class="num">${crons.filter(c => c.completed).reduce((s, c) => s + (c.completed || 0), 0)}</div><div class="lbl">Total Execs</div></div>
    <div class="stat purple"><div class="num">${crons.filter(c => c.no_agent).length}</div><div class="lbl">Script-Only</div></div>
  `;

  const tbody = document.querySelector('#cron-table tbody');
  if (tbody) {
    tbody.innerHTML = crons.map(c => `
      <tr>
        <td><span style="font-family:var(--mono);font-size:11px">${c.name || '—'}</span></td>
        <td><span style="font-family:var(--mono);font-size:11px">${c.schedule || '—'}</span></td>
        <td><span class="badge ${c.state === 'error' ? 'badge-failed' : c.state === 'running' ? 'badge-running' : c.enabled ? 'badge-ok' : 'badge-blocked'}">${c.state || '—'}</span></td>
        <td><span style="font-family:var(--mono);font-size:11px">runs: ${c.completed || 0}</span></td>
        <td style="color:var(--muted);font-size:11px">${c.script || '—'}</td>
        <td>
          <button class="btn btn-ghost" style="font-size:9px;padding:2px 6px" onclick="repairCron('${c.name}')">Repair</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="empty">No cron jobs</td></tr>';
  }

  // Recent executions
  const execData = await api.fetch('/api/executions');
  const execBox = document.getElementById('cron-recent');
  if (execBox && execData) {
    const execs = execData.executions || [];
    execBox.innerHTML = execs.slice(0, 10).map(e => `
      <div style="display:flex;gap:8px;align-items:center;padding:4px 0;border-bottom:1px solid var(--border)">
        <span class="badge ${e.status === 'completed' ? 'badge-ok' : e.status === 'failed' ? 'badge-failed' : 'badge-running'}">${e.status || '—'}</span>
        <span style="font-family:var(--mono);font-size:11px">${e.job_name || e.job_id || '?'}</span>
        <span style="font-size:10px;color:var(--muted);margin-left:auto">${fmtTs(e.started_at)}</span>
        ${e.error ? `<span style="color:var(--hot);font-size:10px">${e.error.slice(0, 60)}</span>` : ''}
      </div>
    `).join('') || '<div class="sub" style="padding:10px">No recent executions</div>';
  }
}

function fmtTs(ts) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}

function showFallback() {
  document.getElementById('cron-stats').innerHTML =
    '<div class="stat orange"><div class="num">○○○</div><div class="lbl">API Disconnected</div></div>';
}

window.refreshCrons = async function() {
  const data = await ZEG.api.fetch('/api/crons');
  if (!data) return;
  const crons = data.crons || [];
  const tbody = document.querySelector('#cron-table tbody');
  if (tbody) {
    tbody.innerHTML = crons.map(c => `
      <tr>
        <td><span style="font-family:var(--mono);font-size:11px">${c.name || '—'}</span></td>
        <td><span style="font-family:var(--mono);font-size:11px">${c.schedule || '—'}</span></td>
        <td><span class="badge ${c.state === 'error' ? 'badge-failed' : c.state === 'running' ? 'badge-running' : c.enabled ? 'badge-ok' : 'badge-blocked'}">${c.state || '—'}</span></td>
        <td><span style="font-family:var(--mono);font-size:11px">runs: ${c.completed || 0}</span></td>
        <td style="color:var(--muted);font-size:11px">${c.script || '—'}</td>
        <td>
          <button class="btn btn-ghost" style="font-size:9px;padding:2px 6px" onclick="repairCron('${c.name}')">Repair</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="empty">No cron jobs</td></tr>';
  }
  window.dispatchEvent(new CustomEvent('cron-refreshed'));
};

window.repairCron = async function(name) {
  try {
    await ZEG.api.post('/api/hermes-control/action', { action: 'cron-repair', cron_name: name });
    console.log('Repair sent for:', name);
  } catch (e) {
    console.error(e);
  }
};
