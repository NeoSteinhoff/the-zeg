/* ═══════════════════════════════════════════════════
   THE ZEG — Timeline View
   Chronological feed of all activities and events
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
    <div id="timeline">
      <div class="card">
        <div class="card-header">Activity Feed</div>
        <div id="timeline-feed" style="max-height:500px;overflow-y:auto"></div>
      </div>
      <div class="card">
        <div class="card-header">Goal Tracker (Aug 28 → Sep 6)</div>
        <div id="timeline-goal-tracker"></div>
      </div>
      <div class="stat-grid" id="timeline-stats"></div>
    </div>
  `;

  loadData(api);
}

async function loadData(api) {
  const data = await api.fetch('/api/timeline');
  if (!data) {
    showFallback();
    return;
  }

  const events = data.events || [];
  const goals = data.goals || [];

  // Stats
  document.getElementById('timeline-stats').innerHTML = `
    <div class="stat blue"><div class="num">${events.length}</div><div class="lbl">Events Logged</div></div>
    <div class="stat green"><div class="num">${goals.filter(g => g.done).length}</div><div class="lbl">Goals Achieved</div></div>
    <div class="stat orange"><div class="num">${goals.filter(g => !g.done).length}</div><div class="lbl">In Progress</div></div>
    <div class="stat purple"><div class="num">${data.total_aed ? `AED ${data.total_aed.toLocaleString()}` : 0}</div><div class="lbl">Revenue</div></div>
  `;

  // Feed
  const feed = document.getElementById('timeline-feed');
  if (feed) {
    feed.innerHTML = events.map(e => `
      <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="font-family:var(--mono);font-size:11px;color:var(--muted);width:120px;flex-shrink:0">${e.timestamp || '—'}</div>
        <div style="width:100%">
          <div style="font-weight:500">${e.title || 'Event'}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">${e.description || ''}</div>
          ${e.amount ? `<div style="font-size:11px;color:var(--blue);margin-top:4px">AED ${e.amount.toLocaleString()}</div>` : ''}
        </div>
        <div style="flex-shrink:0">
          <span class="badge ${e.type === 'success' ? 'badge-ok' : e.type === 'warning' ? 'badge-pending' : e.type === 'revenue' ? 'badge-agent' : 'badge-running'}">${e.type || '—'}</span>
        </div>
      </div>
    `).join('') || '<div class="sub" style="padding:10px">No events yet</div>';
  }

  // Goal tracker
  const tracker = document.getElementById('timeline-goal-tracker');
  if (tracker) {
    const startDate = new Date('2026-08-28');
    const endDate = new Date('2026-09-06');
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const today = new Date();
    const elapsed = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24));
    const pct = Math.round((elapsed / totalDays) * 100);

    tracker.innerHTML = `
      <div style="margin:10px 0;font-size:11px;color:var(--muted)">Days ${elapsed}/${totalDays} · AED ${data.total_aed?.toLocaleString() || 0}/${data.goal_aed || 50000}</div>
      <div style="height:20px;background:var(--panel-2);border-radius:99px;overflow:hidden">
        <div style="height:100%;background:linear-gradient(90deg,var(--accent),var(--blue));width:${pct}%;transition:width 1s"></div>
      </div>
      <div style="margin-top:12px">
        ${goals.map(g => `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <input type="checkbox" ${g.done ? 'checked' : ''} style="accent-color:var(--accent)" onchange="toggleGoal('${g.id}')">
            <span style="${g.done ? 'text-decoration:line-through' : ''}color:var(--muted)">${g.title}</span>
            <span class="badge ${g.done ? 'badge-ok' : 'badge-pending'}">${g.done ? 'done' : 'todo'}</span>
          </div>
        `).join('')}
      </div>
    `;
  }
}

function showFallback() {
  document.getElementById('timeline-stats').innerHTML =
    '<div class="stat orange"><div class="num">○○○</div><div class="lbl">API Disconnected</div></div>';
}

window.toggleGoal = function(id) {
  // Local toggle
  const cb = document.querySelector(`input[onchange*="${id}"]`);
  if (cb) {
    const span = cb.nextElementSibling;
    if (cb.checked) {
      span.style.textDecoration = 'line-through';
    } else {
      span.style.textDecoration = 'none';
    }
  }
};