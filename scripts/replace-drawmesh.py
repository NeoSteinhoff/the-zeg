#!/usr/bin/env python3
"""Replace drawMesh in circle-pipeline.js with the new heatmap version"""

old = """function drawMesh(girls) {
  const canvas = document.getElementById('cp-mesh');
  const tooltip = document.getElementById('cp-mesh-tooltip');
  if (!canvas) return;
  // Cancel any existing animation loop before starting a new one
  window.__cpAnimating = false;
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
  const panel2 = getComputedStyle(document.documentElement).getPropertyValue('--panel-2').trim() || '#1a1d24';
  const border = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#2a2e37';

  // Precompute node positions — show top 60 by heat for the mesh
  const nodes = girls.sort((a, b) => (b.heat || 0) - (a.heat || 0)).slice(0, 60);
  const radius = Math.min(w, h) / 2 - 60;
  nodes.forEach((g, i) => {
    const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
    g._x = w / 2 + Math.cos(angle) * radius;
    g._y = h / 2 + Math.sin(angle) * radius;
  });

  // Mouse tracking for tooltips
  canvas.style.cursor = 'pointer';
  let hovered = null;
  canvas.onmousemove = function(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    hovered = null;
    const hitRadius = Math.max(12, 8 + (girls[0]?.heat || 50) / 100 * 8);
    for (const g of nodes) {
      const dist = Math.hypot(g._x - mx, g._y - my);
      if (dist < hitRadius + 4) { hovered = g; break; }
    }
    if (tooltip) {
      if (hovered) {
        tooltip.textContent = `${hovered.name} — ${hovered.stage || '—'} · heat ${hovered.heat || 0} · ${hovered.last_contact || '—'}`;
        tooltip.style.left = (e.clientX - rect.left + 10) + 'px';
        tooltip.style.top = (e.clientY - rect.top + 10) + 'px';
        tooltip.style.opacity = '1';
      } else {
        tooltip.style.opacity = '0';
      }
    }
  };
  canvas.onmouseleave = function() { hovered = null; if (tooltip) tooltip.style.opacity = '0'; };

  let frame = 0;
  function render() {
    if (!window.__cpAnimating) return;
    frame++;

    // Clear with background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Background grid dots
    ctx.fillStyle = border;
    ctx.globalAlpha = 0.15;
    for (let x = 0; x < w; x += 24) {
      for (let y = 0; y < h; y += 24) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.globalAlpha = 1;

    const cx = w / 2, cy = h / 2;
    const centerColor = (hov) => hov ? acc : panel2;

    // Draw connection lines (thicker for higher heat = connection density)
    nodes.forEach((g, i) => {
      const heatFactor = (g.heat || 0) / 100;
      const lineWidth = 0.5 + heatFactor * 2;
      const pulse = 0.3 + Math.sin(frame / 30 + i * 0.5) * 0.1;
      ctx.strokeStyle = g.rotation === 'obsession' ? '#ff4d5d' :
                        g.rotation === 'active' ? '#3fd07f' :
                        g.rotation === 'bench' ? '#5b6473' : '#5b6473';
      ctx.globalAlpha = pulse;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(g._x, g._y);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.lineCap = 'butt';

    // Draw nodes
    nodes.forEach((g, i) => {
      const heatFactor = (g.heat || 0) / 100;
      const size = 5 + heatFactor * 10;

      // Node color by rotation
      const color = g.rotation === 'obsession' ? '#ff4d5d' :
                    g.rotation === 'active' ? '#3fd07f' :
                    g.rotation === 'bench' ? '#5b6473' : '#5b6473';

      // Heat-based glow
      ctx.shadowBlur = 5 + heatFactor * 10;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(g._x, g._y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Heat ring (half-transparent ring indicating heat level)
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.3 + heatFactor * 0.4;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.arc(g._x, g._y, size + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Node label
      if (tooltip) {
        if (hovered === g) {
          ctx.fillStyle = fg;
          ctx.font = 'bold 10px monospace';
        } else {
          ctx.fillStyle = mut;
          ctx.font = '9px monospace';
        }
      } else {
        ctx.fillStyle = mut;
        ctx.font = '9px monospace';
      }
      ctx.textAlign = 'center';
      ctx.fillText(g.name.slice(0, 12), g._x, g._y - size - 4);
    });

    // Center node (you) - pulsing with glow
    const pulseSize = 16 + Math.sin(frame / 15) * 3;
    const ringPulse = (frame % 30) / 30;
    ctx.globalAlpha = 0.5 - ringPulse * 0.3;
    ctx.strokeStyle = acc;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, pulseSize + ringPulse * 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 20;
    ctx.shadowColor = acc;
    ctx.fillStyle = acc;
    ctx.beginPath();
    ctx.arc(cx, cy, pulseSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = fg;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('YOU', cx, cy + 3);

    // Due now animated rings (concentric pulsing)
    const dueNodes = nodes.filter(g => g.due_now);
    dueNodes.forEach((g, i) => {
      const angle = (i / Math.max(1, dueNodes.length)) * Math.PI * 2 - Math.PI / 2;
      const dx = cx + Math.cos(angle) * radius;
      const dy = cy + Math.sin(angle) * radius;
      const ringPulse = (frame % 60) / 60;
      const ringAlpha = 0.8 - ringPulse * 0.6;
      ctx.strokeStyle = `rgba(255,176,32,${ringAlpha})`;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(dx, dy, 10 + ringPulse * 16, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.lineCap = 'butt';

    requestAnimationFrame(render);
  }

  // Mark animation active before starting the loop
  window.__cpAnimating = true;
  render();
}"""

new = open('/Users/neosteinhoff/the-zeg/scripts/new-drawmesh.js').read()

filepath = '/Users/neosteinhoff/the-zeg/views/circle-pipeline.js'
content = open(filepath).read()

if old in content:
    content = content.replace(old, new)
    with open(filepath, 'w') as f:
        f.write(content)
    print("SUCCESS: Replaced drawMesh function")
else:
    print("FAILED: Old function not found")
    # Show first 100 chars of where we expect the function
    idx = content.find('function drawMesh')
    if idx >= 0:
        print(f"Found 'function drawMesh' at index {idx}")
        print("Context:", repr(content[idx:idx+200]))
