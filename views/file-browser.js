/**
 * Steinhoff Systems File Browser — Aceternity sidebar-11 pattern
 * Browse all files for steinhoff systems and souls with live indexing
 */
import { escapeHtml, fmtNum, showLoading, showError, el } from '../utils.js';
import { ZEG } from '../components.js';

const SYSTEMS = [
  {
    id: 'steincorp',
    name: 'Steinhoff Systems',
    icon: '🏢',
    type: 'organization',
    path: '/Users/neosteinhoff/Documents/Steinhoff Systems',
    children: [
      { name: 'steienvault', type: 'vault', icon: '🗂️', path: 'steienvault', children: [] },
      { name: 'leads', type: 'dir', icon: '🎯', path: 'leads', children: [
        { name: 'roster-db', type: 'db', icon: '📊', path: 'roster-db' },
        { name: 'telegram-channels.json', type: 'file', icon: '📄', path: 'telegram-channels.json' },
      ]},
      { name: 'business-brain', type: 'dir', icon: '🧠', path: 'business-brain', children: [
        { name: 'core/state.json', type: 'file', icon: '📄', path: 'core/state.json' },
      ]},
    ],
  },
  {
    id: 'soulproject',
    name: 'The Soul Project',
    icon: '🔮',
    type: 'organization',
    path: '/Users/neosteinhoff/Documents/The Soul Project',
    children: [
      { name: 'souls/hermes', type: 'dir', icon: '🔑', path: 'souls/hermes', children: [
        { name: 'REGISTRY.json', type: 'file', icon: '📄', path: 'REGISTRY.json' },
        { name: '20 souls', type: 'dir', icon: '👥', path: '20-souls', children: [] },
      ]},
      { name: 'tools/soul-extractor-hermes', type: 'dir', icon: '🛠️', path: 'tools/soul-extractor-hermes', children: [
        { name: 'bin/hermes-soul', type: 'file', icon: '⚡', path: 'bin/hermes-soul' },
        { name: '424-test pytest', type: 'file', icon: '��', path: '424-test' },
      ]},
    ],
  },
  {
    id: 'zeg',
    name: 'The Zeg',
    icon: '⚡',
    type: 'project',
    path: '/Users/neosteinhoff/the-zeg',
    children: [
      { name: 'index.html', type: 'file', icon: '🌐', path: 'index.html' },
      { name: 'views/', type: 'dir', icon: '📁', path: 'views', children: [
        { name: '25 view modules', type: 'file', icon: '📄', path: '25-views' },
      ]},
      { name: 'api/server.py', type: 'file', icon: '🐍', path: 'api/server.py' },
    ],
  },
];

function getTypeLabel(type) {
  const labels = { org: 'organization', dir: 'directory', file: 'file', db: 'database', vault: 'vault' };
  return labels[type] || type;
}

function getSize(node) {
  if (node.type === 'dir' || node.type === 'organization') return `${(node.children || []).length} items`;
  if (node.type === 'db') return 'database';
  return 'file';
}

export async function init(container) {
  showLoading(container, 'Loading File Browser...');
  container.innerHTML = '';

  const app = el('div', { class: 'file-browser-app' }, [
    // Left: Systems tree
    el('div', { class: 'file-sidebar' }, [
      el('div', { class: 'file-sidebar-header' }, [
        el('h2', { html: '🗂️ Steinhoff Systems' }),
        el('input', { type: 'text', class: 'file-search', placeholder: 'Filter files...' }),
      ]),
      el('div', { class: 'file-tree' }, renderTree(SYSTEMS)),
    ]),

    // Right: File detail
    el('div', { class: 'file-main' }, [
      el('div', { class: 'file-detail-placeholder' }, [
        el('div', { class: 'file-detail-empty' }, [
          el('div', { class: 'file-placeholder-icon', html: '🔍' }),
          el('p', { html: 'Select a file or folder to view details' }),
        ]),
      ]),
    ]),
  ]);

  function renderTree(nodes, depth = 0) {
    const wrap = document.createElement('div');
    wrap.className = 'file-tree-level';
    wrap.style.paddingLeft = `${depth * 16}px`;
    nodes.forEach(node => {
      const item = ZEG.CometCard({
        className: 'file-tree-item',
        children: el('div', { class: 'file-tree-node' }, [
          el('div', { class: 'file-tree-icon', html: node.icon }),
          el('div', { class: 'file-tree-content' }, [
            el('div', { class: 'file-tree-name', html: escapeHtml(node.name) }),
            el('div', { class: 'file-tree-path', html: escapeHtml(node.path) }),
            el('div', { class: 'file-tree-meta' }, [
              el('span', { class: 'file-tree-type', html: getTypeLabel(node.type) }),
              el('span', { class: 'file-tree-size', html: getSize(node) }),
            ]),
          ]),
          (node.children && node.children.length > 0)
            ? el('div', { class: 'file-tree-children' }, renderTree(node.children, depth + 1))
            : '',
        ]),
      });

      // Click to view file details
      item.addEventListener('click', () => {
        const main = container.querySelector('.file-main');
        if (main) {
          main.innerHTML = '';
          const detail = ZEG.CometCard({
            className: 'file-detail-card',
            children: el('div', { class: 'file-detail-content' }, [
              el('div', { class: 'file-detail-header' }, [
                el('span', { class: 'file-detail-icon', html: node.icon }),
                el('h3', { html: escapeHtml(node.name) }),
              ]),
              el('div', { class: 'file-detail-info' }, [
                el('div', { class: 'file-detail-row' }, [
                  el('span', { class: 'file-detail-label', html: 'Path' }),
                  el('span', { class: 'file-detail-value', html: escapeHtml(node.path) }),
                ]),
                el('div', { class: 'file-detail-row' }, [
                  el('span', { class: 'file-detail-label', html: 'Type' }),
                  el('span', { class: 'file-detail-value', html: getTypeLabel(node.type) }),
                ]),
                el('div', { class: 'file-detail-row' }, [
                  el('span', { class: 'file-detail-label', html: 'Size' }),
                  el('span', { class: 'file-detail-value', html: getSize(node) }),
                ]),
                el('div', { class: 'file-detail-row' }, [
                  el('span', { class: 'file-detail-label', html: 'Children' }),
                  el('span', { class: 'file-detail-value', html: node.children ? `${node.children.length} items` : '—' }),
                ]),
              ]),
            ]),
          });
          main.appendChild(detail);
        }
      });

      wrap.appendChild(item);
    });
    return wrap;
  }

  container.appendChild(app);

  return { refresh: () => {} };
}
