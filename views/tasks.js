/* ═══════════════════════════════════════════════════
   THE ZEG — Tasks & Delegations View
   Kanban tasks from kanban.db + async delegations from state.db
   ═══════════════════════════════════════════════════ */

export function init(container, api) {
  render(container, api);
}

export async function refresh() {
  const container = document.querySelector('.main-content');
  if (container) render(container, ZEG.api);
}

function render(container, api) {
  container.innerHTML = `
    <div id="tasks-view">
      <div class="stat-grid" id="tasks-stats"></div>
      <div class="card">
        <div class="card-header">Active Tasks</div>
        <table id="tasks-table">
          <thead>
            <tr><th>ID</th><th>Title</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Created</th><th>Actions</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="card">
        <div class="card-header">Running Delegations</div>
        <table id="delegations-table">
          <thead>
            <tr><th>Task</th><th>State</th><th>Started</th><th>Owner</th><th>Delivery</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  `;
  loadData(api);
}

async function loadData(api) {
  const [taskData, delData] = await Promise.all([
    api.fetch('/api/tasks'),
    api.fetch('/api/delegations'),
  ]);

  if (!taskData) {
    showFallback();
    return;
  }

  const tasks = taskData.tasks || [];
  const delegations = delData?.delegations || [];

  // Stats
  const statusCounts = {};
  tasks.forEach(t => {
    const s = t.status || 'unknown';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  document.getElementById('tasks-stats').innerHTML = `
    <div class="stat blue"><div class="num">${tasks.length}</div><div class="lbl">Total Tasks</div></div>
    <div class="stat orange"><div class="num">${statusCounts.todo || 0}</div><div class="lbl">Todo</div></div>
    <div class="stat purple"><div class="num">${statusCounts.in_progress || 0}</div><div class="lbl">In Progress</div></div>
    <div class="stat green"><div class="num">${statusCounts.done || 0}</div><div class="lbl">Done</div></div>
    <div class="stat red"><div class="num">${delegations.filter(d => d.state === 'running').length}</div><div class="lbl">Active Dels</div></div>
  `;

  // Tasks table
  const tbody = document.querySelector('#tasks-table tbody');
  if (tbody) {
    tbody.innerHTML = tasks.map(t => `
      <tr>
        <td><span style="font-family:var(--mono);font-size:11px">#${(t.id || '').slice(0, 8)}</span></td>
        <td>${t.title || '—'}</td>
        <td><span class="badge ${statusBadge(t.status)}">${t.status || '—'}</span></td>
        <td><span class="badge ${priorityBadge(t.priority)}">P${t.priority || 0}</span></td>
        <td>${t.assignee || t.created_by || '—'}</td>
        <td><span style="font-family:var(--mono);font-size:11px">${fmtTs(t.created_at)}</span></td>
        <td>
          <button class="btn btn-ghost" style="font-size:9px;padding:2px 6px" onclick="viewTaskDetail('${t.id}')">View</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="7" class="empty">No tasks found</td></tr>';
  }

  // Delegations table
  const delBody = document.querySelector('#delegations-table tbody');
  if (delBody) {
    delBody.innerHTML = delegations.map(d => {
      const task = d.task || {};
      return `
      <tr>
        <td style="font-family:var(--mono);font-size:11px">${(task.goal || '').slice(0, 40)}</td>
        <td><span class="badge ${d.state === 'running' ? 'badge-running' : d.state === 'completed' ? 'badge-ok' : 'badge-pending'}">${d.state || '—'}</span></td>
        <td><span style="font-family:var(--mono);font-size:11px">${fmtTs(d.dispatched_at)}</span></td>
        <td><span style="font-family:var(--mono);font-size:11px">#${(d.origin_session || '').slice(0, 8)}</span></td>
        <td><span class="badge ${d.delivery_state === 'delivered' ? 'badge-ok' : d.delivery_state === 'pending' ? 'badge-running' : 'badge-pending'}">${d.delivery_state || '—'}</span></td>
      </tr>
      `;
    }).join('') || '<tr><td colspan="5" class="empty">No active delegations</td></tr>';
  }
}

function statusBadge(status) {
  const map = { done: 'badge-ok', in_progress: 'badge-running', blocked: 'badge-failed', todo: 'badge-pending' };
  return map[status] || 'badge-pending';
}

function priorityBadge(priority) {
  if (priority >= 8) return 'badge-failed';
  if (priority >= 5) return 'badge-hot';
  if (priority >= 3) return 'badge-running';
  return 'badge-pending';
}

function fmtTs(ts) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}

function showFallback() {
  document.getElementById('tasks-stats').innerHTML =
    '<div class="stat orange"><div class="num">○○○</div><div class="lbl">API Disconnected</div></div>';
}

window.viewTaskDetail = function(id) {
  // Would open modal with task details
  console.log('View task:', id);
};
