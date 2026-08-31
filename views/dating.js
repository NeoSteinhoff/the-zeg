/* ════════════════════════════════════════════════════════════
   THE ZEG — Dating View
   Dating pipeline: leads, conversations, dates, conversion funnel
   ════════════════════════════════════════════════════════════ */

import { fmtNum, fmtRelative, showLoading, escapeHtml } from '../utils.js';

export function init(container, api) {
  showLoading('Loading dating pipeline…', container);
  render(container, api);
}

export async function refresh(_api) {
  const container = document.querySelector('.main-content');
  if (container) render(container, _api || window.ZEG?.api);
}

function render(container, api) {
  container.innerHTML = `
    <div id="dating">
      <div class="stat-grid" id="dating-stats"></div>

      <div class="card">
        <div class="card-header">Pipeline Funnel</div>
        <div id="funnel-bars" role="img" aria-label="Conversion funnel bars"></div>
      </div>

      <div class="card">
        <div class="card-header">Active Leads (Due Now)</div>
        <table id="due-table" role="table" aria-label="Leads due now">
          <thead>
            <tr><th scope="col">Name</th><th scope="col">Stage</th><th scope="col">Last Contact</th><th scope="col">Next Action</th><th scope="col">Due</th><th scope="col">Heat</th><th scope="col">Action</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-header">All Leads</div>
        <table id="leads-table" role="table" aria-label="All leads sorted by heat">
          <thead>
            <tr><th scope="col">Name</th><th scope="col">Source</th><th scope="col">Stage</th><th scope="col">Last Contact</th><th scope="col">Messages</th><th scope="col">Heat</th><th scope="col">Rotation</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-header">Conversation Log (Recent)</div>
        <table id="convos-table" role="table" aria-label="Recent conversations">
          <thead>
            <tr><th scope="col">Date</th><th scope="col">Lead</th><th scope="col">Channel</th><th scope="col">Direction</th><th scope="col">Preview</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-header">Upcoming Dates</div>
        <table id="dates-table" role="table" aria-label="Upcoming dates">
          <thead>
            <tr><th scope="col">Date</th><th scope="col">Lead</th><th scope="col">Type</th><th scope="col">Location</th><th scope="col">Status</th><th scope="col">Notes</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-header">Lever Distribution</div>
        <div id="lever-dist" role="list" aria-label="Lever distribution bars"></div>
      </div>
    </div>
  `;
  loadData(api);

  // Delegated event listener for mark-done buttons (replaces inline onclick for XSS safety)
  container.addEventListener('click', e => {
    const btn = e.target.closest('.mark-done-btn');
    if (btn) {
      const name = btn.getAttribute('data-name');
      if (name) window.markContacted(name);
    }
  });
}

async function loadData(api) {
  // Try API first, fall back to local data file
  let data = null;
  try {
    data = await api.fetch('/api/dating');
  } catch (e) {
    // API not available, try local file
  }
  if (!data) {
    try {
      const resp = await fetch('../data/pipeline_data.json');
      if (resp.ok) data = await resp.json();
    } catch (e) {
      // Local file also not available
    }
  }
  if (!data) {
    showFallback();
    return;
  }

  const stats = data.stats || {};
  const leads = data.leads || [];
  const conversations = data.conversations || [];
  const dates = data.dates || [];
  const levers = data.levers || [];

  // Stats cards
  document.getElementById('dating-stats').innerHTML = `
    <div class="stat blue"><div class="num">${stats.total_leads || 0}</div><div class="lbl">Total Leads</div></div>
    <div class="stat orange"><div class="num">${stats.obsession || 0}</div><div class="lbl">Obsession Tier</div></div>
    <div class="stat green"><div class="num">${stats.active || 0}</div><div class="lbl">Active Talking</div></div>
    <div class="stat purple"><div class="num">${stats.warming || 0}</div><div class="lbl">Warming</div></div>
    <div class="stat red"><div class="num">${stats.due_today || 0}</div><div class="lbl">Due Today</div></div>
    <div class="stat yellow"><div class="num">${stats.dates_this_month || 0}</div><div class="lbl">Dates This Month</div></div>
  `;

  // Funnel bars (SVG-based trapezoid funnel with conversion rates)
  const funnelBox = document.getElementById('funnel-bars');
  if (funnelBox) {
    const funnel = [
      { label: 'New Leads', value: stats.new_leads || 0, max: stats.total_leads || 1, color: 'var(--blue)' },
      { label: 'Contacted', value: stats.contacted || 0, max: stats.new_leads || 1, color: 'var(--purple)' },
      { label: 'Replied', value: stats.replied || 0, max: stats.contacted || 1, color: 'var(--good)' },
      { label: 'Dates Set', value: stats.dates_set || 0, max: stats.replied || 1, color: 'var(--warm)' },
      { label: 'Dates Completed', value: stats.dates_completed || 0, max: stats.dates_set || 1, color: 'var(--hot)' },
    ];

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '200');
    svg.setAttribute('viewBox', '0 0 400 200');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const startY = 30;
    const stepH = 26;
    const maxWidth = 300;
    const minWidth = 60;

    funnel.forEach((f, i) => {
      const pct = Math.min(100, (f.value / Math.max(1, f.max)) * 100);
      const barWidth = minWidth + (maxWidth - minWidth) * (pct / 100);
      const y = startY + i * stepH;
      const prevPct = i > 0 ? Math.min(100, (funnel[i-1].value / Math.max(1, funnel[i-1].max)) * 100) : 100;
      const prevWidth = minWidth + (maxWidth - minWidth) * (prevPct / 100);
      const x1 = (400 - barWidth) / 2;
      const x2 = (400 - prevWidth) / 2;

      // Trapezoid polygon
      const poly = document.createElementNS(svgNS, 'polygon');
      const points = [
        x1 + ', ' + y,
        (x1 + barWidth) + ', ' + y,
        (x2 + prevWidth) + ', ' + (y + stepH),
        x2 + ', ' + (y + stepH)
      ];
      poly.setAttribute('points', points.join(' '));
      poly.style.fill = f.color;
      poly.style.opacity = '0.85';
      poly.style.stroke = 'var(--border)';
      poly.style.strokeWidth = '0.5';
      svg.appendChild(poly);

      // Value label inside bar
      if (barWidth > 40) {
        const text = document.createElementNS(svgNS, 'text');
        text.setAttribute('x', 400 / 2);
        text.setAttribute('y', y + stepH / 2 + 4);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '11');
        text.setAttribute('font-weight', 'bold');
        text.style.fill = 'var(--bg)';
        text.textContent = f.value + ' • ' + pct.toFixed(0) + '%';
        svg.appendChild(text);
      }

      // Stage label on right
      const label = document.createElementNS(svgNS, 'text');
      label.setAttribute('x', 320);
      label.setAttribute('y', y + stepH / 2 + 4);
      label.setAttribute('font-size', '11');
      label.style.fill = 'var(--fg)';
      label.textContent = f.label;
      svg.appendChild(label);

      // Conversion rate between stages
      if (i > 0) {
        const prevVal = funnel[i-1].value;
        const convRate = prevVal > 0 ? ((f.value / prevVal) * 100).toFixed(1) : '0';
        const convText = document.createElementNS(svgNS, 'text');
        convText.setAttribute('x', 320);
        convText.setAttribute('y', y - 5);
        convText.setAttribute('font-size', '9');
        convText.style.fill = 'var(--muted)';
        convText.textContent = convRate + '% \u2192';
        svg.appendChild(convText);
      }
    });

    // Glow filter
    const defs = document.createElementNS(svgNS, 'defs');
    const filter = document.createElementNS(svgNS, 'filter');
    filter.setAttribute('id', 'funnel-glow');
    const feGaussian = document.createElementNS(svgNS, 'feGaussianBlur');
    feGaussian.setAttribute('stdDeviation', '3');
    feGaussian.setAttribute('result', 'coloredBlur');
    const feMerge = document.createElementNS(svgNS, 'feMerge');
    const feMergeNode1 = document.createElementNS(svgNS, 'feMergeNode');
    feMergeNode1.setAttribute('in', 'coloredBlur');
    const feMergeNode2 = document.createElementNS(svgNS, 'feMergeNode');
    feMergeNode2.setAttribute('in', 'SourceGraphic');
    feMerge.appendChild(feMergeNode1);
    feMerge.appendChild(feMergeNode2);
    filter.appendChild(feGaussian);
    filter.appendChild(feMerge);
    defs.appendChild(filter);
    svg.appendChild(defs);

    funnelBox.innerHTML = '';
    funnelBox.appendChild(svg);
  }

  // Due now table
  const dueLeads = leads.filter(l => l.due_now).sort((a, b) => (b.heat || 0) - (a.heat || 0));
  const dueBody = document.querySelector('#due-table tbody');
  if (dueBody) {
    dueBody.innerHTML = dueLeads.slice(0, 15).map(l => `
      <tr>
        <td style="font-weight:500">${escapeHtml(l.name || '—')}</td>
        <td><span class="badge ${stageBadge(l.stage)}">${escapeHtml(l.stage || '—')}</span></td>
        <td><span style="font-family:var(--mono);font-size:11px">${fmtRelative(l.last_contact)}</span></td>
        <td style="color:var(--blue);font-size:11px">${escapeHtml(l.next_action || '—')}</td>
        <td><span style="font-family:var(--mono);font-size:11px;color:var(--warm)">${fmtRelative(l.due)}</span></td>
        <td><div style="width:60px;background:var(--panel-2);height:6px;border-radius:99px;overflow:hidden"><div style="width:${l.heat || 0}%;height:100%;background:${heatColor(l.heat)}"></div></div></td>
        <td><button class="btn btn-primary mark-done-btn" style="font-size:10px;padding:2px 8px" data-name="${escapeHtml(l.name || '')}">✓ Done</button></td>
      </tr>
    `).join('') || '<tr><td colspan="7" class="empty">No leads due now</td></tr>';
  }

  // All leads table
  const leadsBody = document.querySelector('#leads-table tbody');
  if (leadsBody) {
    const sortedLeads = [...leads].sort((a, b) => (b.heat || 0) - (a.heat || 0));
    leadsBody.innerHTML = sortedLeads.slice(0, 30).map(l => `
      <tr>
        <td style="font-weight:500">${escapeHtml(l.name || '—')}</td>
        <td><span class="badge ${sourceBadge(l.source)}">${escapeHtml(l.source || '—')}</span></td>
        <td><span class="badge ${stageBadge(l.stage)}">${escapeHtml(l.stage || '—')}</span></td>
        <td><span style="font-family:var(--mono);font-size:11px">${fmtRelative(l.last_contact)}</span></td>
        <td>${l.message_count || 0}</td>
        <td><div style="width:60px;background:var(--panel-2);height:6px;border-radius:99px;overflow:hidden"><div style="width:${l.heat || 0}%;height:100%;background:${heatColor(l.heat)}"></div></div></td>
        <td><span class="badge ${rotationBadge(l.rotation)}">${escapeHtml(l.rotation || '—')}</span></td>
      </tr>
    `).join('') || '<tr><td colspan="7" class="empty">No leads</td></tr>';
  }

  // Conversations table
  const convosBody = document.querySelector('#convos-table tbody');
  if (convosBody) {
    convosBody.innerHTML = conversations.slice(0, 20).map(c => `
      <tr>
        <td><span style="font-family:var(--mono);font-size:11px">${fmtRelative(c.timestamp)}</span></td>
        <td>${escapeHtml(c.lead_name || '—')}</td>
        <td><span class="badge ${channelBadge(c.channel)}">${escapeHtml(c.channel || '—')}</span></td>
        <td><span class="badge ${c.direction === 'out' ? 'badge-running' : 'badge-ok'}">${c.direction === 'out' ? 'Sent' : 'Recv'}</span></td>
        <td style="font-size:11px;color:var(--muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(c.preview || '—')}</td>
      </tr>
    `).join('') || '<tr><td colspan="5" class="empty">No conversations</td></tr>';
  }

  // Dates table
  const datesBody = document.querySelector('#dates-table tbody');
  if (datesBody) {
    datesBody.innerHTML = dates.map(d => `
      <tr>
        <td><span style="font-family:var(--mono);font-size:11px">${d.scheduled_at ? new Date(d.scheduled_at).toLocaleString() : '—'}</span></td>
        <td>${escapeHtml(d.lead_name || '—')}</td>
        <td><span class="badge ${dateTypeBadge(d.type)}">${escapeHtml(d.type || '—')}</span></td>
        <td style="font-size:11px;color:var(--muted)">${escapeHtml(d.location || '—')}</td>
        <td><span class="badge ${dateStatusBadge(d.status)}">${escapeHtml(d.status || '—')}</span></td>
        <td style="font-size:11px;color:var(--muted)">${escapeHtml(d.notes || '—')}</td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="empty">No upcoming dates</td></tr>';
  }

  // Lever distribution
  const leverBox = document.getElementById('lever-dist');
  if (leverBox) {
    const leverCounts = {};
    levers.forEach(l => { if (l.lever) leverCounts[l.lever] = (leverCounts[l.lever] || 0) + 1; });
    const names = { L1: 'Variable-Ratio Pullback', L2: 'Uncertainty Hook', L3: 'Comparison Anchor' };
    leverBox.innerHTML = (Object.keys(leverCounts).length
      ? Object.entries(leverCounts).map(([k, v]) => `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="font-weight:600;font-family:var(--mono);font-size:11px">${escapeHtml(k)}</span>
          <span style="color:var(--muted);font-size:11px">${escapeHtml(names[k] || '')}</span>
          <div style="flex:1;background:var(--panel-2);height:8px;border-radius:99px;overflow:hidden">
            <div style="width:${(v / Math.max(1, levers.length)) * 100}%;height:100%;background:var(--accent)"></div>
          </div>
          <span style="font-family:var(--mono);font-size:11px">${v}×</span>
        </div>
      `).join('')
      : '<div class="sub" style="padding:10px;color:var(--muted)">No lever data</div>');
  }

  // Store for window functions
  window.__datingLeads = leads;
}

function stageBadge(stage) {
  const map = { new: 'badge-pending', contacted: 'badge-running', replied: 'badge-ok', dating: 'badge-warm', date_set: 'badge-agent', date_done: 'badge-done', ghosted: 'badge-failed', archived: 'badge-blocked' };
  return map[(stage || '').toLowerCase()] || 'badge-pending';
}

function sourceBadge(source) {
  const map = { app: 'badge-agent', instagram: 'badge-running', referral: 'badge-ok', cold: 'badge-warn', event: 'badge-purple', other: 'badge-idle' };
  return map[(source || '').toLowerCase()] || 'badge-pending';
}

function rotationBadge(rot) {
  const map = { obsession: 'badge-failed', active: 'badge-ok', warming: 'badge-warm', bench: 'badge-pending', archived: 'badge-blocked' };
  return map[(rot || '').toLowerCase()] || 'badge-idle';
}

function channelBadge(ch) {
  const map = { whatsapp: 'badge-ok', instagram: 'badge-running', sms: 'badge-agent', telegram: 'badge-purple', other: 'badge-idle' };
  return map[(ch || '').toLowerCase()] || 'badge-pending';
}

function dateTypeBadge(type) {
  const map = { coffee: 'badge-ok', dinner: 'badge-warm', drinks: 'badge-running', activity: 'badge-agent', walk: 'badge-pending', other: 'badge-idle' };
  return map[(type || '').toLowerCase()] || 'badge-pending';
}

function dateStatusBadge(status) {
  const map = { scheduled: 'badge-running', confirmed: 'badge-ok', completed: 'badge-done', cancelled: 'badge-failed', rescheduled: 'badge-warn' };
  return map[(status || '').toLowerCase()] || 'badge-pending';
}

function heatColor(heat) {
  if (heat >= 85) return 'var(--hot)';
  if (heat >= 60) return 'var(--warm)';
  if (heat >= 45) return 'var(--blue)';
  return 'var(--muted)';
}

function showFallback() {
  document.getElementById('dating-stats').innerHTML =
    '<div class="stat orange"><div class="num">○○○</div><div class="lbl">API Disconnected</div></div>';
}

window.markContacted = async function(name) {
  try {
    await ZEG.api.post('/api/dating/contact', { name, action: 'mark_contacted' });
    refresh();
  } catch (e) { console.error(e); }
};