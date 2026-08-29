/* ════════════════════════════════════════════════════════════
   THE ZEG — Agent Grid View
   Agent health grid with port status, health bars, uptime
   Features from: Aurora BusinessBrain Mission Control (agent-grid)
   ════════════════════════════════════════════════════════════ */

export function init(container, api) {
  container.innerHTML = `
    <div id="agent-grid">
      <h1>👥 Agent Grid</h1>
      <p style="color:var(--muted);margin-bottom:16px">Hermes ecosystem health — all ports and services at a glance.</p>

      <div class="cards" id="ag-stats"></div>

      <div class="panel">
        <h2>📡 Agent / Port Grid</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px" id="ag-grid"></div>
      </div>

      <div class="panel">
        <h2>📊 Port Health Bars</h2>
        <div id="ag-health-bars"></div>
      </div>
    </div>
  `;
  loadData(api);
}

export async function refresh() {
  loadData(window.ZEG?.api);
}

async function loadData(api) {
  if (!api) api = window.ZEG?.api;
  if (!api) return;

  const [portsData, sysData] = await Promise.all([
    api.fetch('/api/ports'),
    api.fetch('/api/system'),
  ].map(p => p.catch(() => null)));

  render(portsData, sysData);
}

const AGENT_INFO = {
  4242: { name: 'Neo Brain', icon: '🧠', desc: 'Central brain / LLM gateway' },
  8502: { name: 'Hermes Cmd Center', icon: '📡', desc: 'Command center API' },
  8765: { name: 'Aurora Brain', icon: '🌌', desc: 'Business brain engine' },
  9120: { name: 'Agent Dashboard', icon: '👁️', desc: 'Hermes agent UI' },
  31337: { name: 'Hermes Core', icon: '🔑', desc: 'Hermes core daemon' },
  8700: { name: 'The Zeg', icon: '○', desc: 'Unified dashboard API' },
  3141: { name: 'GBrain MCP', icon: '🔗', desc: 'Memory / vector MCP' },
  9501: { name: 'Agent UI', icon: '🖥️', desc: 'Agent web interface' },
};

function render(portsData, sysData) {
  const el = (id) => document.getElementById(id);
  const ports = portsData?.ports || [];

  const upCount = ports.filter(p => p.listening).length;
  const downCount = ports.length - upCount;
  const o = sysData?.command_center?.stats || {};

  // Stats cards
  el('ag-stats').innerHTML = `
    <div class="stat green"><div class="num">${upCount}</div><div class="lbl">Ports Up</div></div>
    <div class="stat red"><div class="num">${downCount}</div><div class="lbl">Ports Down</div></div>
    <div class="stat blue"><div class="num">${o.active_sessions || 0}</div><div class="lbl">Active Sessions</div></div>
    <div class="stat orange"><div class="num">${fmtNum(o.tokens || 0)}</div><div class="lbl">Tokens (7d)</div></div>
    <div class="stat purple"><div class="num">${o.delegations || o.active_delegations || 0}</div><div class="lbl">Active Dels</div></div>
  `;

  // Agent grid
  el('ag-grid').innerHTML = ports.map(p => {
    const info = AGENT_INFO[p.port] || { name: `Port ${p.port}`, icon: '○', desc: '' };
    const statusClass = p.listening ? 'badge-done' : 'badge-blocked';
    const statusText = p.listening ? 'ONLINE' : 'OFFLINE';
    const dotClass = p.listening ? 'green' : 'red';
    return `
      <div class="card" style="text-align:center;padding:12px">
        <div style="font-size:24px;margin-bottom:6px">${info.icon}</div>
        <div style="font-weight:600;font-size:12px">${info.name}</div>
        <div class="mono" style="font-size:11px;color:var(--muted)">port ${p.port}</div>
        <div style="margin-top:6px">
          <span class="dot ${dotClass}" style="width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:4px"></span>
          <span class="badge ${statusClass}">${statusText}</span>
        </div>
        <div style="font-size:9px;color:var(--muted);margin-top:4px">${info.desc}</div>
      </div>
    `;
  }).join('');

  // Health bars
  let bars = '';
  ports.forEach(p => {
    const info = AGENT_INFO[p.port] || { name: `Port ${p.port}` };
    const pct = p.listening ? 100 : 0;
    const color = p.listening ? 'var(--good)' : 'var(--hot)';
    bars += `
      <div class="health-row">
        <span class="health-label">${info.icon} ${info.name}</span>
        <div class="health-bar"><div class="health-fill" style="width:${pct}%;background:${color}"></div></div>
        <span class="health-num">${p.listening ? 'UP' : 'DOWN'}</span>
      </div>
    `;
  });
  el('ag-health-bars').innerHTML = bars;
}

function fmtNum(n) {
  n = Number(n);
  if (n >= 1e9) return (n/1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
  return String(n);
}
