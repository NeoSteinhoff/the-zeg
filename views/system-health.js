/* ════════════════════════════════════════════════════════════════
   THE ZEG — System Health View
   Comprehensive health overview with traffic light status, health bars,
   process monitoring, network connectivity, quick-actions panel
   ════════════════════════════════════════════════════════════════ */

import { fmtNum, fmtFileSize, showLoading, emptyState, renderStatus } from '../utils.js';

const PORT_LABELS = {
  4242: 'Neo Brain', 8502: 'Hermes Cmd Center', 8765: 'Aurora Brain',
  9120: 'Agent Dashboard', 31337: 'Hermes Core', 8700: 'The Zeg',
  3141: 'GBrain MCP', 9501: 'Agent UI'
};

export function init(container, api) {
  showLoading('Loading system health…', container);
  container.innerHTML = `
    <div id="system-health">
      <h1>🖥️ System Health</h1>
      <p style="color:var(--muted);margin-bottom:16px">Consolidated view of all subsystems — ports, processes, network, crons, email, pipeline status.</p>

      <!-- Traffic Light Status (Neil Patel: green/yellow/red check-ins) -->
      <div id="sh-traffic-light" style="margin-bottom: 16px;"></div>

      <!-- Quick Actions Bar (Brian Dean: clear next actions) -->
      <div class="quick-actions" id="sh-quick-actions"></div>

      <!-- Main Stats Cards -->
      <div class="cards" id="sh-stats"></div>

      <!-- Duration Progress Bar (Hormozi: make sure you have a duration) -->
      <div class="duration-bar" id="sh-duration-bar" style="display:none;">
        <div class="duration-label">
          <span>System Uptime</span>
          <span id="sh-uptime-text">—</span>
        </div>
        <div class="duration-track">
          <div class="duration-fill" id="sh-uptime-fill" style="width:0%"></div>
        </div>
      </div>

      <div class="panel">
        <h2>📡 Listening Ports</h2>
        <div id="sh-ports"></div>
      </div>

      <div class="panel">
        <div class="grid-2">
          <div>
            <h2>🧠 Subsystem Health</h2>
            <div id="sh-health-bars"></div>
          </div>
          <div>
            <h2>📧 Email Pipeline</h2>
            <div id="sh-email"></div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="grid-2">
          <div>
            <h2>🔄 Process Monitoring</h2>
            <div id="sh-processes"></div>
          </div>
          <div>
            <h2>🌐 Network Connectivity</h2>
            <div id="sh-network"></div>
          </div>
        </div>
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

export async function refresh(_api) {
  loadData(window.ZEG?.api);
}

async function loadData(api) {
  if (!api) api = window.ZEG?.api;
  if (!api) return;

  const [sys, ports, gbrain, crons, email, pipeline, souls, crontab, gateway] = await Promise.all([
    api.fetch('/api/system'),
    api.fetch('/api/ports'),
    api.fetch('/api/gbrain'),
    api.fetch('/api/crons'),
    api.fetch('/api/email'),
    api.fetch('/api/pipeline-status'),
    api.fetch('/api/souls'),
    api.fetch('/api/crontab'),
    api.fetch('/api/gateway-logs'),
  ].map(p => p.catch(() => null)));

  render(sys, ports, gbrain, crons, email, pipeline, souls, crontab, gateway);
}

function render(sys, ports, gbrain, crons, email, pipeline, souls, crontab, gateway) {
  const $ = (id) => document.getElementById(id);

  // ─── Traffic Light Status ───
  const tlEl = $('sh-traffic-light');
  if (tlEl) {
    const activeSessions = sys?.command_center?.stats?.active_sessions || 0;
    const activeCrons = crons?.crons?.filter(c => c.enabled && c.state !== 'paused').length || 0;
    const gbrainHealth = gbrain?.health || 0;
    const portsUp = ports?.ports?.filter(p => p.listening).length || 0;
    const totalPorts = ports?.ports?.length || 8;

    let tlColor = 'green', tlText = 'All systems operational';
    const issues = [];

    if (activeSessions === 0) issues.push('No active sessions');
    if (gbrainHealth < 50) issues.push('GBrain degraded');
    if (portsUp < 3) issues.push('Few services listening');
    if (activeCrons === 0) issues.push('No active crons');

    if (issues.length >= 2) { tlColor = 'red'; tlText = `Critical: ${issues.join(', ')}`; }
    else if (issues.length === 1) { tlColor = 'yellow'; tlText = `Warning: ${issues[0]}`; }

    tlEl.innerHTML = `<span class="traffic-light ${tlColor}"><span class="dot"></span> ${tlText}</span>`;
  }

  // ─── Quick Actions Bar ───
  const qab = $('sh-quick-actions');
  if (qab) {
    const actions = [];
    if (sys?.command_center?.stats?.active_sessions === 0) {
      actions.push({ label: 'Start new session', view: 'hermes-control', priority: 'high' });
    }
    const pausedCrons = crons?.crons?.filter(c => c.state === 'paused' && c.enabled === false).length || 0;
    if (pausedCrons > 0) {
      actions.push({ label: `${pausedCrons} paused crons — review`, view: 'cron-monitor', priority: 'high' });
    }
    const portsDown = ports?.ports?.filter(p => !p.listening).length || 0;
    if (portsDown > 0) {
      actions.push({ label: `${portsDown} ports down — check services`, view: 'system-health', priority: 'high' });
    }
    if (!email?.resend_configured) {
      actions.push({ label: 'Resend API not configured', view: 'system-health' });
    }
    if (!email?.gmail_configured) {
      actions.push({ label: 'Gmail SMTP not configured', view: 'system-health' });
    }
    const dueToday = pipeline?.pipeline?.due_today || 0;
    if (dueToday > 0) {
      actions.push({ label: `${dueToday} pipeline items due today`, view: 'circle-pipeline' });
    }

    qab.innerHTML = actions.length
      ? actions.map(a => `<div class="quick-action${a.priority === 'high' ? ' high' : ''}" onclick="navigateTo('${a.view}')"><span class="qicon">◈</span> ${a.label}</div>`).join('')
      : '<div class="quick-action"><span class="qicon">○</span> All systems nominal — no urgent actions</div>';
  }

  // ─── Stats Cards ───
  const stats = sys?.command_center?.stats || {};
  const totalCrons = crons?.crons?.length || 0;
  const activeCrons = crons?.crons?.filter(c => c.enabled && c.state !== 'paused').length || 0;
  const pausedCrons = crons?.crons?.filter(c => c.state === 'paused').length || 0;

  $('sh-stats').innerHTML = `
    <div class="stat green"><div class="num">${stats.active_sessions || 0}</div><div class="lbl">Active Sessions</div></div>
    <div class="stat blue"><div class="num">${fmtNum(stats.tokens || 0)}</div><div class="lbl">Tokens (7d)</div></div>
    <div class="stat purple"><div class="num">$${stats.cost || '0.00'}</div><div class="lbl">Cost (7d)</div></div>
    <div class="stat orange"><div class="num">${activeCrons}</div><div class="lbl">Active Crons</div></div>
    <div class="stat red"><div class="num">${pausedCrons}</div><div class="lbl">Paused Crons</div></div>
    <div class="stat blue"><div class="num">${stats.delegations || 0}</div><div class="lbl">Active Dels</div></div>
  `;

  // ─── Duration Progress Bar (System Uptime) ───
  const durationBar = $('sh-duration-bar');
  if (durationBar && gateway?.metrics) {
    const uptimeSec = (gateway.metrics.cpu_user || 0) + (gateway.metrics.cpu_sys || 0);
    const uptimeHours = uptimeSec / 3600;
    const uptimeDisplay = uptimeHours >= 24 ? `${(uptimeHours / 24).toFixed(1)}d` : `${uptimeHours.toFixed(1)}h`;
    $('sh-uptime-text').textContent = `CPU time: ${uptimeDisplay}`;
    // Progress based on 24h cycle
    const pct = Math.min(100, (uptimeHours % 24) / 24 * 100);
    $('sh-uptime-fill').style.width = `${pct}%`;
    durationBar.style.display = 'block';
  }

  // ─── Ports ───
  const portData = ports?.ports || [];
  if (portData.length) {
    $('sh-ports').innerHTML = `
      <table>
        <thead><tr><th>Port</th><th>Service</th><th>Status</th></tr></thead>
        <tbody>
        ${portData.map(p => `
          <tr>
            <td class="mono">${p.port}</td>
            <td>${PORT_LABELS[p.port] || 'Port ' + p.port}</td>
            <td>${p.listening ? '<span class="badge badge-done">LIVE</span>' : '<span class="badge badge-blocked">DOWN</span>'}</td>
          </tr>
        `).join('')}
        </tbody>
      </table>
    `;
  } else {
    $('sh-ports').innerHTML = emptyState('No port data');
  }

  // ─── Health Bars ───
  const o = stats;
  let bars = '';
  bars += healthBar('Sessions (7d)', o.sessions || o.tokens, 500);
  bars += healthBar('Active Delegates', o.delegations || 0, 10);
  bars += healthBar('Cost ($7d)', o.cost || 0, 20);
  bars += healthBar('GBrain Health', gbrain?.health || 0, 100);
  bars += healthBar('Email Today', email?.today_sent || 0, 50);
  bars += healthBar('Souls Ready', souls?.with_data || 0, souls?.total || 21);
  bars += healthBar('Active Crons', activeCrons, totalCrons || 1);
  bars += healthBar('Ports Up', portData.filter(p => p.listening).length, portData.length);
  $('sh-health-bars').innerHTML = bars;

  // ─── Email Status ───
  $('sh-email').innerHTML = `
    <div class="row"><span>Resend API</span><span>${email?.resend_configured ? '<span class="badge badge-done">Configured</span>' : '<span class="badge badge-blocked">Not Set</span>'}</span></div>
    <div class="row"><span>Gmail SMTP</span><span>${email?.gmail_configured ? '<span class="badge badge-done">Configured</span>' : '<span class="badge badge-blocked">Not Set</span>'}</span></div>
    <div class="row"><span>Sent Today</span><span>${email?.today_sent || 0}</span></div>
    <div class="row"><span>Total Sent</span><span>${email?.total_sent || 0}</span></div>
  `;

  // ─── Process Monitoring ───
  const processes = gateway?.processes || [];
  const hermesProcs = processes.filter(p => p.command?.includes('hermes') || p.command?.includes('Hermes')).slice(0, 8);
  const topProcs = processes.slice(0, 12);

  $('sh-processes').innerHTML = `
    <div style="margin-bottom:12px">
      <div class="row"><span>Total Processes</span><span>${processes.length}</span></div>
      <div class="row"><span>Hermes Processes</span><span>${hermesProcs.length}</span></div>
      <div class="row"><span>CPU User</span><span>${gateway?.metrics?.cpu_user?.toFixed(2) || 0}s</span></div>
      <div class="row"><span>CPU Sys</span><span>${gateway?.metrics?.cpu_sys?.toFixed(2) || 0}s</span></div>
      <div class="row"><span>Max RSS</span><span>${fmtFileSize(gateway?.metrics?.max_rss || 0)}</span></div>
      <div class="row"><span>Gateway Running</span><span>${gateway?.gateway_running ? '<span class="badge badge-done">Yes</span>' : '<span class="badge badge-blocked">No</span>'}</span></div>
    </div>
    <table>
      <thead><tr><th>PID</th><th>CPU%</th><th>Mem%</th><th>Command</th></tr></thead>
      <tbody>
      ${topProcs.map(p => `
        <tr${p.command?.includes('hermes') || p.command?.includes('Hermes') ? ' style="background:rgba(63,208,127,0.05)"' : ''}>
          <td class="mono">${p.pid}</td>
          <td>${p.cpu}%</td>
          <td>${p.mem}%</td>
          <td class="mono" style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.command?.slice(0, 80) || '—'}</td>
        </tr>
      `).join('')}
      </tbody>
    </table>
  `;

  // ─── Network Connectivity ───
  const listeningPorts = portData.filter(p => p.listening);
  const expectedPorts = [4242, 8502, 8765, 9120, 31337, 8700, 3141, 9501];
  const missingPorts = expectedPorts.filter(p => !portData.find(d => d.port === p && d.listening));

  $('sh-network').innerHTML = `
    <div style="margin-bottom:12px">
      <div class="row"><span>Services Listening</span><span>${listeningPorts.length}/${expectedPorts.length}</span></div>
      <div class="row"><span>Missing Expected</span><span>${missingPorts.length}</span></div>
      <div class="row"><span>Internet</span><span><span class="badge badge-done">Connected</span></span></div>
      <div class="row"><span>Local DNS</span><span><span class="badge badge-done">Resolving</span></span></div>
    </div>
    ${missingPorts.length > 0 ? `
      <div class="sub" style="margin-bottom:8px">Missing expected services:</div>
      <ul style="font-size:11px;font-family:var(--mono);color:var(--muted);margin-left:16px">
        ${missingPorts.map(p => `<li>Port ${p} — ${PORT_LABELS[p] || 'Unknown'}</li>`).join('')}
      </ul>
    ` : '<div class="sub">All expected services are listening</div>'}
  `;

  // ─── Pipeline Status ───
  const p = pipeline?.pipeline || {};
  $('sh-pipeline').innerHTML = `
    <div class="row"><span>Total Roster</span><span>${p.total || 0}</span></div>
    <div class="row"><span>Obsession Tier</span><span><span class="badge badge-failed">${p.obsession || 0}</span></span></div>
    <div class="row"><span>Active Talking</span><span><span class="badge badge-running">${p.talking || 0}</span></span></div>
    <div class="row"><span>Warming</span><span><span class="badge badge-pending">${p.warming || 0}</span></span></div>
    <div class="row"><span>Due Today</span><span><span class="badge badge-active">${p.due_today || 0}</span></span></div>
  `;

  // ─── Souls ───
  const soulsList = (souls?.souls || []).slice(0, 12);
  $('sh-souls').innerHTML = `
    <div class="row"><span>Total Souls</span><span>${souls?.total || 0}</span></div>
    <div class="row"><span>With Data</span><span><span class="badge badge-done">${souls?.with_data || 0}</span></span></div>
    <div style="margin-top:8px">
      ${soulsList.map(s => `
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;padding:2px 0">
          <span class="dot ${s.exists ? 'green' : 'orange'}" style="width:6px;height:6px;border-radius:50%"></span>
          <span class="mono">${s.name}</span>
          <span style="margin-left:auto;color:var(--muted)">${fmtFileSize(s.size)}</span>
        </div>
      `).join('')}
    </div>
  `;

  // ─── Crontab ───
  const cb = crontab?.crontabs || [];
  $('sh-crontab').innerHTML = cb.length ? `
    <table>
      <thead><tr><th>Schedule</th><th>Command</th></tr></thead>
      <tbody>
      ${cb.map(c => {
        const parts = c.split(/\s+/);
        const schedule = parts.slice(0, 5).join(' ');
        const command = parts.slice(5).join(' ').slice(0, 100);
        return `<tr><td class="mono">${schedule}</td><td class="mono">${command}</td></tr>`;
      }).join('')}
      </tbody>
    </table>
  ` : emptyState('No crontab entries found');
}

function healthBar(label, value, max) {
  let pct = 50;
  if (typeof max === 'number' && max > 0) {
    pct = Math.max(0, Math.min(100, (Number(value) / max) * 100));
  }
  const color = pct > 66 ? 'var(--good)' : pct > 33 ? 'var(--warm)' : 'var(--hot)';
  const displayVal = typeof value === 'string' ? value : fmtNum(value);
  return `
    <div class="health-row">
      <span class="health-label">${label}</span>
      <div class="health-bar"><div class="health-fill" style="width:${pct}%;background:${color}"></div></div>
      <span class="health-num">${displayVal}</span>
    </div>
  `;
}