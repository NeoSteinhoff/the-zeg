/**
 * Obsidian Vault Explorer — sidebar-11 variant
 * Browse the steinvault Obsidian vault with backlink and graph visualization
 */
import { escapeHtml, fmtNum, showLoading, showError, el } from '../utils.js';
import { ZEG } from '../components.js';

// Vault structure — based on user's steinvault
const VAULT_NOTES = [
  { id: 'memory', title: 'MEMORY.md', icon: '🧠', tags: ['core', 'memory'], size: '2.1KB', links: ['00-core', '07-archive'] },
  { id: 'core', title: '00-core/', icon: '📁', tags: ['core'], size: '0', links: ['memory', '12-attachments'] },
  { id: 'ops', title: '06-operations/', icon: '📁', tags: ['ops'], size: '0', links: ['core', 'dating-pipeline'] },
  { id: 'pipeline', title: 'dating-pipeline/', icon: '🎯', tags: ['dating', 'ops'], size: '0', links: ['ops', 'pipeline.db'] },
  { id: 'attachments', title: '12-attachments/', icon: '📎', tags: ['core'], size: '0', links: ['core', 'memory'] },
  { id: 'ultron', title: '07-archive/_migrated-from-ultron', icon: '🗃️', tags: ['archive'], size: '0', links: ['core', 'memory'] },
];

export async function init(container) {
  showLoading(container, 'Loading Obsidian Vault...');
  container.innerHTML = '';

  const app = el('div', { class: 'obsidian-vault-app' }, [
    // Left sidebar — vault tree
    el('div', { class: 'obsidian-sidebar' }, [
      el('div', { class: 'obsidian-sidebar-header' }, [
        el('h2', { html: '🧠 steinvault' }),
        el('div', { class: 'obsidian-vault-meta' }, [
          el('span', { class: 'vault-file-count', html: '373 files' }),
          el('span', { class: 'vault-size', html: '8.4MB' }),
        ]),
      ]),
      el('input', { type: 'text', class: 'obsidian-search', placeholder: 'Search notes...' }),
      el('div', { class: 'obsidian-tree' }, VAULT_NOTES.map(note => {
        const card = ZEG.CometCard({
          className: 'obsidian-note-card',
          children: el('div', { class: 'obsidian-note-content' }, [
            el('div', { class: 'obsidian-note-header' }, [
              el('span', { class: 'obsidian-note-icon', html: note.icon }),
              el('span', { class: 'obsidian-note-title', html: escapeHtml(note.title) }),
            ]),
            el('div', { class: 'obsidian-note-tags' },
              note.tags.map(t => el('span', { class: 'obsidian-tag', html: t }))
            ),
            el('div', { class: 'obsidian-note-meta' }, [
              el('span', { class: 'obsidian-note-size', html: note.size }),
              el('span', { class: 'obsidian-note-links', html: `${note.links.length} links` }),
            ]),
          ]),
        });
        return card;
      })),
    ]),

    // Main content — graph view + note detail
    el('div', { class: 'obsidian-main' }, [
      el('div', { class: 'obsidian-graph-container' }, [
        el('h3', { html: 'Vault Graph' }),
        // SVG graph visualization
        (() => {
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('width', '100%');
          svg.setAttribute('height', '400');
          svg.setAttribute('viewBox', '0 0 600 400');
          svg.classList.add('obsidian-graph-svg');

          // Draw nodes
          VAULT_NOTES.forEach((note, i) => {
            const x = 100 + (i % 3) * 180;
            const y = 80 + Math.floor(i / 3) * 150;

            // Draw links
            note.links.forEach(targetId => {
              const target = VAULT_NOTES.find(n => n.id === targetId);
              if (target) {
                const tx = 100 + (VAULT_NOTES.indexOf(target) % 3) * 180;
                const ty = 80 + Math.floor(VAULT_NOTES.indexOf(target) / 3) * 150;
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', x);
                line.setAttribute('y1', y);
                line.setAttribute('x2', tx);
                line.setAttribute('y2', ty);
                line.setAttribute('stroke', 'var(--border)');
                line.setAttribute('strokeWidth', '1');
                line.setAttribute('strokeOpacity', '0.5');
                svg.appendChild(line);
              }
            });

            // Draw node
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', x);
            circle.setAttribute('cy', y);
            circle.setAttribute('r', '30');
            circle.setAttribute('fill', 'var(--panel)');
            circle.setAttribute('stroke', 'var(--accent)');
            circle.setAttribute('strokeWidth', '2');
            svg.appendChild(circle);

            // Node label
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', x);
            text.setAttribute('y', y + 50);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('fill', 'var(--fg)');
            text.setAttribute('fontSize', '10');
            text.textContent = note.title;
            svg.appendChild(text);
          });

          return el('div', { class: 'graph-wrapper' }, svg);
        })(),
      ]),

      // Note detail panel
      el('div', { class: 'obsidian-note-detail' }, [
        el('div', { class: 'note-detail-placeholder' }, [
          el('h3', { html: 'Select a note to read' }),
          el('p', { html: 'Click any note in the sidebar to view its contents and backlinks.' }),
        ]),
      ]),
    ]),
  ]);

  container.appendChild(app);

  return { refresh: () => {} };
}
