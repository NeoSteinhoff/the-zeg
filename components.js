/**
 * ════════════════════════════════════════════════════════════
   THE ZEG — UI Component Library
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   
   Framework-free micro-components using vanilla DOM APIs.
   Import: import { ZEG } from '../components.js';
   Usage:  ZEG.StatCard({ num: 100, lbl: 'Agents' })
   ════════════════════════════════════════════════════════════
 */

export const ZEG = {
  /**
   * Create a stat card element
   * @param {Object} opts - { num, lbl, icon, color?, subtitle?, onClick? }
   * @returns {HTMLElement}
   */
  StatCard(opts) {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.style.setProperty('--accent-color', opts.color || 'var(--accent)');
    card.innerHTML = `
      <div class="stat-icon">${opts.icon || '○'}</div>
      <div class="stat-content">
        <div class="stat-num">${opts.num}</div>
        <div class="stat-lbl">${opts.lbl}</div>
        ${opts.subtitle ? `<div class="stat-sub">${opts.subtitle}</div>` : ''}
      </div>
    `;
    if (opts.onClick) card.addEventListener('click', opts.onClick);
    return card;
  },

  /**
   * Create a data table
   * @param {Object} opts - { columns: [{key, label, render?}], rows: [], sortable? }
   * @returns {HTMLElement}
   */
  DataTable(opts) {
    const table = document.createElement('div');
    table.className = 'zeg-table';
    const header = document.createElement('div');
    header.className = 'table-header';
    opts.columns.forEach(col => {
      const th = document.createElement('div');
      th.className = 'table-cell table-head';
      th.textContent = col.label;
      if (col.sortable) th.style.cursor = 'pointer';
      header.appendChild(th);
    });
    table.appendChild(header);
    opts.rows.forEach(row => {
      const tr = document.createElement('div');
      tr.className = 'table-row';
      opts.columns.forEach(col => {
        const td = document.createElement('div');
        td.className = 'table-cell';
        const val = row[col.key];
        td.textContent = col.render ? col.render(val, row) : (val ?? '—');
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    return table;
  },

  /**
   * Create a health bar element
   * @param {Object} opts - { label, percent, color, size? }
   * @returns {HTMLElement}
   */
  HealthBar(opts) {
    const pct = Math.max(0, Math.min(100, opts.percent || 0));
    const el = document.createElement('div');
    el.className = 'health-row';
    el.innerHTML = `
      <span class="health-label">${opts.label}</span>
      <div class="health-bar"><div class="health-fill" style="width:${pct}%;background:${opts.color||'var(--accent)'}"></div></div>
      <span class="health-num">${pct}%</span>
    `;
    return el;
  },

  /**
   * Create a status dot
   * @param {string} status - 'online' | 'offline' | 'warning' | 'pending'
   * @returns {HTMLElement}
   */
  StatusDot(status) {
    const dot = document.createElement('span');
    dot.className = `status-dot ${status}`;
    dot.textContent = '●';
    return dot;
  },

  /**
   * Create a chip/tag
   */
  Tag(text, variant = 'default', size = 'sm') {
    const el = document.createElement('span');
    el.className = `zeg-tag zeg-tag-${variant} zeg-tag-${size}`;
    el.textContent = text;
    return el;
  },

  /**
   * Simple sparkline chart as SVG
   */
  Sparkline(data, opts = {}) {
    const w = opts.width || 120;
    const h = opts.height || 30;
    const vals = Array.isArray(data) ? data : [data];
    const max = Math.max(...vals, 1);
    const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - (v / max) * h}`).join(' ');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.classList.add('zeg-spark');
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', `0,${h} ${pts} ${w},${h}`);
    poly.setAttribute('fill', opts.color || 'var(--accent)');
    svg.appendChild(poly);
    return svg;
  },

  /**
   * Create a loading skeleton
   */
  Skeleton(lines = 3, width = '100%') {
    const el = document.createElement('div');
    el.className = 'zeg-skeleton';
    for (let i = 0; i < lines; i++) {
      const line = document.createElement('div');
      line.className = 'skeleton-line';
      line.style.width = width;
      el.appendChild(line);
    }
    return el;
  },

  /**
   * 3D tilt card with dynamic glare effect (vanilla JS port of Framer Motion CometCard)
   * @param {Object} opts - { rotateDepth, translateDepth, className, children }
   * @returns {HTMLElement}
   */
  CometCard(opts = {}) {
    const rotateDepth = opts.rotateDepth || 17.5;
    const translateDepth = opts.translateDepth || 20;
    const card = document.createElement('div');
    card.className = `comet-card-wrapper ${opts.className || ''}`;
    card.style.perspective = '1200px';

    const inner = document.createElement('div');
    inner.className = 'comet-card-inner';
    inner.style.transformStyle = 'preserve-3d';

    // Add children if provided
    if (opts.children) {
      if (typeof opts.children === 'string') {
        inner.innerHTML = opts.children;
      } else if (opts.children instanceof HTMLElement) {
        inner.appendChild(opts.children);
      } else {
        opts.children.forEach(c => inner.appendChild(
          typeof c === 'string' ? document.createTextNode(c) : c
        ));
      }
    }

    // Glare overlay
    const glare = document.createElement('div');
    glare.className = 'comet-glare';
    glare.style.background = 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.8) 10%, rgba(255,255,255,0.5) 20%, transparent 70%)';
    glare.style.opacity = '0';
    inner.appendChild(glare);

    // Tilt handler — uses requestAnimationFrame for 60fps smoothness
    let animationId = null;
    const onMouseMove = (e) => {
      if (!animationId) {
        animationId = requestAnimationFrame(() => {
          const rect = inner.getBoundingClientRect();
          const width = rect.width;
          const height = rect.height;
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          const xPct = (mouseX / width - 0.5);
          const yPct = (mouseY / height - 0.5);

          inner.style.transform =
            `perspective(1200px)` +
            ` rotateX(${-yPct * rotateDepth}deg)` +
            ` rotateY(${xPct * rotateDepth}deg)` +
            ` translate3d(${-xPct * translateDepth}px, ${-yPct * translateDepth}px, 80px)` +
            ` scale(1.05)`;

          const glareX = (mouseX / width) * 100;
          const glareY = (mouseY / height) * 100;
          glare.style.background =
            `radial-gradient(circle at ${glareX}% ${glareY}%, ` +
            `rgba(255,255,255,0.9) 10%, rgba(255,255,255,0.6) 20%, transparent 70%)`;
          glare.style.opacity = '0.6';
          animationId = null;
        });
      }
    };

    const onMouseLeave = () => {
      inner.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.3s';
      inner.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg) translate3d(0,0,0) scale(1)';
      glare.style.opacity = '0';
      setTimeout(() => {
        inner.style.transition = '';
      }, 300);
    };

    inner.addEventListener('mousemove', onMouseMove);
    inner.addEventListener('mouseleave', onMouseLeave);

    card.appendChild(inner);
    return card;
  }
};

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'style') Object.assign(node.style, v);
    else node.setAttribute(k, v);
  }
  children.forEach(c => node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return node;
}
