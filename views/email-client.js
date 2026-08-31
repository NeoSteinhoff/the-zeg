/**
 * Email Client — Aceternity sidebar-09 pattern
 * Sub-system: See individual emails, Resend integration, inbox management
 */
import { escapeHtml, fmtNum, showLoading, showError, el } from '../utils.js';
import { ZEG } from '../components.js';

/**
 * Fetch emails from Resend API + local storage
 */
async function fetchEmails() {
  // Try local API for Resend emails
  try {
    const resp = await fetch('http://localhost:8700/api/email');
    const data = await resp.json();
    return data.emails || getDemoEmails();
  } catch {
    return getDemoEmails();
  }
}

function getDemoEmails() {
  const now = Date.now();
  return [
    {
      id: '1',
      from: 'sponsorship@resend.dev',
      from_name: 'Resend Sponsorship',
      to: 'neosteinhoff@ste.in',
      subject: 'Your sponsorship email is ready for review',
      body: 'Hi, your sponsorship campaign has been processed. 127 emails sent, 34 opened.\n\nRevenue: $2,340 AED\nOpens: 34\nClicks: 12',
      date: new Date(now - 1000 * 60 * 30).toISOString(),
      read: false,
      starred: true,
      labels: ['sponsorship', 'resend'],
      folder: 'inbox',
    },
    {
      id: '2',
      from: 'leads@ste.in',
      from_name: 'Lead System',
      to: 'neosteinhoff@ste.in',
      subject: 'New leads from Dubai campaign',
      body: '5 new leads captured from the real estate campaign. All have valid WhatsApp numbers.\n\nAction: Send WhatsApp voice notes within 2 hours.',
      date: new Date(now - 1000 * 60 * 120).toISOString(),
      read: true,
      starred: false,
      labels: ['leads', 'urgent'],
      folder: 'inbox',
    },
    {
      id: '3',
      from: 'agent@circule.com',
      from_name: 'Circle Agent',
      to: 'neosteinhoff@ste.in',
      subject: 'Pipeline: 3 girls moved to Active stage',
      body: 'Pipeline update: Sarah moved to Active, Mia moved to Active, Zoe moved to Active.\n\nTotal active: 4/6 slots filled.',
      date: new Date(now - 1000 * 60 * 60 * 2).toISOString(),
      read: true,
      starred: true,
      labels: ['pipeline', 'dating'],
      folder: 'inbox',
    },
    {
      id: '4',
      from: 'cron@ste.in',
      from_name: 'Cron Monitor',
      to: 'neosteinhoff@ste.in',
      subject: 'Cron job: lead-research paused',
      body: 'The lead-research cron job was paused at 13:45. Reason: Rate limit exceeded.\n\nAuto-resume scheduled for 14:00.',
      date: new Date(now - 1000 * 60 * 60 * 5).toISOString(),
      read: false,
      starred: false,
      labels: ['cron', 'warning'],
      folder: 'sent',
    },
    {
      id: '5',
      from: 'billing@vercel.com',
      from_name: 'Vercel Billing',
      to: 'neosteinhoff@ste.in',
      subject: 'Invoice: The Zeg deployment',
      body: 'Your Vercel project is using 847 MB bandwidth this month.\n\nEstimated cost: $0 (Hobby plan)',
      date: new Date(now - 1000 * 60 * 60 * 24).toISOString(),
      read: true,
      starred: false,
      labels: ['billing', 'deployment'],
      folder: 'sent',
    },
  ];
}

function formatDate(iso) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return d.toLocaleDateString();
}

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function getRandomColor(seed) {
  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + hash * 31;
  return colors[Math.abs(hash) % colors.length];
}

export async function init(container) {
  showLoading(container, 'Loading Email Client...');
  container.innerHTML = '';

  const emails = await fetchEmails();
  const folders = ['inbox', 'sent', 'drafts', 'starred'];
  const labels = ['all', 'sponsorship', 'leads', 'urgent', 'pipeline', 'cron', 'billing', 'deployment'];

  const app = el('div', { class: 'email-app' }, [
    // Left: Folder list
    el('div', { class: 'email-sidebar' }, [
      el('div', { class: 'email-sidebar-header' }, [
        el('h2', { html: 'Email Client' }),
        el('button', { class: 'btn btn-primary btn-sm', html: '+ Compose' }),
      ]),
      el('div', { class: 'email-folders' }, [
        ...folders.map(f => el('div', {
          class: `email-folder ${f === 'inbox' ? 'active' : ''}`,
          html: `<span class="folder-icon">${
            f === 'inbox' ? '📬' : f === 'sent' ? '📤' : f === 'drafts' ? '📝' : '⭐'
          }</span><span class="folder-name">${f}</span>${
            f === 'inbox' ? el('span', { class: 'folder-count', html: emails.filter(e => e.folder === 'inbox').length.toString() }) : ''
          }`
        })),
      ]),
      el('div', { class: 'email-labels' }, [
        el('h3', { html: 'Labels' }),
        ...labels.map(l => el('div', {
          class: 'email-label',
          style: { color: l === 'all' ? 'var(--accent)' : 'var(--muted)' },
          html: l === 'all' ? '🏷️ All' : `<span class="label-dot" style="background:${getRandomColor(l)}"></span>${l}`
        })),
      ]),
    ]),

    // Right: Main email area
    el('div', { class: 'email-main' }, [
      // Toolbar
      el('div', { class: 'email-toolbar' }, [
        el('input', { type: 'text', class: 'email-search', placeholder: 'Search emails...' }),
        el('div', { class: 'email-toolbar-actions' }, [
          el('button', { class: 'btn btn-ghost btn-sm', html: '📎' }),
          el('button', { class: 'btn btn-ghost btn-sm', html: '🗑️' }),
          el('button', { class: 'btn btn-ghost btn-sm', html: '☰' }),
        ]),
      ]),

      // Email list
      el('div', { class: 'email-list' }, emails.map(email => {
        const card = ZEG.CometCard({
          className: 'email-card',
          children: el('div', { class: 'email-card-content' }, [
            el('div', { class: 'email-header' }, [
              el('div', { class: 'email-sender' }, [
                el('div', {
                  class: 'sender-avatar',
                  style: { background: getRandomColor(email.from_name) },
                  html: getInitials(email.from_name),
                }),
                el('div', { class: 'sender-info' }, [
                  el('div', { class: 'sender-name', html: escapeHtml(email.from_name) }),
                  el('div', { class: 'sender-email', html: escapeHtml(email.from) }),
                ]),
              ]),
              el('div', { class: 'email-meta' }, [
                el('span', { class: 'email-time', html: formatDate(email.date) }),
                (email.starred ? el('span', { class: 'star-icon', html: '⭐' }) : ''),
              ]),
            ]),
            el('div', { class: 'email-subject', html: escapeHtml(email.subject) }),
            el('div', { class: 'email-body', html: escapeHtml(email.body).replace(/\n/g, '<br>') }),
            el('div', { class: 'email-labels-row' },
              email.labels.map(l => el('span', {
                class: 'email-tag',
                style: { background: `${getRandomColor(l)}20`, color: getRandomColor(l) },
                html: l
              }))
            ),
          ]),
        });
        return card;
      })),
    ]),
  ]);

  container.appendChild(app);

  return {
    refresh: async () => {
      const fresh = await fetchEmails();
      return { emails: fresh.length };
    }
  };
}
