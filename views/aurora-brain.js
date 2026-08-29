/* ═══════════════════════════════════════════════════
   THE ZEG — Aurora Brain View
   AI lead automation for Dubai real estate agents
   ═══════════════════════════════════════════════════ */

export function init(container, api) {
  render(container, api);
}

export async function refresh() {
  const container = document.querySelector('.main-content');
  if (container) render(container, ZEG.api);
}

function render(container, api) {
  container.innerHTML = `
    <div id="aurora-brain">
      <div class="stat-grid" id="aurora-stats"></div>
      <div class="card">
        <div class="card-header">AI Lead Automation Engine</div>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <input type="text" id="aurora-prompt" style="flex:1;background:var(--panel);border:1px solid var(--border);color:var(--fg);padding:8px;border-radius:var(--radius);font-family:inherit;font-size:13px" placeholder="Ask Aurora about real estate leads...">
          <button class="btn btn-primary" onclick="sendToAurora()">Send</button>
        </div>
        <div id="aurora-response" style="min-height:250px;background:var(--panel-2);border-radius:var(--radius);padding:16px;font-size:14px;line-height:1.6"></div>
      </div>
      <div class="card">
        <div class="card-header">Recent Lead Actions</div>
        <div style="max-height:300px;overflow-y:auto">
          <table id="aurora-actions">
            <thead>
              <tr><th>Time</th><th>Agent</th><th>Action</th><th>Target</th><th>Result</th></tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  loadData(api);
}

async function loadData(api) {
  const data = await api.fetch('/api/aurora-brain');
  if (!data) { showFallback(); return; }

  const stats = data.stats || {};
  document.getElementById('aurora-stats').innerHTML = `
    <div class="stat blue"><div class="num">${stats.total_agents || 645}</div><div class="lbl">AI Agents</div></div>
    <div class="stat green"><div class="num">${stats.leads_processed || 0}</div><div class="lbl">Leads Processed</div></div>
    <div class="stat orange"><div class="num">${stats.conversions || 0}</div><div class="lbl">Conversions</div></div>
    <div class="stat purple"><div class="num">${stats.revenue_aed ? `AED ${stats.revenue_aed.toLocaleString()}` : 'AED 0'}</div><div class="lbl">Revenue</div></div>
    <div class="stat red"><div class="num">${stats.pipeline_stages || 5}</div><div class="lbl">Pipeline Stages</div></div>
  `;

  // Actions table
  const actions = data.recent_actions || [];
  const tbody = document.querySelector('#aurora-actions tbody');
  if (tbody) {
    tbody.innerHTML = actions.map(a => `
      <tr>
        <td><span style="font-family:var(--mono);font-size:11px">${a.timestamp || '—'}</span></td>
        <td><span style="font-weight:500">${a.agent || 'aurora'}</span></td>
        <td><span class="badge badge-agent">${a.action || '—'}</span></td>
        <td>${a.target || '—'}</td>
        <td><span class="badge ${a.result === 'success' ? 'badge-ok' : a.result === 'failed' ? 'badge-failed' : 'badge-running'}">${a.result || '—'}</span></td>
      </tr>
    `).join('') || '<tr><td colspan="5" class="empty">No actions yet</td></tr>';
  }
}

async function sendToAurora() {
  const promptEl = document.getElementById('aurora-prompt');
  const respEl = document.getElementById('aurora-response');
  if (!promptEl.value.trim()) return;

  const query = promptEl.value;
  respEl.innerHTML = '<div style="color:var(--muted)">Aurora is analyzing... 🤖</div>';

  try {
    const result = await ZEG.api.fetch(`/api/aurora-brains?q=${encodeURIComponent(query)}`);
    if (result && result.response) {
      respEl.innerHTML = `<div>${result.response}</div>`;
    } else {
      respEl.innerHTML = `<div style="color:var(--muted)">[Offline] Aurora processes: "${query}"</div>`;
    }
  } catch (e) {
    respEl.innerHTML = `<div style="color:var(--muted)">[Error] ${e.message}</div>`;
  }
}

window.sendToAurora = sendToAurora;

function showFallback() {
  document.getElementById('aurora-stats').innerHTML =
    '<div class="stat orange"><div class="num">○○○</div><div class="lbl">API Disconnected</div></div>';
}