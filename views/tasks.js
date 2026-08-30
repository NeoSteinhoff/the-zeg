/* ═══════════════════════════════════════════════════
   THE ZEG — Tasks & Delegations View
   Kanban tasks from kanban.db + async delegations from state.db
   ═══════════════════════════════════════════════════ */

import { showLoading, escapeHtml } from '../utils.js';

export function init(container, api) {
  showLoading('Loading tasks…', container);
  render(container, api);
}

export async function refresh(_api) {
  const container = document.querySelector('.main-content');
  if (container) render(container, _api || window.ZEG?.api);
}

function render(container, api) {
  container.innerHTML = `
    <div id="tasks-view">
      <div class="stat-grid" id="tasks-stats"></div>
      <div class="card">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
          <span>Active Tasks</span>
          <button class="btn btn-primary" style="font-size:11px;padding:4px 10px" onclick="openCreateTaskModal()">＋ New Task</button>
        </div>
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

  // SECURITY: Use DOM APIs instead of innerHTML
  const statsEl = document.getElementById('tasks-stats');
  statsEl.innerHTML = '';
  [
    { class: 'blue', num: tasks.length, lbl: 'Total Tasks' },
    { class: 'orange', num: statusCounts.todo || 0, lbl: 'Todo' },
    { class: 'purple', num: statusCounts.in_progress || 0, lbl: 'In Progress' },
    { class: 'green', num: statusCounts.done || 0, lbl: 'Done' },
    { class: 'red', num: delegations.filter(d => d.state === 'running').length, lbl: 'Active Dels' },
  ].forEach(s => {
    const card = document.createElement('div');
    card.className = `stat ${s.class}`;
    const num = document.createElement('div');
    num.className = 'num';
    num.textContent = s.num;
    const lbl = document.createElement('div');
    lbl.className = 'lbl';
    lbl.textContent = s.lbl;
    card.appendChild(num);
    card.appendChild(lbl);
    statsEl.appendChild(card);
  });

  // Tasks table
  const tbody = document.querySelector('#tasks-table tbody');
  if (tbody) {
    tbody.innerHTML = '';
    if (tasks.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 7;
      td.className = 'empty';
      td.textContent = 'No tasks found';
      tr.appendChild(td);
      tbody.appendChild(tr);
    } else {
      tasks.forEach(t => {
        const tr = document.createElement('tr');
        
        const tdId = document.createElement('td');
        const idSpan = document.createElement('span');
        idSpan.style.cssText = 'font-family:var(--mono);font-size:11px';
        idSpan.textContent = `#${(t.id || '').slice(0, 8)}`;
        tdId.appendChild(idSpan);
        
        const tdTitle = document.createElement('td');
        tdTitle.textContent = t.title || '—';
        
        const tdStatus = document.createElement('td');
        const statusBadgeEl = document.createElement('span');
        statusBadgeEl.className = `badge ${statusBadge(t.status)}`;
        statusBadgeEl.textContent = t.status || '—';
        tdStatus.appendChild(statusBadgeEl);
        
        const tdPriority = document.createElement('td');
        const priorityBadgeEl = document.createElement('span');
        priorityBadgeEl.className = `badge ${priorityBadge(t.priority)}`;
        priorityBadgeEl.textContent = `P${t.priority || 0}`;
        tdPriority.appendChild(priorityBadgeEl);
        
        const tdAssignee = document.createElement('td');
        tdAssignee.textContent = t.assignee || t.created_by || '—';
        
        const tdCreated = document.createElement('td');
        const createdSpan = document.createElement('span');
        createdSpan.style.cssText = 'font-family:var(--mono);font-size:11px';
        createdSpan.textContent = fmtTs(t.created_at);
        tdCreated.appendChild(createdSpan);
        
        const tdActions = document.createElement('td');
        const btn = document.createElement('button');
        btn.className = 'btn btn-ghost';
        btn.style.cssText = 'font-size:9px;padding:2px 6px';
        btn.textContent = 'View';
        btn.onclick = () => viewTaskDetail(t.id);
        tdActions.appendChild(btn);
        
        tr.appendChild(tdId);
        tr.appendChild(tdTitle);
        tr.appendChild(tdStatus);
        tr.appendChild(tdPriority);
        tr.appendChild(tdAssignee);
        tr.appendChild(tdCreated);
        tr.appendChild(tdActions);
        tbody.appendChild(tr);
      });
    }
  }

  // Delegations table
  const delBody = document.querySelector('#delegations-table tbody');
  if (delBody) {
    delBody.innerHTML = '';
    if (delegations.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.className = 'empty';
      td.textContent = 'No active delegations';
      tr.appendChild(td);
      delBody.appendChild(tr);
    } else {
      delegations.forEach(d => {
        const task = d.task || {};
        const tr = document.createElement('tr');
        
        const tdTask = document.createElement('td');
        tdTask.style.cssText = 'font-family:var(--mono);font-size:11px';
        tdTask.textContent = (task.goal || '').slice(0, 40);
        
        const tdState = document.createElement('td');
        const stateBadge = document.createElement('span');
        stateBadge.className = `badge ${d.state === 'running' ? 'badge-running' : d.state === 'completed' ? 'badge-ok' : 'badge-pending'}`;
        stateBadge.textContent = d.state || '—';
        tdState.appendChild(stateBadge);
        
        const tdStarted = document.createElement('td');
        const startedSpan = document.createElement('span');
        startedSpan.style.cssText = 'font-family:var(--mono);font-size:11px';
        startedSpan.textContent = fmtTs(d.dispatched_at);
        tdStarted.appendChild(startedSpan);
        
        const tdOwner = document.createElement('td');
        const ownerSpan = document.createElement('span');
        ownerSpan.style.cssText = 'font-family:var(--mono);font-size:11px';
        ownerSpan.textContent = `#${(d.origin_session || '').slice(0, 8)}`;
        tdOwner.appendChild(ownerSpan);
        
        const tdDelivery = document.createElement('td');
        const deliveryBadge = document.createElement('span');
        deliveryBadge.className = `badge ${d.delivery_state === 'delivered' ? 'badge-ok' : d.delivery_state === 'pending' ? 'badge-running' : 'badge-pending'}`;
        deliveryBadge.textContent = d.delivery_state || '—';
        tdDelivery.appendChild(deliveryBadge);
        
        tr.appendChild(tdTask);
        tr.appendChild(tdState);
        tr.appendChild(tdStarted);
        tr.appendChild(tdOwner);
        tr.appendChild(tdDelivery);
        delBody.appendChild(tr);
      });
    }
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
  const statsEl = document.getElementById('tasks-stats');
  statsEl.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'stat orange';
  const num = document.createElement('div');
  num.className = 'num';
  num.textContent = '○○○';
  const lbl = document.createElement('div');
  lbl.className = 'lbl';
  lbl.textContent = 'API Disconnected';
  card.appendChild(num);
  card.appendChild(lbl);
  statsEl.appendChild(card);
}

// ─── Task Detail (delegates to dedicated /api/task?id= endpoint) ───
window.viewTaskDetail = async function(id) {
  // Fetch full task details via the dedicated /api/task?id= endpoint
  const detail = await ZEG.api.fetch('/api/task?id=' + encodeURIComponent(id));
  if (!detail || detail.error) {
    // Fallback: fetch from /api/tasks and find client-side
    const taskData = await ZEG.api.fetch('/api/tasks');
    const task = (taskData?.tasks || []).find(t => t.id === id);
    if (!task) return;
    showTaskModal(task, [], []);
  } else {
    showTaskModal(detail.task, detail.comments || [], detail.events || []);
  }
};

function showTaskModal(task, comments, events) {
  if (!comments) comments = [];
  if (!events) events = [];

  const commentHtml = comments.map(c => {
    return '<div style="border-left:2px solid var(--border);padding-left:8px;margin-bottom:6px">' +
      '<span style="font-size:11px;color:var(--muted)">' + fmtTs(c.created_at) + ' · ' + (c.author || '—') + '</span><br>' +
      (c.content || '') +
    '</div>';
  }).join('') || '<div class="sub">No comments</div>';

  const eventHtml = events.map(e => {
    return '<div style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-bottom:4px">' +
      fmtTs(e.created_at) + ' · ' + (e.kind || e.event_type || '—') +
    '</div>';
  }).join('') || '<div class="sub">No events</div>';

  const body = '<div style="margin-bottom:16px">' +
    '<h3 style="margin-bottom:8px">' + (task.title || '—') + '</h3>' +
    '<div class="sub">' + (task.body || 'No description') + '</div>' +
  '</div>' +
  '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">' +
    '<div><div class="card-header">Comments (' + comments.length + ')</div>' + commentHtml + '</div>' +
    '<div><div class="card-header">Events (' + events.length + ')</div>' + eventHtml + '</div>' +
  '</div>';

  openZegModal('Task #' + (task.id || '').slice(0, 8), body);
}

// ─── Create Task Modal ───
window.openCreateTaskModal = function() {
  const body = '<div style="display:flex;flex-direction:column;gap:8px">' +
    '<input id="new-task-title" type="text" placeholder="Task title" style="background:var(--panel-2);border:1px solid var(--border);padding:8px;border-radius:4px;font-size:13px">' +
    '<textarea id="new-task-body" placeholder="Description (optional)" style="background:var(--panel-2);border:1px solid var(--border);padding:8px;border-radius:4px;font-size:13px;height:80px;resize:vertical"></textarea>' +
    '<select id="new-task-priority" style="background:var(--panel-2);border:1px solid var(--border);padding:6px;border-radius:4px;font-size:13px">' +
      '<option value="normal">Normal Priority</option>' +
      '<option value="high">High Priority</option>' +
      '<option value="low">Low Priority</option>' +
    '</select>' +
  '</div><div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">' +
    '<button class="btn btn-ghost" onclick="closeZegModal()">Cancel</button>' +
    '<button class="btn btn-primary" onclick="submitCreateTask()">Create Task</button>' +
  '</div>';

  openZegModal('Create New Task', body);

  // Handle form submission via modal buttons
  setTimeout(() => {
    const titleInput = document.getElementById('new-task-title');
    if (titleInput) titleInput.focus();
  }, 100);
};

window.submitCreateTask = async function() {
  const title = document.getElementById('new-task-title')?.value.trim();
  const bodyText = document.getElementById('new-task-body')?.value.trim();
  const priority = document.getElementById('new-task-priority')?.value || 'normal';
  if (!title) {
    showZegToast('Title is required', 'error');
    return;
  }
  const result = await ZEG.api.createTask({title, body: bodyText, priority});
  if (result && result.status === 'created') {
    showZegToast('Task created: ' + title, 'success');
    closeZegModal();
    refreshData();
  } else {
    showZegToast('Failed to create task', 'error');
  }
};
