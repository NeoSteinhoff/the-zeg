/* ═══════════════════════════════════════════════════
   THE ZEG — Circle // Pipeline View
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
    <div id="circle-pipeline">
      <div class="stat-grid" id="cp-stats"></div>
      <div class="leverbar" id="cp-leverbar"></div>
      <div class="card">
        <div class="card-header">Network Mesh — Visual Representation</div>
        <canvas id="cp-mesh" width="800" height="400" style="background:var(--bg);border-radius:var(--radius);width:100%;"></canvas>
      </div>
      <div class="sec-h">Due Now <span class="count" id="cp-due-count"></span></div>
      <div id="cp-due-list"></div>
      <div class="sec-h">Obsession Tier <span class="count">always on</span></div>
      <div id="cp-obs-list"></div>
      <div class="sec-h">Active Roster <span class="count" id="cp-active-count"></span></div>
      <div id="cp-active-list"></div>
      <div class="sec-h">Bench <span class="count" id="cp-bench-count"></span></div>
      <div id="cp-bench-list"></div>
    </div>
  `;

  loadData(api);
}

async function loadData(api) {
  const data = await api.fetch('/api/circle-pipeline');
  if (!data) {
    showFallback();
    return;
  }

  const stats = data.stats || {};
  const girls = data.girls || [];

  // Stats
  document.getElementById('cp-stats').innerHTML = `
    <div class="stat green"><div class="num">${stats.active || 0}</div><div class="lbl">Active / 10</div></div>
    <div class="stat red"><div class="num">${stats.obsession || 0}</div><div class="lbl">Obsession</div></div>
    <div class="stat blue"><div class="num">${stats.bench || 0}</div><div class="lbl">Bench</div></div>
    <div class="stat purple"><div class="num">${stats.total || 0}</div><div class="lbl">Total</div></div>
    <div class="stat orange"><div class="num">${stats.due_today || 0}</div><div class="lbl">Due Now</div></div>
  `;

  // Lever bar
  const levers = data.levers || [];
  const counts = {};
  levers.forEach(l => { if (l.lever) counts[l.lever] = (counts[l.lever] || 0) + 1; });
  const names = { L1: 'Variable-Ratio Pullback', L2: 'Uncertainty Hook', L3: 'Comparison Anchor' };
  document.getElementById('cp-leverbar').innerHTML = ['L1', 'L2', 'L3']
    .filter(k => counts[k])
    .map(k => `<span><b>${k}</b> ${counts[k]}× ${names[k]}</span>`)
    .join(' ') || 'No active levers';

  // Visual mesh
  drawMesh(girls);

  // Lists
  const due = girls.filter(g => g.due_now);
  const obs = girls.filter(g => g.rotation === 'obsession').sort((a, b) => b.heat - a.heat);
  const act = girls.filter(g => g.rotation === 'active').sort((a, b) => b.heat - a.heat);
  const bench = girls.filter(g => g.rotation === 'bench' && g.heat >= 45).sort((a, b) => b.heat - a.heat).slice(0, 25);

  document.getElementById('cp-due-count').textContent = `(${due.length})`;
  document.getElementById('cp-active-count').textContent = `(${act.length})`;
  document.getElementById('cp-bench-count').textContent = `(${bench.length} shown)`;

  fillList('cp-due-list', due, dueCard);
  fillList('cp-obs-list', obs, rowCard);
  fillList('cp-active-list', act, rowCard);
  fillList('cp-bench-list', bench, rowCard);
}

function drawMesh(girls) {
  const canvas = document.getElementById('cp-mesh');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  // Clear
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#0b0d10';
  ctx.fillRect(0, 0, w, h);

  // Center node (you)
  const cx = w / 2, cy = h / 2;
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#4ea8ff';
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ctx.fillStyle;
  ctx.strokeRect(cx - 18, cy - 18, 36, 36);

  // Draw nodes
  const nodes = girls.slice(0, 40);
  const radius = Math.min(w, h) / 2 - 60;
  nodes.forEach((g, i) => {
    const angle = (i / nodes.length) * Math.PI * 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;

    // Connection line
    ctx.strokeStyle = (g.rotation === 'obsession' ? '#ff4d5e' :
                      g.rotation === 'active' ? '#3fd07f' : '#5b6473');
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Node
    const color = g.rotation === 'obsession' ? '#ff4d5e' :
                 g.rotation === 'active' ? '#3fd07f' : '#5b6473';
    ctx.fillStyle = color;
    const size = 4 + (g.heat / 100) * 8;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    // Label
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--muted').trim() || '#8b93a3';
    ctx.font = '9px monospace';
    ctx.fillText(g.name.slice(0, 12), x - 20, y - size - 4);
  });

  // Pulse ring for due_now
  const ctx2 = canvas.getContext('2d');
  // Need to redraw with pulse animation - collect due nodes
  const dueNodes = girls.filter(g => g.due_now);
  if (dueNodes.length > 0) {
    // Draw pulsing rings using animation frame
    drawPulseRings(canvas, dueNodes, cx, cy);
  }
}

function rowCard(g) {
  const el = document.createElement('div');
  el.className = 'card';
  el.style.marginBottom = '6px';
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px">
      <div class="dot ${g.rotation}" style="width:9px;height:9px;border-radius:50%;background:${g.rotation === 'obsession' ? 'var(--hot)' : g.rotation === 'active' ? 'var(--good)' : 'var(--muted)'}"></div>
      <div style="flex:1">
        <div style="font-weight:500">${g.name}</div>
        <div style="font-size:11px;color:var(--muted)">last ${g.last_contact || '—'} · due ${g.due || '—'}</div>
      </div>
      <div style="width:60px;background:var(--panel-2);height:6px;border-radius:99px;overflow:hidden">
        <div style="width:${g.heat}%;height:100%;background:${g.heat >= 85 ? 'var(--hot)' : g.heat >= 60 ? 'var(--warm)' : g.heat >= 45 ? 'var(--blue)' : 'var(--muted)'}"></div>
      </div>
      <div style="text-align:right;font-variant-numeric:tabular-nums;font-size:12px;color:var(--muted);width:30px">${g.heat}</div>
      <div style="font-size:10px;color:var(--muted);border:1px solid var(--border);padding:2px 6px;border-radius:6px">${g.stage}</div>
    </div>
  `;
  return el;
}

function dueCard(g) {
  const el = document.createElement('div');
  el.className = 'card';
  el.style.borderLeft = '3px solid var(--warm)';
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px">
      <div class="dot ${g.rotation}" style="width:9px;height:9px;border-radius:50%;background:var(--warm)"></div>
      <div style="flex:1">
        <div style="font-weight:500">${g.name}</div>
        <div style="font-size:11px;color:var(--muted)">
          <span style="color:var(--blue)">${g.action || 'touch'}</span> · due ${g.due || '—'}
        </div>
      </div>
      <div style="background:rgba(255,176,32,0.1);color:var(--warm);padding:4px 8px;border-radius:6px;font-size:10px;font-weight:600">
        ${(g.lever || '').split(' — ')[0] || 'L?'}: ${(g.lever_desc || '').slice(0, 40)}
      </div>
      <button class="btn btn-primary" style="font-size:11px;padding:4px 10px"
        onclick="markSent('${g.name.replace(/'/g, "\\'")}')">mark sent</button>
    </div>
  `;
  return el;
}

function fillList(id, items, fn) {
  const box = document.getElementById(id);
  if (!box) return;
  box.innerHTML = '';
  if (!items.length) {
    box.innerHTML = '<div class="sub" style="padding:10px;color:var(--muted)">none</div>';
    return;
  }
  items.forEach(g => box.appendChild(fn(g)));
}

async function markSent(name) {
  try {
    await ZEG.api.post('/api/touch', { girl: name, kind: 'text', text: '', channel: 'text' });
    await ZEG.api.post('/api/bump', { girl: name });
  } catch (e) { /* offline fallback */ }
  // Re-render
  refresh();
}

// Expose markSent for onclick handlers
window.markSent = markSent;

function drawPulseRings(canvas, dueNodes, cx, cy) {
  const ctx = canvas.getContext('2d');
  const nodes = dueNodes.slice(0, 20);
  const radius = Math.min(canvas.width, canvas.height) / 2 - 60;

  nodes.forEach((g, i) => {
    const angle = (i / nodes.length) * Math.PI * 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;

    ctx.save();
    ctx.strokeStyle = '#ffb020';
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1;
    const time = Date.now();
    const pulseRadius = 8 + Math.sin(time / 500) * 4;
    ctx.beginPath();
    ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });

  requestAnimationFrame(() => drawPulseRings(canvas, dueNodes, cx, cy));
}

function showFallback() {
  document.getElementById('cp-stats').innerHTML =
    '<div class="stat orange"><div class="num">○○○</div><div class="lbl">API Disconnected</div></div>';
}

const FALLBACK = {
  stats: { obsession: 0, active: 0, bench: 0, total: 0, due_today: 0, cap_max: 10 },
  girls: [],
  levers: []
};
