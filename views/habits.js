/* ════════════════════════════════════════════════════════════
   THE ZEG — Habits View
   Habit tracking: streaks, completion rates, categories, insights
   ════════════════════════════════════════════════════════════ */

import { fmtNum, fmtRelative, showLoading } from '../utils.js';

export function init(container, api) {
  showLoading('Loading habits…', container);
  render(container, api);
}

export async function refresh(_api) {
  const container = document.querySelector('.main-content');
  if (container) render(container, _api || window.ZEG?.api);
}

function render(container, api) {
  container.innerHTML = `
    <div id="habits">
      <div class="stat-grid" id="habits-stats"></div>

      <div class="card">
        <div class="card-header">Habits Due Today</div>
        <table id="due-habits-table">
          <thead>
            <tr><th>Habit</th><th>Category</th><th>Frequency</th><th>Streak</th><th>Best</th><th>Done Today</th><th>Action</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-header">All Habits</div>
        <table id="all-habits-table">
          <thead>
            <tr><th>Habit</th><th>Category</th><th>Schedule</th><th>Current Streak</th><th>Longest Streak</th><th>Completion (30d)</th><th>Total</th><th>Status</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-header">Weekly Completion Heatmap</div>
        <div id="heatmap"></div>
      </div>

      <div class="card">
        <div class="card-header">Category Breakdown</div>
        <div id="category-bars"></div>
      </div>

      <div class="card">
        <div class="card-header">Recent Completions</div>
        <table id="completions-table">
          <thead>
            <tr><th>Time</th><th>Habit</th><th>Category</th><th>Value</th><th>Notes</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-header">Habit Insights</div>
        <div id="insights"></div>
      </div>
    </div>
  `;
  loadData(api);
}

async function loadData(api) {
  const data = await api.fetch('/api/habits');
  if (!data) {
    showFallback();
    return;
  }

  const stats = data.stats || {};
  const habits = data.habits || [];
  const completions = data.completions || [];
  const heatmapData = data.heatmap || [];
  const categories = data.categories || [];
  const insights = data.insights || [];

  // Stats cards
  document.getElementById('habits-stats').innerHTML = `
    <div class="stat green"><div class="num">${stats.due_today || 0}</div><div class="lbl">Due Today</div></div>
    <div class="stat blue"><div class="num">${stats.completed_today || 0}</div><div class="lbl">Done Today</div></div>
    <div class="stat orange"><div class="num">${((stats.today_rate || 0) * 100).toFixed(0)}%</div><div class="lbl">Today Rate</div></div>
    <div class="stat purple"><div class="num">${stats.active_habits || 0}</div><div class="lbl">Active Habits</div></div>
    <div class="stat red"><div class="num">${stats.longest_streak || 0}</div><div class="lbl">Longest Streak</div></div>
    <div class="stat yellow"><div class="num">${((stats.monthly_rate || 0) * 100).toFixed(0)}%</div><div class="lbl">30-Day Rate</div></div>
  `;

  // Due today table
  const dueToday = habits.filter(h => h.due_today);
  const dueBody = document.querySelector('#due-habits-table tbody');
  if (dueBody) {
    dueBody.innerHTML = dueToday.map(h => `
      <tr>
        <td style="font-weight:500">${h.name || '—'}</td>
        <td><span class="badge ${catBadge(h.category)}">${h.category || '—'}</span></td>
        <td>${h.frequency || '—'}</td>
        <td><span style="font-family:var(--mono);font-weight:600;color:var(--hot)">${h.current_streak || 0}</span></td>
        <td>${h.longest_streak || 0}</td>
        <td><span class="badge ${h.done_today ? 'badge-ok' : 'badge-pending'}">${h.done_today ? '✓ Done' : 'Pending'}</span></td>
        <td>
          ${!h.done_today
            ? `<button class="btn btn-primary" style="font-size:10px;padding:2px 8px" onclick="completeHabit('${h.name?.replace(/'/g, "\\'")}')">Complete</button>`
            : '<span style="color:var(--muted);font-size:11px">✓</span>'}
        </td>
      </tr>
    `).join('') || '<tr><td colspan="7" class="empty">No habits due today</td></tr>';
  }

  // All habits table
  const allBody = document.querySelector('#all-habits-table tbody');
  if (allBody) {
    const sorted = [...habits].sort((a, b) => (b.current_streak || 0) - (a.current_streak || 0));
    allBody.innerHTML = sorted.map(h => `
      <tr>
        <td style="font-weight:500">${h.name || '—'}</td>
        <td><span class="badge ${catBadge(h.category)}">${h.category || '—'}</span></td>
        <td style="font-size:11px">${h.schedule || '—'}</td>
        <td><span style="font-family:var(--mono);font-weight:600;color:${(h.current_streak || 0) > 7 ? 'var(--good)' : 'var(--muted)'}">${h.current_streak || 0}</span></td>
        <td>${h.longest_streak || 0}</td>
        <td>
          <div style="width:80px;background:var(--panel-2);height:6px;border-radius:99px;overflow:hidden">
            <div style="width:${Math.min(100, (h.completion_rate_30d || 0) * 100)}%;height:100%;background:${completionColor(h.completion_rate_30d)}"></div>
          </div>
          <span style="font-family:var(--mono);font-size:11px;margin-left:6px">${((h.completion_rate_30d || 0) * 100).toFixed(0)}%</span>
        </td>
        <td>${h.total_completions || 0}</td>
        <td><span class="badge ${h.active ? 'badge-ok' : 'badge-blocked'}">${h.active ? 'Active' : 'Paused'}</span></td>
      </tr>
    `).join('') || '<tr><td colspan="8" class="empty">No habits tracked</td></tr>';
  }

  // Heatmap (last 8 weeks)
  const hmBox = document.getElementById('heatmap');
  if (hmBox) {
    const weeks = heatmapData.slice(-8);
    hmBox.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">
        ${weeks.map(w => `
          <div style="background:var(--panel-2);border-radius:var(--radius);padding:10px">
            <div style="font-weight:600;font-size:11px;margin-bottom:8px;color:var(--muted)">${w.week || '—'}</div>
            <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">
              ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d, i) => {
                const day = w.days?.[i] || { done: 0, total: 0 };
                const pct = day.total ? day.done / day.total : 0;
                const bg = pct === 1 ? 'var(--good)' : pct >= 0.5 ? 'var(--warm)' : pct > 0 ? 'var(--blue)' : 'var(--panel-3)';
                return `<div style="aspect-ratio:1;background:${bg};border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;font-family:var(--mono);color:${pct > 0 ? 'white' : 'transparent'}">${day.done}/${day.total}</div>`;
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Category bars
  const catBox = document.getElementById('category-bars');
  if (catBox) {
    catBox.innerHTML = categories.map(c => {
      const pct = c.total ? (c.completed / c.total) * 100 : 0;
      return `
        <div class="health-row" style="margin-bottom:8px">
          <span class="health-label"><span class="badge ${catBadge(c.name)}">${c.name}</span></span>
          <div class="health-bar"><div class="health-fill" style="width:${Math.min(100, pct)}%;background:var(--good)"></div></div>
          <span class="health-num">${c.completed} / ${c.total} (${pct.toFixed(0)}%)</span>
        </div>
      `;
    }).join('') || '<div class="sub" style="padding:10px;color:var(--muted)">No category data</div>';
  }

  // Recent completions
  const compBody = document.querySelector('#completions-table tbody');
  if (compBody) {
    compBody.innerHTML = completions.slice(0, 20).map(c => `
      <tr>
        <td><span style="font-family:var(--mono);font-size:11px">${fmtRelative(c.timestamp)}</span></td>
        <td style="font-weight:500">${c.habit_name || '—'}</td>
        <td><span class="badge ${catBadge(c.category)}">${c.category || '—'}</span></td>
        <td style="font-family:var(--mono)">${c.value || 1}</td>
        <td style="font-size:11px;color:var(--muted)">${c.notes || '—'}</td>
      </tr>
    `).join('') || '<tr><td colspan="5" class="empty">No recent completions</td></tr>';
  }

  // Insights
  const insBox = document.getElementById('insights');
  if (insBox) {
    insBox.innerHTML = insights.length
      ? insights.map(i => `
        <div style="background:var(--panel-2);border-radius:var(--radius);padding:12px;margin-bottom:8px;border-left:3px solid ${insightColor(i.type)}">
          <div style="font-weight:600;margin-bottom:4px">${i.title}</div>
          <div style="font-size:12px;color:var(--muted)">${i.description}</div>
          ${i.metric ? `<div style="margin-top:6px;font-family:var(--mono);font-size:11px;color:${insightColor(i.type)}">${i.metric}</div>` : ''}
        </div>
      `).join('')
      : '<div class="sub" style="padding:10px;color:var(--muted)">No insights yet — complete more habits!</div>';
  }
}

function catBadge(cat) {
  const map = { health: 'badge-ok', fitness: 'badge-running', learning: 'badge-agent', productivity: 'badge-purple', mindfulness: 'badge-warm', social: 'badge-pending', other: 'badge-idle' };
  return map[(cat || '').toLowerCase()] || 'badge-pending';
}

function completionColor(rate) {
  if (rate >= 0.9) return 'var(--good)';
  if (rate >= 0.7) return 'var(--blue)';
  if (rate >= 0.5) return 'var(--warm)';
  return 'var(--hot)';
}

function insightColor(type) {
  const map = { streak: 'var(--hot)', consistency: 'var(--good)', improvement: 'var(--blue)', warning: 'var(--warm)', celebration: 'var(--purple)' };
  return map[(type || '').toLowerCase()] || 'var(--muted)';
}

function showFallback() {
  document.getElementById('habits-stats').innerHTML =
    '<div class="stat orange"><div class="num">○○○</div><div class="lbl">API Disconnected</div></div>';
}

window.completeHabit = async function(name) {
  try {
    await ZEG.api.post('/api/habits/complete', { name });
    refreshData();
  } catch (e) { console.error(e); }
};