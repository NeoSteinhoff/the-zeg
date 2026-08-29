/* ═══════════════════════════════════════════════════
   THE ZEG — Command Center View
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
    <div id="command-center">
      <!-- Traffic Light Status (Neil Patel) -->
      <div id="cc-traffic-light" style="margin-bottom: 8px;"></div>
      <!-- Quick Actions Bar (Brian Dean) -->
      <div class="quick-actions" id="cc-quick-actions"></div>
      <div class="stat-grid" id="cc-stats"></div>
      <div class="card">
        <div class="card-header">Token Breakdown (7d)</div>
        <div class="stat-grid" id="cc-tokens"></div>
      </div>
      <div class="card">
        <div class="card-header">Model Costs (7d)</div>
        <table id="cc-models-table">
          <thead>
            <tr><th>Model</th><th>Provider</th><th>Input</th><th>Output</th><th>Cache Read</th><th>Cache Creation</th><th>Reasoning</th><th>Sessions</th><th>Cost (USD)</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="card">
        <div class="card-header">Active Sessions</div>
        <table id="cc-sessions-table">
          <thead>
            <tr><th>ID</th><th>Name</th><th>Model</th><th>Input</th><th>Output</th><th>Cache</th><th>Source</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="stat-grid">
        <div class="stat blue"><div class="num" id="cc-skills">○</div><div class="lbl">Skills Loaded</div></div>
        <div class="stat purple"><div class="num" id="cc-profiles">○</div><div class="lbl">Profiles</div></div>
        <div class="stat green"><div class="num" id="cc-memory">○</div><div class="lbl">Memory Facts</div></div>
        <div class="stat orange"><div class="num" id="cc-gbrain">○</div><div class="lbl">GBrain Notes</div></div>
        <div class="stat blue"><div class="num" id="cc-pipelines">○</div><div class="lbl">Pipelines</div></div>
      </div>
    </div>
  `;
  loadData(api);
}

async function loadData(api) {
  // api.fetch is safe — data comes from our own API server (not user input)
  if (!api) api = window.ZEG?.api;
  if (!api) return;
  const [data, qa] = await Promise.all([api.fetch('/api/command-center'), api.fetch('/api/quick-actions')]);
  if (!data) { showFallback(); return; }

  // Quick Actions bar (Brian Dean: clear next actions)
  const qab = document.getElementById('cc-quick-actions');
  if (qab && qa) qab.innerHTML = qa.actions.map(a => '<div class="quick-action' + (a.priority === 'high' ? ' high' : '') + '" onclick="navigateTo(\'' + a.view + '\')"><span class="qicon">◈</span> ' + a.label + '</div>').join('') || '<div class="quick-action"><span class="qicon">○</span> No urgent actions</div>';

  // Traffic light status (Neil Patel style)
  const tlEl = document.getElementById('cc-traffic-light');
  if (tlEl) {
    const activeSessions = data.stats?.active_sessions || 0;
    let tlColor = 'green', tlText = 'All systems operational';
    if (activeSessions === 0) { tlColor = 'red'; tlText = 'No active sessions'; }
    else if ((data.stats?.cost || 0) > 1000) { tlColor = 'yellow'; tlText = 'High token cost alert'; }
    tlEl.innerHTML = '<span class="traffic-light ' + tlColor + '"><span class="dot"></span> ' + tlText + '</span>';
  }

  const stats = data.stats || {};

  // Main stats cards
  document.getElementById('cc-stats').innerHTML = `
    <div class="stat blue"><div class="num">${stats.active_sessions || 0}</div><div class="lbl">Active Sessions</div></div>
    <div class="stat green"><div class="num">${stats.tasks || 0}</div><div class="lbl">Pending Tasks</div></div>
    <div class="stat green"><div class="num">$${stats.cost || '0.00'}</div><div class="lbl">Cost (7d)</div></div>
    <div class="stat blue"><div class="num">${stats.tokens ? stats.tokens.toLocaleString() : 0}</div><div class="lbl">Total Tokens (7d)</div></div>
    <div class="stat purple"><div class="num">${stats.delegations || 0}</div><div class="lbl">Delegations</div></div>
  `;

  // Token breakdown
  const tb = data.token_breakdown || {
    input: stats.input_tokens_7d || 0,
    output: stats.output_tokens_7d || 0,
    cache_read: stats.cache_read_tokens_7d || 0,
    cache_creation: stats.cache_write_tokens_7d || 0,
    total: stats.tokens || 0,
  };
  document.getElementById('cc-tokens').innerHTML = `
    <div class="stat green"><div class="num">${tb.input ? tb.input.toLocaleString() : 0}</div><div class="lbl">Input</div></div>
    <div class="stat blue"><div class="num">${tb.output ? tb.output.toLocaleString() : 0}</div><div class="lbl">Output</div></div>
    <div class="stat orange"><div class="num">${tb.cache_read ? tb.cache_read.toLocaleString() : 0}</div><div class="lbl">Cache Read</div></div>
    <div class="stat purple"><div class="num">${tb.cache_creation ? tb.cache_creation.toLocaleString() : 0}</div><div class="lbl">Cache Creation</div></div>
    <div class="stat red"><div class="num">${tb.total ? tb.total.toLocaleString() : 0}</div><div class="lbl">All Tokens</div></div>
  `;

  // Hermes secondary brain
  const hermes = data.hermes || {};
  document.getElementById('cc-skills').textContent = hermes.skills || '○';
  document.getElementById('cc-profiles').textContent = (hermes.profiles || []).length || '○';
  document.getElementById('cc-memory').textContent = hermes.memory_facts || '○';
  document.getElementById('cc-gbrain').textContent = hermes.gbrain_notes || '○';
  document.getElementById('cc-pipelines').textContent = '6';

  // Model costs table
  const models = data.models || [];
  const mbody = document.querySelector('#cc-models-table tbody');
  if (mbody) {
    mbody.innerHTML = models.map(m => `
      <tr>
        <td><span style="font-family:var(--mono);font-size:11px">${(m.model || '').slice(0, 30)}</span></td>
        <td>${m.billing_provider || '—'}</td>
        <td>${m.input_tok ? (m.input_tok/1e6).toFixed(1) + 'M' : '0'}</td>
        <td>${m.output_tok ? (m.output_tok/1e6).toFixed(1) + 'M' : '0'}</td>
        <td>${m.cache_read_tok ? (m.cache_read_tok/1e6).toFixed(1) + 'M' : '0'}</td>
        <td>${m.cache_write_tok ? (m.cache_write_tok/1e6).toFixed(1) + 'M' : '0'}</td>
        <td>${m.reasoning_tok ? (m.reasoning_tok/1e3).toFixed(1) + 'K' : '0'}</td>
        <td>${m.sess_count || 0}</td>
        <td>$${(m.act_cost || 0).toFixed(2)}</td>
      </tr>
    `).join('') || '<tr><td colspan="9" class="empty">No model data</td></tr>';
  }

  // Sessions table
  const sessions = hermes.sessions || [];
  const tbody = document.querySelector('#cc-sessions-table tbody');
  if (tbody) {
    tbody.innerHTML = sessions.map(s => `
      <tr>
        <td><span style="font-family:var(--mono);font-size:11px">#${(s.session_key || s.id || '').slice(0, 8)}</span></td>
        <td>${s.display_name || '—'}</td>
        <td><span style="font-family:var(--mono);font-size:11px">${(s.model || '—').slice(0, 25)}</span></td>
        <td>${s.input_tokens ? (s.input_tokens).toLocaleString() : '0'}</td>
        <td>${s.output_tokens ? (s.output_tokens).toLocaleString() : '0'}</td>
        <td>${s.cache_read_tokens ? s.cache_read_tokens.toLocaleString() : '0'}</td>
        <td>${s.billing_provider || 'hermes'}</td>
      </tr>
    `).join('') || '<tr><td colspan="7" class="empty">No active sessions</td></tr>';
  }
}

function showFallback() {
  document.getElementById('cc-stats').innerHTML =
    '<div class="stat orange"><div class="num">○○○</div><div class="lbl">API Disconnected</div></div>';
}
