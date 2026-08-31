/* ═══════════════════════════════════════════════════
   THE ZEG — Circle // Pipeline View
   ═══════════════════════════════════════════════════ */

import { showLoading, escapeHtml } from '../utils.js';

export function init(container, api) {
  showLoading('Loading circle pipeline…', container);
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
        <div class="card-header">Pipeline Heatmap — 1,348 Contacts</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;font-size:11px;color:var(--muted)">
          <div style="display:flex;justify-content:space-between">
            <span>Total: <b style="color:var(--fg)">${0}</b></span>
            <span>|</span>
            <span>Due: <b style="color:#ffb022">${0}</b></span>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span>Active: <b style="color:#3fd07f">${0}</b></span>
            <span>Obsession: <b style="color:#ff4d5d">${0}</b></span>
          </div>
        </div>
        <div style="position:relative;width:100%;height:360px">
          <svg id="cp-mesh" width="100%" height="360" viewBox="0 0 800 360" style="display:block;width:100%;height:100%;background:var(--panel-2);border-radius:var(--radius);"></svg>
          <div id="cp-mesh-tooltip" style="position:absolute;pointer-events:none;opacity:0;transition:opacity .15s;background:var(--panel);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;font-size:11px;font-family:var(--mono);color:var(--fg);white-space:nowrap;z-index:10"></div>
        </div>
        <div class="cp-legend" style="display:flex;gap:16px;flex-wrap:wrap;padding:8px 0;font-size:11px;color:var(--muted)">
          <span><span style="color:#ff4d5d">●</span> Obsession (>${0})</span>
          <span><span style="color:#3fd07f">●</span> Active (>${0})</span>
          <span><span style="color:#5b6473">●</span> Bench (>${0})</span>
          <span><span style="color:#ffb022">●</span> Due Now</span>
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
  // Try API first, fall back to local data file
  let data = null;
  try {
    data = await api.fetch('/api/circle-pipeline');
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
    data = FALLBACK;
  }

  const stats = data.stats || {};
  const girls = data.girls || [];

  // Stats with mini heat-distribution sparklines
  const heatBuckets = [0,0,0,0,0,0,0,0,0,0];
  girls.forEach(g => {
    const idx = Math.min(9, Math.floor((g.heat || 0) / 10));
    heatBuckets[idx]++;
  });
  const maxBucket = Math.max(...heatBuckets, 1);

  function miniSpark(buckets) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '80');
    svg.setAttribute('height', '20');
    svg.setAttribute('viewBox', '0 0 80 20');
    svg.setAttribute('preserveAspectRatio', 'none');
    let path = 'M0,20 ';
    buckets.forEach((v, i) => {
      const x = i * 8 + 4;
      const h = (v / maxBucket) * 16;
      path += x + ',' + (20 - h) + ' ';
    });
    path += '80,20 Z';
    const poly = document.createElementNS(svgNS, 'polygon');
    poly.setAttribute('points', path);
    poly.setAttribute('fill', 'var(--accent)');
    poly.setAttribute('fill-opacity', '0.3');
    svg.appendChild(poly);
    // Top line
    let linePoints = '';
    buckets.forEach((v, i) => {
      const x = i * 8 + 4;
      const h = (v / maxBucket) * 16;
      linePoints += x + ',' + (20 - h) + ' ';
    });
    const pl = document.createElementNS(svgNS, 'polyline');
    pl.setAttribute('points', linePoints.trim());
    pl.setAttribute('fill', 'none');
    pl.setAttribute('stroke', 'var(--accent)');
    pl.setAttribute('stroke-width', '1.5');
    svg.appendChild(pl);
    return svg.outerHTML;
  }

  const statSpark = miniSpark(heatBuckets);
  const statContainer = document.getElementById('cp-stats');
  // Build stats with mini sparkline showing heat distribution
  statContainer.innerHTML = `
    <div class="stat green"><div class="num">${stats.active || 0}</div><div class="lbl">Active</div>${statSpark}</div>
    <div class="stat red"><div class="num">${stats.obsession || 0}</div><div class="lbl">Obsession</div>${statSpark}</div>
    <div class="stat blue"><div class="num">${stats.bench || 0}</div><div class="lbl">Bench</div>${statSpark}</div>
    <div class="stat purple"><div class="num">${stats.total || 0}</div><div class="lbl">Total</div>${statSpark}</div>
    <div class="stat orange"><div class="num">${stats.due_today || 0}</div><div class="lbl">Due Now</div>${statSpark}</div>
  `;

  // Lever bar
  const levers = data.levers || [];
  const counts = {};
  levers.forEach(l => { if (l.lever) counts[l.lever] = (counts[l.lever] || 0) + 1; });
  const names = { L1: 'Variable-Ratio Pullback', L2: 'Uncertainty Hook', L3: 'Comparison Anchor' };
  document.getElementById('cp-leverbar').innerHTML = ['L1', 'L2', 'L3']
    .filter(k => counts[k])
    .map(k => `<span><b>${escapeHtml(k)}</b> ${escapeHtml(String(counts[k]))}× ${escapeHtml(names[k])}</span>`)
    .join(' ') || 'No active levers';

  // Update header stats
  const activeCount = girls.filter(g => g.rotation === 'active').length;
  const obsCount = girls.filter(g => g.rotation === 'obsession').length;
  const dueCount = girls.filter(g => g.due_now).length;
  const header = document.querySelector('#circle-pipeline .card-header');
  if (header) header.textContent = 'Pipeline Heatmap — ' + girls.length + ' Contacts';

  // Update legend with real heat thresholds
  const activeHot = girls.filter(g => g.heat >= 60 && g.rotation === 'active').length;
  const obsHot = girls.filter(g => g.heat >= 85 && g.rotation === 'obsession').length;
  const benchHot = girls.filter(g => g.heat >= 45 && g.rotation === 'bench').length;
  const legendItems = document.querySelector('.cp-legend');
  if (legendItems) {
    const spans = legendItems.querySelectorAll('span');
    if (spans[0]) spans[0].innerHTML = '<span style="color:#ff4d5d">●</span> Obsession (>85 heat): ' + obsHot;
    if (spans[1]) spans[1].innerHTML = '<span style="color:#3fd07f">●</span> Active (>60 heat): ' + activeHot;
    if (spans[2]) spans[2].innerHTML = '<span style="color:#5b6473">●</span> Bench (>45 heat): ' + benchHot;
  }

  // Visual heatmap
  drawMesh(girls);

  // Lists — show top contacts in each quadrant
  const due = girls.filter(g => g.due_now);
  const obs = girls.filter(g => g.rotation === 'obsession').sort((a, b) => (b.heat || 0) - (a.heat || 0));
  const act = girls.filter(g => g.rotation === 'active').sort((a, b) => (b.heat || 0) - (a.heat || 0));
  const bench = girls.filter(g => g.rotation === 'bench' && (g.heat || 0) >= 45).sort((a, b) => (b.heat || 0) - (a.heat || 0)).slice(0, 25);

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
      let fresh = null;
      try {
        fresh = await api.fetch('/api/circle-pipeline');
      } catch (e) {
        // API unavailable, keep using last data
      }
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

// New drawMesh function for circle-pipeline.js
// Replaces the canvas-based circle mesh with an SVG quadrant heatmap
function drawMesh(girls) {
  const svg = document.getElementById('cp-mesh');
  const tooltip = document.getElementById('cp-mesh-tooltip');
  if (!svg) return;

  // Clear previous content
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const w = 800, h = 360;
  const ns = 'http://www.w3.org/2000/svg';

  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0b0d10';
  const panel2 = getComputedStyle(document.documentElement).getPropertyValue('--panel-2').trim() || '#1a1d24';
  const border = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#2a2e37';
  const fg = getComputedStyle(document.documentElement).getPropertyValue('--fg').trim() || '#e6e9ef';
  const mut = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#8b93a3';
  const acc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#4ea8ff';

  // Quadrant layout: 2x2 grid
  // Q1: Obsession (top-left, red), Q2: Active (top-right, green),
  // Q3: Bench (bottom-left, gray), Q4: Warming (bottom-right, purple)
  const quadrants = [
    { key: 'obsession', label: 'Obsession', color: '#ff4d5d', x: 0, y: 0, x2: w/2, y2: h/2 },
    { key: 'active', label: 'Active', color: '#3fd07f', x: w/2, y: 0, x2: w, y2: h/2 },
    { key: 'bench', label: 'Bench', color: '#5b6473', x: 0, y: h/2, x2: w/2, y: h },
    { key: 'warming', label: 'Warming', color: '#7c3bed', x: w/2, y: h/2, x2: w, y: h },
  ];

  // Background
  const bgRect = document.createElementNS(ns, 'rect');
  bgRect.setAttribute('x', 0);
  bgRect.setAttribute('y', 0);
  bgRect.setAttribute('width', w);
  bgRect.setAttribute('height', h);
  bgRect.setAttribute('fill', panel2);
  bgRect.setAttribute('rx', '4');
  svg.appendChild(bgRect);

  // Heatmap grid: 10 columns (heat levels 0-100), 15 rows per quadrant
  const cols = 10;
  const rowsPerQuad = 15;
  const cellW = (w / 2) / cols;
  const cellH = (h / 2) / rowsPerQuad;

  // For each quadrant, create a grid of cells representing heat buckets
  const heatBuckets = 10; // 0-9, each = 10% heat range
  const girlsByQuad = {};
  for (const q of quadrants) {
    girlsByQuad[q.key] = girls.filter(g => g.rotation === q.key).sort((a, b) => (b.heat || 0) - (a.heat || 0));
  }

  // Also include 'archived' and 'obsession' in the obsession quadrant if needed
  girlsByQuad['obsession'] = girls.filter(g => g.rotation === 'obsession' || g.rotation === 'archived').sort((a, b) => (b.heat || 0) - (a.heat || 0));

  quadrants.forEach(q => {
    const contacts = girlsByQuad[q.key] || [];
    const numContacts = contacts.length;

    // Create grid cells: each cell represents a position in the quadrant
    // Higher rows = more contacts (density), columns = heat level
    const cellsPerQuad = cols * rowsPerQuad;

    // Distribute contacts into grid cells based on heat
    // We'll use a density-based approach: count contacts per heat bucket
    const heatCounts = new Array(cols).fill(0);
    contacts.forEach(c => {
      const heatIdx = Math.min(cols - 1, Math.floor((c.heat || 0) / 10));
      heatCounts[heatIdx]++;
    });

    // Normalize heat counts to rows (scale to rowsPerQuad)
    const maxCount = Math.max(...heatCounts, 1);
    const cellColors = [];

    for (let col = 0; col < cols; col++) {
      const count = heatCounts[col];
      const filledRows = Math.ceil((count / maxCount) * rowsPerQuad);

      for (let row = 0; row < rowsPerQuad; row++) {
        const x = q.x + col * cellW;
        const y = q.y + (rowsPerQuad - 1 - row) * cellH; // Bottom-up fill

        const rect = document.createElementNS(ns, 'rect');
        rect.setAttribute('x', x + 1);
        rect.setAttribute('y', y + 1);
        rect.setAttribute('width', cellW - 2);
        rect.setAttribute('height', cellH - 2);
        rect.setAttribute('rx', '2');

        // Color: base quadrant color with opacity based on density
        if (row < filledRows) {
          const opacity = 0.3 + (row / rowsPerQuad) * 0.5;
          rect.setAttribute('fill', hexToRgba(q.color, opacity));
          rect.setAttribute('stroke', q.color);
          rect.setAttribute('stroke-width', '0.5');
          rect.setAttribute('data-heat-bucket', col);
          rect.setAttribute('data-rotation', q.key);
          rect.setAttribute('data-count', count);
        } else {
          rect.setAttribute('fill', 'transparent');
          rect.setAttribute('stroke', border);
          rect.setAttribute('stroke-width', '0.5');
          rect.setAttribute('stroke-dasharray', '1,2');
        }

        // Tooltip on hover
        rect.addEventListener('mousemove', function(e) {
          if (row < filledRows) {
            const heatRange = col * 10 + '-' + (col + 1) * 10;
            tooltip.innerHTML = '<b>' + q.label + '</b> · Heat ' + heatRange + '<br>Contacts: ' + count + '<br><span style="color:' + q.color + '">' + count + ' in this bucket</span>';
            tooltip.style.left = (e.clientX - svg.getBoundingClientRect().left + 10) + 'px';
            tooltip.style.top = (e.clientY - svg.getBoundingClientRect().top + 10) + 'px';
            tooltip.style.opacity = '1';
          } else {
            tooltip.style.opacity = '0';
          }
        });
        rect.addEventListener('mouseleave', function() {
          tooltip.style.opacity = '0';
        });

        svg.appendChild(rect);
      }
    }

    // Quadrant label
    const label = document.createElementNS(ns, 'text');
    label.setAttribute('x', q.x + (w/2) / 4);
    label.setAttribute('y', q.y + 16);
    label.setAttribute('font-size', '11');
    label.setAttribute('fill', q.color);
    label.setAttribute('font-weight', 'bold');
    label.textContent = q.label + ' (' + numContacts + ')';
    svg.appendChild(label);
  });

  // Center cross
  const vLine = document.createElementNS(ns, 'line');
  vLine.setAttribute('x1', w/2);
  vLine.setAttribute('y1', 20);
  vLine.setAttribute('x2', w/2);
  vLine.setAttribute('y2', h - 20);
  vLine.setAttribute('stroke', border);
  vLine.setAttribute('stroke-width', '1');
  svg.appendChild(vLine);

  const hLine = document.createElementNS(ns, 'line');
  hLine.setAttribute('x1', 20);
  hLine.setAttribute('y1', h/2);
  hLine.setAttribute('x2', w - 20);
  hLine.setAttribute('y2', h/2);
  hLine.setAttribute('stroke', border);
  hLine.setAttribute('stroke-width', '1');
  svg.appendChild(hLine);

  // Heat axis label
  const heatLabel = document.createElementNS(ns, 'text');
  heatLabel.setAttribute('x', w - 20);
  heatLabel.setAttribute('y', h - 8);
  heatLabel.setAttribute('font-size', '10');
  heatLabel.setAttribute('fill', mut);
  heatLabel.setAttribute('text-anchor', 'end');
  heatLabel.textContent = 'Heat →';
  svg.appendChild(heatLabel);

  const countLabel = document.createElementNS(ns, 'text');
  countLabel.setAttribute('x', 20);
  countLabel.setAttribute('y', h/2 + 12);
  countLabel.setAttribute('font-size', '10');
  countLabel.setAttribute('fill', mut);
  countLabel.textContent = 'Density ↑';
  svg.appendChild(countLabel);

  // Pulsing animation for due-now contacts
  const dueContacts = girls.filter(g => g.due_now).slice(0, 50);
  if (dueContacts.length > 0) {
    let frame = 0;
    function animateDue() {
      if (!window.__cpAnimating) return;

      // Remove old due rings
      const existing = svg.querySelectorAll('.due-ring');
      existing.forEach(el => svg.removeChild(el));

      dueContacts.forEach((g, i) => {
        // Find which quadrant this contact is in
        const q = quadrants.find(qq => qq.key === g.rotation) || quadrants[1];
        const heatIdx = Math.min(cols - 1, Math.floor((g.heat || 0) / 10));
        const angle = (i / dueContacts.length) * Math.PI * 2 - Math.PI / 2;
        const offsetX = Math.cos(angle) * 18;
        const offsetY = Math.sin(angle) * 18;

        const cx = q.x + (w/2) / 4 + heatIdx * cellW + offsetX;
        const cy = q.y + rowsPerQuad * cellH / 2 + offsetY;

        const ringPulse = (frame % 60) / 60;
        const ring = document.createElementNS(ns, 'circle');
        ring.setAttribute('class', 'due-ring');
        ring.setAttribute('cx', cx);
        ring.setAttribute('cy', cy);
        ring.setAttribute('r', 8 + ringPulse * 14);
        ring.setAttribute('stroke', '#ffb022');
        ring.setAttribute('stroke-width', '2');
        ring.setAttribute('fill', 'none');
        ring.setAttribute('opacity', (0.8 - ringPulse * 0.6).toString());
        svg.appendChild(ring);
      });

      frame++;
      requestAnimationFrame(animateDue);
    }
    window.__cpAnimating = true;
    animateDue();
  }
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substr(0, 2), 16);
  const g = parseInt(h.substr(2, 2), 16);
  const b = parseInt(h.substr(4, 2), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}


function rowCard(g) {
  const el = document.createElement('div');
  el.className = 'card';
  el.style.marginBottom = '6px';

  // Build sparkline from contact history (or placeholder)
  const history = g.history || [];
  const sparkW = 50;
  const sparkH = 20;
  const sparkNS = 'http://www.w3.org/2000/svg';
  let sparkSVG = '';
  if (history.length >= 2) {
    const svg = document.createElementNS(sparkNS, 'svg');
    svg.setAttribute('width', sparkW);
    svg.setAttribute('height', sparkH);
    svg.setAttribute('viewBox', `0 0 ${sparkW} ${sparkH}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    const maxV = Math.max(...history.map(h => h.value || 0), 1);
    const points = history.slice(0, 10).map((h, i) => {
      const x = (i / Math.max(1, history.length - 1)) * (sparkW - 4) + 2;
      const y = sparkH - 2 - ((h.value || 0) / maxV) * (sparkH - 4);
      return x + ',' + y;
    }).join(' ');
    const polyline = document.createElementNS(sparkNS, 'polyline');
    polyline.setAttribute('points', points);
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', g.heat >= 85 ? '#ff4d5d' : g.heat >= 60 ? '#ffae42' : g.heat >= 45 ? '#4ea8ff' : '#5b6473');
    polyline.setAttribute('stroke-width', '1.5');
    svg.appendChild(polyline);
    sparkSVG = svg.outerHTML;
  } else {
    // No data sparkline — just a flat line
    const svg = document.createElementNS(sparkNS, 'svg');
    svg.setAttribute('width', sparkW);
    svg.setAttribute('height', sparkH);
    svg.setAttribute('viewBox', `0 0 ${sparkW} ${sparkH}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    const line = document.createElementNS(sparkNS, 'line');
    line.setAttribute('x1', 2);
    line.setAttribute('y1', sparkH / 2);
    line.setAttribute('x2', sparkW - 2);
    line.setAttribute('y2', sparkH / 2);
    line.setAttribute('stroke', '#5b6473');
    line.setAttribute('stroke-width', 1);
    line.setAttribute('stroke-dasharray', '2,2');
    svg.appendChild(line);
    sparkSVG = svg.outerHTML;
  }

  // sparkSVG is built entirely via createElementNS (safe DOM methods), not string concatenation
  // All user data in the template below is escaped via escapeHtml()
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px">
      <div class="dot ${g.rotation}" style="width:9px;height:9px;border-radius:50%;background:${g.rotation === 'obsession' ? 'var(--hot)' : g.rotation === 'active' ? 'var(--good)' : 'var(--muted)'}"></div>
      <div style="flex:1">
        <div style="font-weight:500">${escapeHtml(g.name)}</div>
        <div style="font-size:11px;color:var(--muted)">last ${escapeHtml(g.last_contact || '—')} · due ${escapeHtml(g.due || '—')}</div>
      </div>
      <div style="width:60px;background:var(--panel-2);height:6px;border-radius:99px;overflow:hidden">
        <div style="width:${g.heat}%;height:100%;background:${g.heat >= 85 ? 'var(--hot)' : g.heat >= 60 ? 'var(--warm)' : g.heat >= 45 ? 'var(--blue)' : 'var(--muted)'}"></div>
      </div>
      <div style="text-align:right;font-variant-numeric:tabular-nums;font-size:12px;color:var(--muted);width:30px">${g.heat}</div>
      <div style="flex-shrink:0">${sparkSVG}</div>
      <div style="font-size:10px;color:var(--muted);border:1px solid var(--border);padding:2px 6px;border-radius:6px">${escapeHtml(g.stage)}</div>
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
        <div style="font-weight:500">${escapeHtml(g.name)}</div>
        <div style="font-size:11px;color:var(--muted)">
          <span style="color:var(--blue)">${escapeHtml(g.action || 'touch')}</span> · due ${escapeHtml(g.due || '—')}
        </div>
      </div>
      <div style="background:rgba(255,176,32,0.1);color:var(--warm);padding:4px 8px;border-radius:6px;font-size:10px;font-weight:600">
        ${escapeHtml((g.lever || '').split(' — ')[0] || 'L?')}: ${escapeHtml((g.lever_desc || '').slice(0, 40))}
      </div>
      <button class="btn btn-primary mark-sent-btn" style="font-size:11px;padding:4px 10px" data-name="${escapeHtml(g.name)}">mark sent</button>
    </div>
  `;
  const btn = el.querySelector(".mark-sent-btn");
  if (btn) {
    btn.addEventListener("click", () => markSent(g.name));
  }
  return el;
}

function fillList(id, items, fn) {
  const box = document.getElementById(id);
  if (!box) return;
  box.setAttribute('role', 'list');
  box.innerHTML = '';
  if (!items.length) {
    const empty = el('div', { class: 'sub', html: 'none', style: 'padding:10px;color:var(--muted)' });
    empty.setAttribute('role', 'status');
    empty.setAttribute('aria-label', 'No items');
    box.appendChild(empty);
    return;
  }
  items.forEach(g => {
    const card = fn(g);
    card.setAttribute('role', 'listitem');
    card.setAttribute('tabindex', '0');
    box.appendChild(card);
  });
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
