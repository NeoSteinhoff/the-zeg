/* ═══════════════════════════════════════════════════
   THE ZEG — Cost & Models View
   Dedicated cost breakdown by model with full token info
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
    <div id="cost-models-view">
      <div class="stat-grid" id="cm-stats"></div>
      <div class="card">
        <div class="card-header">Cost Breakdown by Model (7d)</div>
        <table id="cm-costs-table">
          <thead>
            <tr><th>Model</th><th>Provider</th><th>Input</th><th>Output</th><th>Cache Read</th><th>Cache Write</th><th>Reasoning</th><th>Est Cost</th><th>Act Cost</th><th>Sessions</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="card">
        <div class="card-header">Total Model Usage (all-time)</div>
        <table id="cm-models-table">
          <thead>
            <tr><th>Model</th><th>Provider</th><th>Total Input</th><th>Total Output</th><th>Total Cost</th><th>Sessions</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  `;
  loadData(api);
}

async function loadData(api) {
  const [costsData, modelsData] = await Promise.all([
    api.fetch('/api/costs'),
    api.fetch('/api/models'),
  ]);

  if (!costsData && !modelsData) {
    showFallback();
    return;
  }

  const costs = costsData || [];
  const models = modelsData || [];

  // Stats summary
  const totalEstCost = costs.reduce((s, c) => s + (c.est_cost || 0), 0);
  const totalActCost = costs.reduce((s, c) => s + (c.act_cost || 0), 0);
  const totalSessions = models.reduce((s, m) => s + (m.sess_count || 0), 0);

  document.getElementById('cm-stats').innerHTML = `
    <div class="stat blue"><div class="num">$${totalEstCost.toFixed(2)}</div><div class="lbl">Total Est Cost (7d)</div></div>
    <div class="stat green"><div class="num">$${totalActCost.toFixed(2)}</div><div class="lbl">Total Act Cost (7d)</div></div>
    <div class="stat purple"><div class="num">${costs.length}</div><div class="lbl">Models (7d)</div></div>
    <div class="stat orange"><div class="num">${fmtNum(totalSessions)}</div><div class="lbl">Sessions</div></div>
  `;

  // Costs table
  const costsBody = document.querySelector('#cm-costs-table tbody');
  if (costsBody) {
    costsBody.innerHTML = costs.map(c => `
      <tr>
        <td><span style="font-family:var(--mono);font-size:11px">${(c.model || '').slice(0, 30)}</span></td>
        <td>${c.billing_provider || '—'}</td>
        <td>${fmtNum(c.input_tok)}</td>
        <td>${fmtNum(c.output_tok)}</td>
        <td>${fmtNum(c.cache_read_tok)}</td>
        <td>${fmtNum(c.cache_write_tok)}</td>
        <td>${fmtNum(c.reasoning_tok)}</td>
        <td>$${((c.est_cost || 0).toFixed(2)}</td>
        <td>$${(c.act_cost || 0).toFixed(2)}</td>
        <td>${c.sess_count || 0}</td>
      </tr>
    `).join('') || '<tr><td colspan="10" class="empty">No cost data</td></tr>';
  }

  // Models table (all-time)
  const modelsBody = document.querySelector('#cm-models-table tbody');
  if (modelsBody) {
    modelsBody.innerHTML = models.map(m => `
      <tr>
        <td><span style="font-family:var(--mono);font-size:11px">${(m.model || '').slice(0, 30)}</span></td>
        <td>${m.billing_provider || '—'}</td>
        <td>${fmtNum(m.total_in)}</td>
        <td>${fmtNum(m.total_out)}</td>
        <td>$${(m.total_cost || 0).toFixed(2)}</td>
        <td>${m.sess_count || 0}</td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="empty">No model data</td></tr>';
  }
}

function fmtNum(n) {
  if (n == null) return '0';
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

function showFallback() {
  document.getElementById('cm-stats').innerHTML =
    '<div class="stat orange"><div class="num">○○○</div><div class="lbl">API Disconnected</div></div>';
}
