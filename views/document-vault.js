/**
 * Document Vault — Aceternity sidebar-10 pattern
 * Notion-style document browser with pages, databases, and search
 */
import { escapeHtml, fmtNum, showLoading, showError, el } from '../utils.js';
import { ZEG } from '../components.js';

// Demo documents — would come from API in production
const DEMO_DOCS = [
  {
    id: 'doc-1',
    title: 'Steinhoff Systems Architecture',
    type: 'doc',
    icon: '🏗️',
    path: '/docs/architecture.md',
    updated: '2026-08-29T14:30:00Z',
    created: '2026-08-15T09:00:00Z',
    size: '4.2KB',
    tags: ['architecture', 'system', 'core'],
    folder: 'business',
    starred: true,
  },
  {
    id: 'doc-2',
    title: 'Dating Pipeline SOP',
    type: 'doc',
    icon: '🎯',
    path: '/docs/pipeline-sop.md',
    updated: '2026-08-28T20:15:00Z',
    created: '2026-08-20T12:00:00Z',
    size: '8.7KB',
    tags: ['pipeline', 'sop', 'dating'],
    folder: 'business',
    starred: true,
  },
  {
    id: 'doc-3',
    title: 'Finance Forecast Q3-Q4',
    type: 'doc',
    icon: '📈',
    path: '/docs/finance-forecast.md',
    updated: '2026-08-27T11:00:00Z',
    created: '2026-08-26T16:00:00Z',
    size: '12.1KB',
    tags: ['finance', 'forecast', 'planning'],
    folder: 'business',
    starred: false,
  },
  {
    id: 'doc-4',
    title: 'Obsidian Vault Structure',
    type: 'doc',
    icon: '🗂️',
    path: '/docs/vault.md',
    updated: '2026-08-25T08:30:00Z',
    created: '2026-08-25T08:30:00Z',
    size: '2.5KB',
    tags: ['vault', 'obsidian', 'docs'],
    folder: 'personal',
    starred: true,
  },
  {
    id: 'doc-5',
    title: 'Soul Extraction Guide',
    type: 'doc',
    icon: '🔮',
    path: '/docs/soul-guide.md',
    updated: '2026-08-24T15:45:00Z',
    created: '2026-08-22T10:00:00Z',
    size: '6.8KB',
    tags: ['souls', 'extraction', 'ai'],
    folder: 'ai',
    starred: false,
  },
  {
    id: 'db-1',
    title: 'Lead Pipeline Database',
    type: 'db',
    icon: '📊',
    path: '/dbs/leads',
    updated: '2026-08-30T10:00:00Z',
    created: '2026-08-01T00:00:00Z',
    size: '0',
    tags: ['database', 'leads', 'pipeline'],
    folder: 'business',
    starred: false,
  },
];

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export async function init(container) {
  showLoading(container, 'Loading Document Vault...');
  container.innerHTML = '';

  const docs = DEMO_DOCS;
  const folders = [...new Set(docs.map(d => d.folder))];
  const tags = [...new Set(docs.flatMap(d => d.tags))];

  const app = el('div', { class: 'vault-app' }, [
    // Left sidebar — Notion-style
    el('div', { class: 'vault-sidebar' }, [
      el('div', { class: 'vault-sidebar-header' }, [
        el('h2', { html: '🗂️ Document Vault' }),
        el('button', { class: 'btn btn-primary btn-sm', html: '+ New' }),
      ]),
      el('div', { class: 'vault-search' }, [
        el('input', { type: 'text', class: 'vault-search-input', placeholder: 'Search docs and pages...' }),
      ]),
      el('div', { class: 'vault-nav' }, [
        el('div', { class: 'vault-nav-item active', html: '🏠 All Pages' }),
        ...folders.map(f => el('div', { class: 'vault-nav-item', html: `📁 ${f}` })),
        el('div', { class: 'vault-nav-item', html: '⭐ Starred' }),
        el('div', { class: 'vault-nav-item', html: '🗑️ Trash' }),
      ]),
    ]),

    // Right main content
    el('div', { class: 'vault-main' }, [
      // Toolbar
      el('div', { class: 'vault-toolbar' }, [
        el('span', { class: 'vault-view-toggle', html: '📋 Table' }),
        el('div', { class: 'vault-toolbar-actions' }, [
          el('button', { class: 'btn btn-ghost btn-sm', html: '🔍' }),
          el('button', { class: 'btn btn-ghost btn-sm', html: '⚙️' }),
        ]),
      ]),

      // Document grid
      el('div', { class: 'vault-grid' }, docs.map(doc => {
        const card = ZEG.CometCard({
          className: 'vault-card',
          children: el('div', { class: 'vault-card-content' }, [
            el('div', { class: 'vault-card-icon', html: doc.icon }),
            el('div', { class: 'vault-card-body' }, [
              el('div', { class: 'vault-card-title', html: escapeHtml(doc.title) }),
              el('div', { class: 'vault-card-meta' }, [
                el('span', { class: 'vault-card-type', html: doc.type === 'db' ? 'Database' : 'Page' }),
                el('span', { class: 'vault-card-updated', html: `Updated ${formatDate(doc.updated)}` }),
                el('span', { class: 'vault-card-size', html: doc.size }),
              ]),
              el('div', { class: 'vault-card-tags' },
                doc.tags.map(t => el('span', { class: 'vault-tag', html: t }))
              ),
            ]),
          ]),
        });
        return card;
      })),
    ]),
  ]);

  container.appendChild(app);

  return { refresh: () => {} };
}
