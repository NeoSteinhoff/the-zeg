/**
 * Dashboard V2 — Aceternity dashboard-01 port
 * Features: sidebar with hover expand, metrics grid, line chart, data table
 *
 * Subsystems referenced:
 * - dashboard-01: Sidebar + charts + data table
 * - sidebar-09: Email client pattern
 * - sidebar-10: Notion-style document vault
 * - sidebar-11: File browser + Obsidian vault
 * - sidebar-12: Calendar system
 */
import { ZEG } from '../components.js';
import { escapeHtml, fmtNum, showLoading, showError, el } from '../utils.js';

const METRICS = [
  { label: 'Total Revenue', value: 'AED 125,000', change: '+12%', trend: 'up', icon: '💰' },
  { label: 'Active Agents', value: '645', change: '+3.2%', trend: 'up', icon: '🤖' },
  { label: 'Pipeline Leads', value: '89', change: '-2%', trend: 'down', icon: '📊' },
  { label: 'Soul Sessions', value: '20', change: '+1', trend: 'up', icon: '🔮' },
];

const TABLE_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'type', label: 'Type' },
  { key: 'status', label: 'Status' },
  { key: 'updated', label: 'Updated' },
];

const TABLE_ROWS = [
  { name: 'Circle Pipeline', type: 'Dating', status: '🟢 Active', updated: '2m ago' },
  { name: 'Steinvault', type: 'Vault', status: '🟢 Active', updated: '5m ago' },
  { name: 'Resend Inbox', type: 'Email', status: '🟡 Paused', updated: '1h ago' },
  { name: 'Soul Council', type: 'AI', status: '🟢 Active', updated: '10m ago' },
  { name: 'Calendar Sync', type: 'Schedule', status: '⚪ Pending', updated: '3h ago' },
];

/**
 * Generate a simple SVG sparkline for metric trends
 */
function SparklineSVG(data, width = 80, height = 24) {
  const max = Math.max(...data, 1);
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - (v / max) * height;
    return `${x},${y}`;
  }).join(' ');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.classList.add('sparkline');

  const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  poly.setAttribute('points', `0,${height} ${points} ${width},${height}`);
  poly.setAttribute('fill', 'var(--accent)');
  poly.setAttribute('fillOpacity', '0.15');
  svg.appendChild(poly);

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  line.setAttribute('points', points);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', 'var(--accent)');
  line.setAttribute('strokeWidth', '2');
  line.setAttribute('strokeLinecap', 'round');
  svg.appendChild(line);

  return svg;
}

export async function init(container) {
  showLoading(container, 'Loading Dashboard V2...');
  container.innerHTML = '';

  // Aceternity-style: main content area below top bar
  const wrapper = el('div', { class: 'dashboard-v2' });

  // Stats grid
  const statsGrid = el('div', { class: 'stats-grid' });
  METRICS.forEach(m => {
    const card = ZEG.CometCard({
      className: 'stat-card-modern',
      children: el('div', { class: 'stat-card-content' }, [
        el('div', { class: 'stat-icon' }, m.icon),
        el('div', { class: 'stat-num' }, fmtNum(m.value.replace(/[^0-9.]/g, ''))),
        el('div', { class: 'stat-lbl' }, m.label),
        el('div', { class: 'stat-trend', style: `color: ${m.trend === 'up' ? 'var(--good)' : m.trend === 'down' ? 'var(--hot)' : 'var(--muted)'}`,
          children: `${m.change} ${m.trend === 'up' ? '↗' : m.trend === 'down' ? '↘' : '→'}` }),
      ]),
    });
    statsGrid.appendChild(card);
  });

  // Main content: charts + table
  const mainContent = el('div', { class: 'dashboard-main' }, [
    // Chart section
    el('div', { class: 'panel chart-panel' }, [
      el('div', { class: 'section-header' }, [
        el('h2', { html: 'Revenue Trend' }),
        el('div', { class: 'actions' }, [
          el('button', { class: 'btn btn-ghost', html: '7d' }),
          el('button', { class: 'btn btn-ghost', html: '30d' }),
          el('button', { class: 'btn btn-ghost', html: '90d' }),
        ]),
      ]),
      // SVG Line chart
      (() => {
        const chartSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        chartSvg.setAttribute('width', '100%');
        chartSvg.setAttribute('height', '200');
        chartSvg.setAttribute('viewBox', '0 0 600 200');
        chartSvg.classList.add('zeg-chart');

        const data = Array.from({ length: 30 }, (_, i) =>
          100 + Math.sin(i * 0.3) * 30 + Math.random() * 10
        ).map(v => Math.round(v));

        const max = Math.max(...data);
        const min = Math.min(...data);
        const range = max - min || 1;

        const points = data.map((v, i) => {
          const x = (i / (data.length - 1)) * 560 + 20;
          const y = 180 - ((v - min) / range) * 150;
          return `${x},${y}`;
        }).join(' ');

        // Grid lines
        for (let i = 0; i <= 5; i++) {
          const y = 30 + (i / 5) * 150;
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', '20');
          line.setAttribute('y1', y);
          line.setAttribute('x2', '580');
          line.setAttribute('y2', y);
          line.setAttribute('stroke', 'var(--border)');
          line.setAttribute('strokeWidth', '1');
          chartSvg.appendChild(line);
        }

        // Area fill
        const area = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        area.setAttribute('points', `20,180 ${points} 580,180`);
        area.setAttribute('fill', 'var(--accent)');
        area.setAttribute('fillOpacity', '0.08');
        chartSvg.appendChild(area);

        // Line
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        line.setAttribute('points', points);
        line.setAttribute('fill', 'none');
        line.setAttribute('stroke', 'var(--accent)');
        line.setAttribute('strokeWidth', '2');
        line.setAttribute('strokeLinecap', 'round');
        line.setAttribute('strokeLinejoin', 'round');
        chartSvg.appendChild(line);

        // Dots
        data.forEach((v, i) => {
          const x = (i / (data.length - 1)) * 560 + 20;
          const y = 180 - ((v - min) / range) * 150;
          const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          dot.setAttribute('cx', x);
          dot.setAttribute('cy', y);
          dot.setAttribute('r', '3');
          dot.setAttribute('fill', 'var(--accent)');
          chartSvg.appendChild(dot);
        });

        return el('div', { class: 'chart-container' }, chartSvg);
      })(),
    ]),

    // Data table section
    el('div', { class: 'panel table-panel' }, [
      el('div', { class: 'section-header' }, [
        el('h2', { html: 'Recent Systems' }),
        el('button', { class: 'btn btn-ghost btn-sm', html: 'View all →' }),
      ]),
      (() => {
        const table = el('div', { class: 'zeg-table modern' });
        const header = el('div', { class: 'table-header' });
        TABLE_COLUMNS.forEach(col => {
          header.appendChild(el('div', { class: 'table-cell table-head', html: col.label }));
        });
        table.appendChild(header);
        TABLE_ROWS.forEach(row => {
          const tr = el('div', { class: 'table-row' });
          TABLE_COLUMNS.forEach(col => {
            tr.appendChild(el('div', { class: 'table-cell', html: row[col.key] }));
          });
          table.appendChild(tr);
        });
        return table;
      })(),
    ]),
  ]);

  wrapper.appendChild(statsGrid);
  wrapper.appendChild(mainContent);
  container.appendChild(wrapper);

  return { refresh: () => {} };
}
