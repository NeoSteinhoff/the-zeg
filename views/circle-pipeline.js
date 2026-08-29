/* ═══════════════════════════════════════════════════
   THE ZEG — Circle // Pipeline View
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
    <div id="circle-pipeline">
      <div class="stat-grid" id="cp-stats"></div>
      <div class="leverbar" id="cp-leverbar"></div>
      <div class="card">
        <div class="card-header">Network Mesh — Visual Representation</div>
        <div style="position:relative;width:100%;height:320px">
          <canvas id="cp-mesh" width="800" height="320" style="display:block;width:100%;height:100%;background:var(--panel-2);border-radius:var(--radius);"></canvas>
        </div>
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

  // Store girls for live updates
  window.__cpGirls = girls;

  // Start live polling if not already running
  if (!window.__cpLiveTimer) {
    window.__cpLiveTimer = setInterval(async () => {
      const fresh = await api.fetch('/api/circle-pipeline');
      if (fresh && fresh.girls) {
        window.__cpGirls = fresh.girls;
        // Update only the mesh (lists would disrupt reading)
        drawMesh(fresh.girls);
        // Update due count badge
        const dueNow = fresh.girls.filter(g => g.due_now).length;
        const dueEl = document.getElementById('cp-due-count');
        if (dueEl) dueEl.textContent = `(${dueNow})`;
      }
    }, 5000);
  }
}

function drawMesh(girls) {
  const canvas = document.getElementById('cp-mesh');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  // Set canvas resolution to match display size for crisp rendering
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const w = rect.width, h = rect.height;

  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0b0d10';
  const fg = getComputedStyle(document.documentElement).getPropertyValue('--fg').trim() || '#e6e9ef';
  const acc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#4ea8ff';
  const mut = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#8b93a3';

  let frame = 0;
  function render() {
    frame++;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2, cy = h / 2;

    // Draw nodes
    const nodes = girls.slice(0, 40);
    const radius = Math.min(w, h) / 2 - 50;
    nodes.forEach((g, i) => {
      const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;

      // Connection line with pulse
      const pulse = 0.2 + Math.sin(frame / 20 + i) * 0.1;
      ctx.strokeStyle = (g.rotation === 'obsession' ? '#ff4d5e' :
                        g.rotation === 'active' ? '#3fd07f' : '#5b6473');
      ctx.globalAlpha = pulse;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Node with glow
      const color = g.rotation === 'obsession' ? '#ff4d5e' :
                   g.rotation === 'active' ? '#3fd07f' : '#5b6473';
      const size = 4 + (g.heat / 100) * 8;

      // Glow
      ctx.shadowBlur = 10;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Label
      ctx.fillStyle = mut;
      ctx.font = '9px monospace';
      ctx.fillText(g.name.slice(0, 12), x - 20, y - size - 4);
    });

    // Center node (you) - pulsing
    const pulseSize = 14 + Math.sin(frame / 15) * 2;
    ctx.shadowBlur = 15;
    ctx.shadowColor = acc;
    ctx.fillStyle = acc;
    ctx.beginPath();
    ctx.arc(cx, cy, pulseSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Due now rings
    const dueNodes = girls.filter(g => g.due_now).slice(0, 20);
    dueNodes.forEach((g, i) => {
      const angle = (i / dueNodes.length) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      const ringPulse = (frame % 60) / 60;
      ctx.strokeStyle = `rgba(255,176,32,${1 - ringPulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 8 + ringPulse * 12, 0, Math.PI * 2);
      ctx.stroke();
    });

    requestAnimationFrame(render);
  }
  render();
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

function showFallback() {
  document.getElementById('cp-stats').innerHTML =
    '<div class="stat orange"><div class="num">○○○</div><div class="lbl">API Disconnected</div></div>';
}

const FALLBACK = {
  stats: { obsession: 0, active: 0, bench: 0, total: 0, due_today: 0, cap_max: 10 },
  girls: [],
  levers: []
};
