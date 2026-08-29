/* ═══════════════════════════════════════════════════
   THE ZEG — Ecosystem View
   645-agent pipeline, Telegram, AI lead automation
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
    <div id="ecosystem">
      <div class="stat-grid" id="eco-stats"></div>
      <div class="card">
        <div class="card-header">645-Agent Pipeline — Topology</div>
        <div id="eco-pipeline"></div>
      </div>
      <div class="card">
        <div class="card-header">Live Channels</div>
        <div id="eco-channels"></div>
      </div>
      <div class="card">
        <div class="card-header">Model Pool Status</div>
        <div id="eco-models"></div>
      </div>
    </div>
  `;
  loadData(api);
}

async function loadData(api) {
  const data = await api.fetch('/api/ecosystem');
  if (!data) { showFallback(); return; }

  const stats = data.stats || {};
  document.getElementById('eco-stats').innerHTML = `
    <div class="stat blue"><div class="num">${stats.total_agents || 645}</div><div class="lbl">Total Agents</div></div>
    <div class="stat green"><div class="num">${stats.active_agents || 156}</div><div class="lbl">Active</div></div>
    <div class="stat orange"><div class="num">${stats.queued || 489}</div><div class="lbl">Queued</div></div>
    <div class="stat red"><div class="num">${stats.errors || 3}</div><div class="lbl">Errors</div></div>
    <div class="stat purple"><div class="num">${stats.throughput || 0}/h</div><div class="lbl">Throughput</div></div>
  `;

  // Pipeline topology
  const pipeline = data.pipeline || [];
  const ecoPipeline = document.getElementById('eco-pipeline');
  if (ecoPipeline) {
    ecoPipeline.innerHTML = pipeline.map(stage => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <div style="background:${stage.color || 'var(--accent)'}33;border:1px solid ${stage.color || 'var(--accent)'}66;border-radius:var(--radius);padding:8px 12px;font-weight:600;font-size:12px">${stage.name}</div>
        <div style="flex:1;height:2px;background:var(--border);"></div>
        <div style="font-family:var(--mono);font-size:11px;color:var(--muted)">${stage.active || 0}/${stage.total || 0}</div>
      </div>
    `).join('') || '<div class="sub">No pipeline data</div>';
  }

  // Channels
  const channels = data.channels || [];
  const ecoChannels = document.getElementById('eco-channels');
  if (ecoChannels) {
    ecoChannels.innerHTML = channels.map(ch => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:16px">${ch.icon || '📱'}</span>
          <span>${ch.name || '—'}</span>
        </div>
        <span class="badge ${ch.status === 'online' ? 'badge-ok' : 'badge-failed'}">${ch.status || '—'}</span>
      </div>
    `).join('') || '<div class="sub">No channels</div>';
  }

  // Models
  const models = data.models || [];
  const ecoModels = document.getElementById('eco-models');
  if (ecoModels) {
    ecoModels.innerHTML = models.map(m => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
        <span style="font-family:var(--mono);font-size:11px">${m.name}</span>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="badge ${m.status === 'healthy' ? 'badge-ok' : 'badge-pending'}">${m.status}</span>
          <span style="font-size:11px;color:var(--muted)">${m.rpm || 0} RPM</span>
        </div>
      </div>
    `).join('') || '<div class="sub">No model data</div>';
  }
}

function showFallback() {
  document.getElementById('eco-stats').innerHTML =
    '<div class="stat orange"><div class="num">○○○</div><div class="lbl">API Disconnected</div></div>';
}