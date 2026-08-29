/* ════════════════════════════════════════════════════════════
   THE ZEG — System Health View
   Consolidated overview of ALL subsystem statuses
   Features from: Hermes Command Center + Super Dashboard API
   ════════════════════════════════════════════════════════════ */

export function init(container, api) {
  container.innerHTML = `
    <div id="system-health">
      <h1>🖥️ System Health</h1>
      <p style="color:var(--muted);margin-bottom:16px">Consolidated view of all subsystems — ports, gbrain, crons, email, pipeline, souls.</p>

      <div class="cards" id="sh-stats"></div>

      <div class="panel">
        <h2>📡 Listening Ports</h2>
        <div id="sh-ports"></div>
      </div>

      <div class="panel">
        <h2>🧠 Subsystem Health</h2>
        <div id="sh-health-bars"></div>
      </div>

      <div class="panel">
        <h2>📧 Email Pipeline</h2>
        <div id="sh-email"></div>
      </div>

      <div class="panel">
        <h2>👥 Dating Pipeline</h2>
        <div id="sh-pipeline"></div>
      </div>

      <div class="panel">
        <h2>🧬 Souls Engine</h2>
        <div id="sh-souls"></div>
      </div>

      <div class="panel">
        <h2>🕒 System Crontab</h2>
        <div id="sh-crontab"></div>
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

  const [sys, ports, gbrain, email, pipeline, souls, crontab, crons] = await Promise.all([
    api.fetch('/api/system'),
    api.fetch('/api/ports'),
    api.fetch('/api/gbrain'),
    api.fetch('/api/email'),
    api.fetch('/api/pipeline-status'),
    api.fetch('/api/souls'),
    api.fetch('/api/crontab'),
    api.fetch('/api/crons'),
  ].map(p => p.catch(() => null)));

  render(sys, ports, gbrain, email, pipeline, souls, crontab, crons);
}

function render(sys, ports, gbrain, email, pipeline, souls, crontab, crons) {
  const el = (id) => document.getElementById(id);

  // ─── Stats Cards ───
  const o = sys?.command_center?.stats || sys?.stats || {};
  el('sh-stats').innerHTML = `
    <div class="stat green"><div class="num">${o.active_sessions || 0}</div><div class="lbl">Active Sessions</div></div>
    <div class="stat blue"><div class="num">${fmtNum(o.tokens || 0)}</div><div class="lbl">Tokens (7d)</div></div>
    <div class="stat purple"><div class="num">$${o.cost || '0.00'}</div><div class="lbl">Cost (7d)</div></div>
    <div class="stat red"><div class="num">${(crons || []).length}</div><div class="lbl">Cron Jobs</div></div>
    <div class="stat orange"><div class="num">${ports?.ports?.filter(p=>p.listening).length || 0}/${(ports?.ports||[]).length}</div><div class="lbl">Ports Up</div></div>
  `;

  // ─── Ports ───
  const portData = ports?.ports || [];
  const portLabels = {
    4242: 'Neo Brain', 8502: 'Hermes Cmd Center', 8765: 'Aurora Brain',
    9120: 'Agent Dashboard', 31337: 'Hermes Core', 8700: 'The Zeg',
    3141: 'GBrain MCP', 9501: 'Agent UI'
  };
  if (portData.length) {
    el('sh-ports').innerHTML = `
      <table>
        <thead><tr><th>Port</th><th>Service</th><th>Status</th></tr></thead>
        <tbody>
        ${portData.map(p => `
          <tr>
            <td class="mono">${p.port}</td>
            <td>${portLabels[p.port] || 'Port ' + p.port}</td>
            <td>${p.listening ? '<span class="badge badge-done">LIVE</span>' : '<span class="badge badge-blocked">DOWN</span>'}</td>
          </tr>
        `).join('')}
        </tbody>
      </table>
    `;
  } else {
    el('sh-ports').innerHTML = '<span class="sub">No port data</span>';
  }

  // ─── Health Bars ───
  const totalSessions = (o.sessions_7d || 0) + (o.active_sessions || 0) + 1;
  let bars = '';
  bars += healthBar('Sessions (7d)', o.sessions_7d || 0, totalSessions * 50);
  bars += healthBar('Tokens (7d)', fmtNum(o.tokens || 0), '500B');
  bars += healthBar('Cost ($7d)', `$${o.cost || '0'}`, '$20');
  bars += healthBar('GBrain Health', gbrain?.health || 0, 100);
  bars += healthBar('Email Today', email?.today_sent || 0, 50);
  bars += healthBar('Souls', souls?.with_data || 0, souls?.total || 21);
  el('sh-health-bars').innerHTML = bars;

  // ─── Email Status ───
  el('sh-email').innerHTML = `
    <div class="row">
      <span>Resend API</span>
      <span>${email?.resend_configured ? '<span class="badge badge-done">Configured</span>' : '<span class="badge badge-blocked">Not Set</span>'}</span>
    </div>
    <div class="row">
      <span>Gmail SMTP</span>
      <span>${email?.gmail_configured ? '<span class="badge badge-done">Configured</span>' : '<span class="badge badge-blocked">Not Set</span>'}</span>
    </div>
    <div class="row">
      <span>Sent Today</span>
      <span>${email?.today_sent || 0}</span>
    </div>
    <div class="row">
      <span>Total Sent</span>
      <span>${email?.total_sent || 0}</span>
    </div>
  `;

  // ─── Pipeline Status ───
  const p = pipeline?.pipeline || {};
  el('sh-pipeline').innerHTML = `
    <div class="row"><span>Total Roster</span><span>${p.total || 0}</span></div>
    <div class="row"><span>Obsession Tier</span><span><span class="badge badge-failed">${p.obsession || 0}</span></span></div>
    <div class="row"><span>Active Talking</span><span><span class="badge badge-running">${p.talking || 0}</span></span></div>
    <div class="row"><span>Warming</span><span><span class="badge badge-pending">${p.warming || 0}</span></span></div>
    <div class="row"><span>Due Today</span><span><span class="badge badge-active">${p.due_today || 0}</span></span></div>
  `;

  // ─── Souls ───
  el('sh-souls').innerHTML = `
    <div class="row"><span>Total Souls</span><span>${souls?.total || 0}</span></div>
    <div class="row"><span>With Data</span><span><span class="badge badge-done">${souls?.with_data || 0}</span></span></div>
    <div style="margin-top:8px">
      ${(souls?.souls || []).slice(0,12).map(s => `
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;padding:2px 0">
          <span class="dot ${s.exists ? 'badge-done' : 'badge-pending'}" style="width:6px;height:6px;border-radius:50%"></span>
          <span style="font-family:var(--mono)">${s.name}</span>
          <span style="margin-left:auto;color:var(--muted)">${s.size > 1000 ? `${(s.size/1000).toFixed(1)}K` : s.size}</span>
        </div>
      `).join('')}
    </div>
  `;

  // ─── Crontab ───
  const cb = crontab?.crontabs || [];
  el('sh-crontab').innerHTML = cb.length ? `
    <table>
      <thead><tr><th>Schedule</th><th>Command</th></tr></thead>
      <tbody>
      ${cb.map(c => `<tr><td class="mono">${c.split(' ')[0]}</td><td class="mono">${c.split(' ').slice(5).join(' ').slice(0,80)}</td></tr>`).join('')}
      </tbody>
    </table>
  ` : '<span class="sub">No crontab entries found</span>';
}

function fmtNum(n) {
  n = Number(n);
  if (n >= 1e9) return (n/1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
  return String(n);
}

function healthBar(label, value, max) {
  // Determine percentage
  let pct = 50;
  let displayVal = value;
  if (typeof max === 'number' && max > 0) {
    pct = Math.max(0, Math.min(100, (Number(value) / max) * 100));
    displayVal = fmtNum(value);
  }
  const color = pct > 66 ? 'var(--good)' : pct > 33 ? 'var(--warm)' : 'var(--hot)';
  return `
    <div class="health-row">
      <span class="health-label">${label}</span>
      <div class="health-bar"><div class="health-fill" style="width:${pct}%;background:${color}"></div></div>
      <span class="health-num">${displayVal}</span>
    </div>
  `;
}
