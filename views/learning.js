/* ════════════════════════════════════════════════════════════
   THE ZEG — Learning View
   Learning & skill tracking: courses, books, projects, time invested
   ════════════════════════════════════════════════════════════ */

import { fmtNum, fmtDuration, fmtRelative, showLoading } from '../utils.js';

export function init(container, api) {
  showLoading('Loading learning…', container);
  render(container, api);
}

export async function refresh(_api) {
  const container = document.querySelector('.main-content');
  if (container) render(container, _api || window.ZEG?.api);
}

function render(container, api) {
  container.innerHTML = `
    <div id="learning">
      <div class="stat-grid" id="learning-stats"></div>

      <div class="card">
        <div class="card-header">Active Courses</div>
        <table id="courses-table">
          <thead>
            <tr><th>Course</th><th>Platform</th><th>Progress</th><th>Time Spent</th><th>Next Lesson</th><th>Status</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-header">Reading Queue</div>
        <table id="books-table">
          <thead>
            <tr><th>Book</th><th>Author</th><th>Status</th><th>Progress</th><th>Pages</th><th>Started</th><th>Rating</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-header">Active Projects</div>
        <table id="projects-table">
          <thead>
            <tr><th>Project</th><th>Skill</th><th>Progress</th><th>Hours Invested</th><th>Last Worked</th><th>Status</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-header">Weekly Learning Time</div>
        <div id="learning-time-chart"></div>
      </div>

      <div class="card">
        <div class="card-header">Skill Matrix</div>
        <div id="skill-matrix"></div>
      </div>

      <div class="card">
        <div class="card-header">Completed This Month</div>
        <table id="completed-table">
          <thead>
            <tr><th>Item</th><th>Type</th><th>Completed</th><th>Hours</th><th>Notes</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  `;
  loadData(api);
}

async function loadData(api) {
  const data = await api.fetch('/api/learning');
  if (!data) {
    showFallback();
    return;
  }

  const stats = data.stats || {};
  const courses = data.courses || [];
  const books = data.books || [];
  const projects = data.projects || [];
  const weeklyTime = data.weekly_time || [];
  const skills = data.skills || [];
  const completed = data.completed || [];

  // Stats cards
  document.getElementById('learning-stats').innerHTML = `
    <div class="stat blue"><div class="num">${stats.active_courses || 0}</div><div class="lbl">Active Courses</div></div>
    <div class="stat green"><div class="num">${stats.reading_books || 0}</div><div class="lbl">Books Reading</div></div>
    <div class="stat orange"><div class="num">${stats.active_projects || 0}</div><div class="lbl">Active Projects</div></div>
    <div class="stat purple"><div class="num">${fmtDuration((stats.weekly_hours || 0) * 3600000)}</div><div class="lbl">This Week</div></div>
    <div class="stat red"><div class="num">${stats.completed_this_month || 0}</div><div class="lbl">Completed</div></div>
    <div class="stat yellow"><div class="num">${stats.total_skills || 0}</div><div class="lbl">Tracked Skills</div></div>
  `;

  // Courses table
  const courseBody = document.querySelector('#courses-table tbody');
  if (courseBody) {
    courseBody.innerHTML = courses.map(c => `
      <tr>
        <td style="font-weight:500">${c.title || '—'}</td>
        <td><span class="badge ${platformBadge(c.platform)}">${c.platform || '—'}</span></td>
        <td>
          <div style="width:100px;background:var(--panel-2);height:6px;border-radius:99px;overflow:hidden">
            <div style="width:${c.progress || 0}%;height:100%;background:var(--good)"></div>
          </div>
          <span style="font-family:var(--mono);font-size:11px;margin-left:6px">${c.progress || 0}%</span>
        </td>
        <td><span style="font-family:var(--mono)">${fmtDuration((c.hours_spent || 0) * 3600000)}</span></td>
        <td style="font-size:11px;color:var(--muted)">${c.next_lesson || '—'}</td>
        <td><span class="badge ${statusBadge(c.status)}">${c.status || '—'}</span></td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="empty">No active courses</td></tr>';
  }

  // Books table
  const bookBody = document.querySelector('#books-table tbody');
  if (bookBody) {
    bookBody.innerHTML = books.map(b => `
      <tr>
        <td style="font-weight:500">${b.title || '—'}</td>
        <td>${b.author || '—'}</td>
        <td><span class="badge ${bookStatusBadge(b.status)}">${b.status || '—'}</span></td>
        <td>
          <div style="width:80px;background:var(--panel-2);height:6px;border-radius:99px;overflow:hidden">
            <div style="width:${b.progress || 0}%;height:100%;background:var(--purple)"></div>
          </div>
          <span style="font-family:var(--mono);font-size:11px;margin-left:6px">${b.progress || 0}%</span>
        </td>
        <td>${b.pages_read || 0} / ${b.total_pages || 0}</td>
        <td><span style="font-family:var(--mono);font-size:11px">${b.started ? new Date(b.started).toLocaleDateString() : '—'}</span></td>
        <td>${b.rating ? '★'.repeat(Math.floor(b.rating)) + '☆'.repeat(5 - Math.floor(b.rating)) : '—'}</td>
      </tr>
    `).join('') || '<tr><td colspan="7" class="empty">No books in queue</td></tr>';
  }

  // Projects table
  const projBody = document.querySelector('#projects-table tbody');
  if (projBody) {
    projBody.innerHTML = projects.map(p => `
      <tr>
        <td style="font-weight:500">${p.name || '—'}</td>
        <td><span class="badge ${skillBadge(p.primary_skill)}">${p.primary_skill || '—'}</span></td>
        <td>
          <div style="width:100px;background:var(--panel-2);height:6px;border-radius:99px;overflow:hidden">
            <div style="width:${p.progress || 0}%;height:100%;background:var(--blue)"></div>
          </div>
          <span style="font-family:var(--mono);font-size:11px;margin-left:6px">${p.progress || 0}%</span>
        </td>
        <td><span style="font-family:var(--mono)">${fmtDuration((p.hours_invested || 0) * 3600000)}</span></td>
        <td><span style="font-family:var(--mono);font-size:11px">${fmtRelative(p.last_worked)}</span></td>
        <td><span class="badge ${projectStatusBadge(p.status)}">${p.status || '—'}</span></td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="empty">No active projects</td></tr>';
  }

  // Weekly learning time chart
  const timeChart = document.getElementById('learning-time-chart');
  if (timeChart) {
    timeChart.innerHTML = weeklyTime.map(w => {
      const pct = Math.min(100, (w.hours / (stats.weekly_target || 10)) * 100);
      return `
        <div class="health-row" style="margin-bottom:6px">
          <span class="health-label">${w.week || '—'}</span>
          <div class="health-bar"><div class="health-fill" style="width:${pct}%;background:var(--good)"></div></div>
          <span class="health-num">${w.hours}h</span>
        </div>
      `;
    }).join('') || '<div class="sub" style="padding:10px;color:var(--muted)">No time data</div>';
  }

  // Skill matrix
  const skillBox = document.getElementById('skill-matrix');
  if (skillBox) {
    skillBox.innerHTML = skills.map(s => {
      const level = s.level || 1;
      const color = level >= 4 ? 'var(--good)' : level >= 3 ? 'var(--blue)' : level >= 2 ? 'var(--warm)' : 'var(--muted)';
      return `
        <div style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-weight:500">${s.name || '—'}</span>
            <span style="font-family:var(--mono);font-size:11px;color:${color}">L${level}/5 (${s.xp || 0} XP)</span>
          </div>
          <div class="health-bar"><div class="health-fill" style="width:${(level / 5) * 100}%;background:${color}"></div></div>
        </div>
      `;
    }).join('') || '<div class="sub" style="padding:10px;color:var(--muted)">No skills tracked</div>';
  }

  // Completed table
  const compBody = document.querySelector('#completed-table tbody');
  if (compBody) {
    compBody.innerHTML = completed.slice(0, 15).map(c => `
      <tr>
        <td style="font-weight:500">${c.title || '—'}</td>
        <td><span class="badge ${typeBadge(c.type)}">${c.type || '—'}</span></td>
        <td><span style="font-family:var(--mono);font-size:11px">${c.completed ? new Date(c.completed).toLocaleDateString() : '—'}</span></td>
        <td><span style="font-family:var(--mono)">${fmtDuration((c.hours || 0) * 3600000)}</span></td>
        <td style="font-size:11px;color:var(--muted)">${c.notes || '—'}</td>
      </tr>
    `).join('') || '<tr><td colspan="5" class="empty">Nothing completed yet</td></tr>';
  }
}

function platformBadge(p) {
  const map = { coursera: 'badge-running', udemy: 'badge-agent', edx: 'badge-ok', pluralsight: 'badge-purple', youtube: 'badge-hot', other: 'badge-idle' };
  return map[(p || '').toLowerCase()] || 'badge-pending';
}

function statusBadge(s) {
  const map = { active: 'badge-ok', paused: 'badge-warn', completed: 'badge-done', dropped: 'badge-failed' };
  return map[(s || '').toLowerCase()] || 'badge-pending';
}

function bookStatusBadge(s) {
  const map = { reading: 'badge-ok', want_to_read: 'badge-pending', finished: 'badge-done', dnf: 'badge-failed' };
  return map[(s || '').toLowerCase()] || 'badge-pending';
}

function skillBadge(s) {
  const map = { programming: 'badge-running', design: 'badge-agent', writing: 'badge-purple', languages: 'badge-ok', business: 'badge-warn', health: 'badge-good', other: 'badge-idle' };
  return map[(s || '').toLowerCase()] || 'badge-pending';
}

function projectStatusBadge(s) {
  const map = { active: 'badge-ok', paused: 'badge-warn', completed: 'badge-done', archived: 'badge-blocked' };
  return map[(s || '').toLowerCase()] || 'badge-pending';
}

function typeBadge(t) {
  const map = { course: 'badge-running', book: 'badge-purple', project: 'badge-agent', certification: 'badge-ok', workshop: 'badge-warm' };
  return map[(t || '').toLowerCase()] || 'badge-pending';
}

function showFallback() {
  document.getElementById('learning-stats').innerHTML =
    '<div class="stat orange"><div class="num">○○○</div><div class="lbl">API Disconnected</div></div>';
}