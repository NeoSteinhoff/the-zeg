/* ═══════════════════════════════════════════════════
   THE ZEG — Mesh CRM View
   Visual network of all circles (friendship + romantic)
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
    <div id="mesh-crm">
      <div class="stat-grid" id="mc-stats"></div>
      <div class="card">
        <div class="card-header">Circle Network — Mesh Visualization</div>
        <div style="display:flex;gap:12px;margin-bottom:12px">
          <select id="mc-filter" style="background:var(--panel);border:1px solid var(--border);color:var(--fg);padding:6px 10px;border-radius:var(--radius);font-family:var(--mono);font-size:12px">
            <option value="all">All Circles</option>
            <option value="romantic">Romantic Pipeline</option>
            <option value="inner">Inner Circle</option>
            <option value="close">Close Friends</option>
            <option value="guys">Guys Circle</option>
            <option value="rich">High-Value Network</option>
            <option value="locked_in">Locked In</option>
            <option value="medium">Medium</option>
            <option value="acquaintance">Acquaintance</option>
          </select>
          <button class="btn btn-primary" id="mc-recenter">○ Recenter</button>
          <button class="btn btn-ghost" id="mc-toggle-labels">○ Toggle Labels</button>
        </div>
        <canvas id="mc-mesh" width="1000" height="500" style="background:var(--bg);border-radius:var(--radius);width:100%;"></canvas>
      </div>
      <div class="card">
        <div class="card-header">Due for Touch</div>
        <table id="mc-due-table">
          <thead>
            <tr><th>Circle</th><th>Name</th><th>Trust</th><th>Reciprocity</th><th>Days Overdue</th><th>Lever</th><th>Action</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  `;

  loadData(api);

  document.getElementById('mc-filter').addEventListener('change', () => {
    window.MESH_DATA && drawMesh(window.MESH_DATA, document.getElementById('mc-filter').value);
  });
  document.getElementById('mc-recenter').addEventListener('click', () => {
    window.MESH_DATA && drawMesh(window.MESH_DATA, document.getElementById('mc-filter').value, true);
  });
  document.getElementById('mc-toggle-labels').addEventListener('click', () => {
    window.MESH_LABELS = !window.MESH_LABELS;
    window.MESH_DATA && drawMesh(window.MESH_DATA, document.getElementById('mc-filter').value);
  });
}

async function loadData(api) {
  const data = await api.fetch('/api/mesh-crm');
  if (!data) {
    showFallback();
    return;
  }

  const stats = data.stats || {};
  document.getElementById('mc-stats').innerHTML = `
    <div class="stat green"><div class="num">${stats.total_people || 0}</div><div class="lbl">Total People</div></div>
    <div class="stat blue"><div class="num">${stats.circles || 0}</div><div class="lbl">Circles</div></div>
    <div class="stat orange"><div class="num">${stats.due || 0}</div><div class="lbl">Due for Touch</div></div>
    <div class="stat purple"><div class="num">${stats.overdue || 0}</div><div class="lbl">Overdue</div></div>
    <div class="stat red"><div class="num">${stats.low_reciprocity || 0}</div><div class="lbl">Low Reciprocity</div></div>
  `;

  window.MESH_DATA = data;
  drawMesh(data, 'all');
  renderDueTable(data.due || []);
}

function drawMesh(data, filter = 'all', recenter = false) {
  const canvas = document.getElementById('mc-mesh');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const bg = getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#0b0d10';
  const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#4ea8ff';
  const muted = getComputedStyle(document.body).getPropertyValue('--muted').trim() || '#8b93a3';

  // Clear
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Filter people
  const people = (data.people || []).filter(p =>
    filter === 'all' || p.circle_type === filter || p.context_type === filter
  );

  // Circle type ordering for layout
  const circleOrder = ['inner', 'close', 'locked_in', 'rich', 'guys', 'medium', 'acquaintance', 'romantic'];
  const circleColors = {
    inner: '#ff4d5e', close: '#ffb020', locked_in: '#3fd07f',
    rich: '#a371ff', guys: '#4ea8ff', medium: '#5b6473',
    acquaintance: '#3a3a3a', romantic: '#ff4d5e'
  };

  // Center (you)
  const cx = w / 2, cy = h / 2;
  const ringCount = circleOrder.length;

  people.forEach((p, i) => {
    const circleIdx = circleOrder.indexOf(p.circle_type) >= 0
      ? circleOrder.indexOf(p.circle_type)
      : ringCount - 1;
    const ring = ringCount - circleIdx;
    const ringRadius = 50 + ring * 55;
    const angle = (i / people.length) * Math.PI * 2;
    p._x = cx + Math.cos(angle) * ringRadius;
    p._y = cy + Math.sin(angle) * ringRadius;
    p._color = circleColors[p.circle_type] || muted;
    p._size = 4 + Math.min(10, (p.trust_score || 50) / 10);
  });

  // Draw connections between people in same circle
  const circles = {};
  people.forEach(p => {
    if (!circles[p.circle_type]) circles[p.circle_type] = [];
    circles[p.circle_type].push(p);
  });

  // Center node
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(cx, cy, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - 22, cy - 22, 44, 44);
  if (window.MESH_LABELS !== false) {
    ctx.fillStyle = muted;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('YOU', cx, cy + 30);
  }

  // Connections from center to people
  people.forEach(p => {
    ctx.strokeStyle = p._color + '33';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(p._x, p._y);
    ctx.stroke();
  });

  // Inter-circle connections (people who know each other)
  Object.values(circles).forEach(members => {
    if (members.length < 2) return;
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = members[i], b = members[j];
        ctx.strokeStyle = (a._color || muted) + '22';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(a._x, a._y);
        ctx.lineTo(b._x, b._y);
        ctx.stroke();
      }
    }
  });

  // Draw people nodes
  people.forEach(p => {
    // Node
    ctx.fillStyle = p._color;
    ctx.beginPath();
    ctx.arc(p._x, p._y, p._size, 0, Math.PI * 2);
    ctx.fill();

    // Trust ring
    const trustPct = (p.trust_score || 50) / 100;
    ctx.strokeStyle = p._color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p._x, p._y, p._size + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * trustPct);
    ctx.stroke();

    // Label
    if (window.MESH_LABELS !== false) {
      ctx.fillStyle = muted;
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(p.name.slice(0, 12), p._x, p._y + p._size + 12);
    }
  });

  // Legend
  ctx.fillStyle = muted;
  ctx.font = '9px monospace';
  ctx.textAlign = 'left';
  let ly = 15;
  Object.entries(circleColors).forEach(([type, color]) => {
    const count = (circles[type] || []).length;
    if (count === 0) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(15, ly, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = muted;
    ctx.fillText(`${type} (${count})`, 25, ly + 3);
    ly += 16;
  });
}

function renderDueTable(due) {
  const tbody = document.querySelector('#mc-due-table tbody');
  if (!tbody) return;
  tbody.innerHTML = due.map(p => `
    <tr>
      <td><span class="badge" style="background:${p.circle_color || 'var(--muted)'}22;color:${p.circle_color || 'var(--muted)'}">${p.circle_type || '—'}</span></td>
      <td>${p.name}</td>
      <td>${p.trust_score || 0}</td>
      <td>${p.reciprocity_score || 0}</td>
      <td>${p.days_overdue || 0}d</td>
      <td><span style="font-family:var(--mono);font-size:10px">${p.lever_code || '—'}</span></td>
      <td><button class="btn btn-primary" style="font-size:10px;padding:2px 8px" onclick="touchFriend(${p.id})">Touch</button></td>
    </tr>
  `).join('') || '<tr><td colspan="7" class="empty">No one due for touch</td></tr>';
}

async function touchFriend(id) {
  try {
    await ZEG.api.post('/api/friend-touch', { person_id: id });
    refresh();
  } catch (e) {
    console.error(e);
  }
}

window.touchFriend = touchFriend;

function showFallback() {
  document.getElementById('mc-stats').innerHTML =
    '<div class="stat orange"><div class="num">○○○</div><div class="lbl">API Disconnected</div></div>';
}

window.MESH_LABELS = true;