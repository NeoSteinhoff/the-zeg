/* ════════════════════════════════════════════════════════════
   THE ZEG — Dating View
   Dating pipeline: leads, conversations, dates, conversion funnel
   ════════════════════════════════════════════════════════════ */

import { fmtNum, fmtRelative, showLoading } from '../utils.js';

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
        <div id="funnel-bars"></div>
      </div>

      <div class="card">
        <div class="card-header">Active Leads (Due Now)</div>
        <table id="due-table">
          <thead>
            <tr><th>Name</th><th>Stage</th><th>Last Contact</th><th>Next Action</th><th>Due</th><th>Heat</th><th>Action</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-header">All Leads</div>
        <table id="leads-table">
          <thead>
            <tr><th>Name</th><th>Source</th><th>Stage</th><th>Last Contact</th><th>Messages</th><th>Heat</th><th>Rotation</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-header">Conversation Log (Recent)</div>
        <table id="convos-table">
          <thead>
            <tr><th>Date</th><th>Lead</th><th>Channel</th><th>Direction</th><th>Preview</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-header">Upcoming Dates</div>
        <table id="dates-table">
          <thead>
            <tr><th>Date</th><th>Lead</th><th>Type</th><th>Location</th><th>Status</th><th>Notes</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-header">Lever Distribution</div>
        <div id="lever-dist"></div>
      </div>
    </div>
  `;
  loadData(api);
}

async function loadData(api) {
  const data = await api.fetch('/api/dating');
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

  // Funnel bars
  const funnelBox = document.getElementById('funnel-bars');
  if (funnelBox) {
    const funnel = [
      { label: 'New Leads', value: stats.new_leads || 0, max: stats.total_leads || 1, color: 'var(--blue)' },
      { label: 'Contacted', value: stats.contacted || 0, max: stats.total_leads || 1, color: 'var(--purple)' },
      { label: 'Replied', value: stats.replied || 0, max: stats.contacted || 1, color: 'var(--good)' },
      { label: 'Dates Set', value: stats.dates_set || 0, max: stats.replied || 1, color: 'var(--warm)' },
      { label: 'Dates Completed', value: stats.dates_completed || 0, max: stats.dates_set || 1, color: 'var(--hot)' },
    ];
    funnelBox.innerHTML = funnel.map(f => {
      const pct = Math.min(100, (f.value / Math.max(1, f.max)) * 100);
      return `
        <div class="health-row" style="margin-bottom:8px">
          <span class="health-label">${f.label}</span>
          <div class="health-bar"><div class="health-fill" style="width:${pct}%;background:${f.color}"></div></div>
          <span class="health-num">${f.value} / ${f.max} (${pct.toFixed(0)}%)</span>
        </div>
      `;
    }).join('');
  }

  // Due now table
  const dueLeads = leads.filter(l => l.due_now).sort((a, b) => (b.heat || 0) - (a.heat || 0));
  const dueBody = document.querySelector('#due-table tbody');
  if (dueBody) {
    dueBody.innerHTML = dueLeads.slice(0, 15).map(l => `
      <tr>
        <td style="font-weight:500">${l.name || '—'}</td>
        <td><span class="badge ${stageBadge(l.stage)}">${l.stage || '—'}</span></td>
        <td><span style="font-family:var(--mono);font-size:11px">${fmtRelative(l.last_contact)}</span></td>
        <td style="color:var(--blue);font-size:11px">${l.next_action || '—'}</td>
        <td><span style="font-family:var(--mono);font-size:11px;color:var(--warm)">${fmtRelative(l.due)}</span></td>
        <td><div style="width:60px;background:var(--panel-2);height:6px;border-radius:99px;overflow:hidden"><div style="width:${l.heat || 0}%;height:100%;background:${heatColor(l.heat)}"></div></div></td>
        <td><button class="btn btn-primary" style="font-size:10px;padding:2px 8px" onclick="markContacted('${l.name?.replace(/'/g, "\\'")}')">✓ Done</button></td>
      </tr>
    `).join('') || '<tr><td colspan="7" class="empty">No leads due now</td></tr>';
  }

  // All leads table
  const leadsBody = document.querySelector('#leads-table tbody');
  if (leadsBody) {
    const sortedLeads = [...leads].sort((a, b) => (b.heat || 0) - (a.heat || 0));
    leadsBody.innerHTML = sortedLeads.slice(0, 30).map(l => `
      <tr>
        <td style="font-weight:500">${l.name || '—'}</td>
        <td><span class="badge ${sourceBadge(l.source)}">${l.source || '—'}</span></td>
        <td><span class="badge ${stageBadge(l.stage)}">${l.stage || '—'}</span></td>
        <td><span style="font-family:var(--mono);font-size:11px">${fmtRelative(l.last_contact)}</span></td>
        <td>${l.message_count || 0}</td>
        <td><div style="width:60px;background:var(--panel-2);height:6px;border-radius:99px;overflow:hidden"><div style="width:${l.heat || 0}%;height:100%;background:${heatColor(l.heat)}"></div></div></td>
        <td><span class="badge ${rotationBadge(l.rotation)}">${l.rotation || '—'}</span></td>
      </tr>
    `).join('') || '<tr><td colspan="7" class="empty">No leads</td></tr>';
  }

  // Conversations table
  const convosBody = document.querySelector('#convos-table tbody');
  if (convosBody) {
    convosBody.innerHTML = conversations.slice(0, 20).map(c => `
      <tr>
        <td><span style="font-family:var(--mono);font-size:11px">${fmtRelative(c.timestamp)}</span></td>
        <td>${c.lead_name || '—'}</td>
        <td><span class="badge ${channelBadge(c.channel)}">${c.channel || '—'}</span></td>
        <td><span class="badge ${c.direction === 'out' ? 'badge-running' : 'badge-ok'}">${c.direction === 'out' ? 'Sent' : 'Recv'}</span></td>
        <td style="font-size:11px;color:var(--muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.preview || '—'}</td>
      </tr>
    `).join('') || '<tr><td colspan="5" class="empty">No conversations</td></tr>';
  }

  // Dates table
  const datesBody = document.querySelector('#dates-table tbody');
  if (datesBody) {
    datesBody.innerHTML = dates.map(d => `
      <tr>
        <td><span style="font-family:var(--mono);font-size:11px">${d.scheduled_at ? new Date(d.scheduled_at).toLocaleString() : '—'}</span></td>
        <td>${d.lead_name || '—'}</td>
        <td><span class="badge ${dateTypeBadge(d.type)}">${d.type || '—'}</span></td>
        <td style="font-size:11px;color:var(--muted)">${d.location || '—'}</td>
        <td><span class="badge ${dateStatusBadge(d.status)}">${d.status || '—'}</span></td>
        <td style="font-size:11px;color:var(--muted)">${d.notes || '—'}</td>
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
          <span style="font-weight:600;font-family:var(--mono);font-size:11px">${k}</span>
          <span style="color:var(--muted);font-size:11px">${names[k] || ''}</span>
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
    refreshData();
  } catch (e) { console.error(e); }
};