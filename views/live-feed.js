/* ════════════════════════════════════════════════════════════
   THE ZEG — Live Feed View
   Timeline-node rendering for sessions, tasks, cron jobs, soul pipeline
   Features from: Hermes Command Center timeline.html + Aurora live feed
   ════════════════════════════════════════════════════════════ */

export function init(container, api) {
  container.innerHTML = `
    <div id="live-feed">
      <div class="feed-header">
        <h1>📡 Live Feed</h1>
        <button class="btn btn-ghost" onclick="window.zegFeedRefresh()" style="float:right">↻ Refresh</button>
      </div>
      <p style="color:var(--muted);margin-bottom:16px">Chronological activity stream — sessions, tasks, cron jobs, soul pipeline events.</p>

      <div class="cards" id="lf-stats"></div>

      <div class="panel">
        <h2>Recent Activity</h2>
        <div class="timeline-container" style="position:relative">
          <div class="timeline-line"></div>
          <div id="lf-stream">
            <div class="empty">Loading timeline...</div>
          </div>
        </div>
      </div>
    </div>
  `;
  loadData(api);
}

export async function refresh(_api) {
  loadData(window.ZEG?.api);
}

window.zegFeedRefresh = () => loadData(window.ZEG?.api);

async function loadData(api) {
  if (!api) api = window.ZEG?.api;
  if (!api) return;

  const [timeline, tasks, crons, souls, sessions] = await Promise.all([
    api.fetch('/api/timeline'),
    api.fetch('/api/tasks'),
    api.fetch('/api/crons'),
    api.fetch('/api/soul-engine'),
    api.fetch('/api/command-center'),
  ].map(p => p.catch(() => null)));

  render(timeline, tasks, crons, souls, sessions);
}

function render(timeline, tasks, crons, souls, sessions) {
  const el = (id) => document.getElementById(id);

  // Stats
  const events = timeline?.events || [];
  const tlist = tasks?.tasks || [];
  const clist = crons?.crons || [];
  const slist = souls?.stats || {};
  const sess = sessions?.hermes?.sessions || sessions?.stats || {};

  el('lf-stats').innerHTML = `
    <div class="stat blue"><div class="num">${events.length}</div><div class="lbl">Timeline Events</div></div>
    <div class="stat green"><div class="num">${tlist.filter(t=>t.status==='done').length}</div><div class="lbl">Tasks Done</div></div>
    <div class="stat orange"><div class="num">${tlist.filter(t=>t.status==='in_progress').length}</div><div class="lbl">In Progress</div></div>
    <div class="stat red"><div class="num">${tlist.filter(t=>t.status==='blocked').length}</div><div class="lbl">Blocked</div></div>
    <div class="stat purple"><div class="num">${clist.length}</div><div class="lbl">Cron Jobs</div></div>
  `;

  // Build timeline stream
  let allItems = [];

  // Sessions from command-center (recent sessions)
  const recentSessions = (sessions?.hermes?.sessions || slist.sessions || [])
    .slice(0, 15)
    .map(s => ({
      type: 'session',
      title: s.title || s.display_name || 'Untitled Session',
      ts: s.started_at || s.last_activity_at,
      status: s.ended_at ? 'done' : 'running',
      meta: `Model: ${s.model || 'unknown'} · Tokens: ${fmtNum((s.input_tokens||0)+(s.output_tokens||0))}`,
      error: null
    }));
  allItems.push(...recentSessions);

  // Tasks
  const taskItems = tlist.slice(0, 20).map(t => ({
    type: 'task',
    title: t.title || 'Untitled',
    ts: t.created_at,
    status: t.status || 'todo',
    meta: `Priority: ${t.priority || 'normal'} · Assigned: ${t.assignee || '—'}`,
    error: null
  }));
  allItems.push(...taskItems);

  // Cron jobs
  const cronItems = (clist || []).slice(0, 15).map(c => ({
    type: 'cron_job',
    title: c.name || c.id || 'Cron Job',
    ts: c.last_run || c.created_at,
    status: c.enabled ? 'running' : 'blocked',
    meta: `Schedule: ${c.schedule || '—'} · Last status: ${c.last_status || 'unknown'}`,
    error: c.last_error || null
  }));
  allItems.push(...cronItems);

  // Soul pipeline
  const soulItems = (timeline?.events || []).filter(e => e.type === 'soul_pipeline' || e.type === 'soul');
  allItems.push(...soulItems);

  // Sort by timestamp (newest first)
  allItems.sort((a, b) => {
    const ta = new Date(a.ts || 0).getTime();
    const tb = new Date(b.ts || 0).getTime();
    return tb - ta;
  });

  // Render timeline nodes
  let html = '';
  const activeItems = allItems.filter(i => i.status !== 'done' && i.status !== 'failed');
  const doneItems = allItems.filter(i => i.status === 'done' || i.status === 'failed');

  // Active items first
  html += '<div class="section-title">🟢 Active</div>';
  activeItems.slice(0, 10).forEach(item => {
    html += timelineNode(item);
  });

  // Done/failed items
  if (doneItems.length > 0) {
    html += '<div class="section-title">✅ Completed / Failed</div>';
    doneItems.slice(0, 10).forEach(item => {
      html += timelineNode(item);
    });
  }

  if (allItems.length === 0) {
    html = '<div class="empty">No recent activity found.</div>';
  }

  el('lf-stream').innerHTML = html;
}

function timelineNode(item) {
  const statusClass = item.error ? 'node-failed' :
    (item.status === 'running' ? 'node-active' :
     item.status === 'done' || item.status === 'ready' ? 'node-ok' :
     item.status === 'blocked' || item.status === 'failed' ? 'node-failed' : 'node-pending');
  const badgeClass = badgeMap[item.status] || 'badge-pending';
  return `
    <div class="timeline-node ${statusClass}">
      <div class="node-content">
        <div class="node-title">${item.title || 'Untitled'}</div>
        <div class="node-meta">
          ${badge(item.status)}
          ${item.meta ? '· ' + item.meta : ''}
        </div>
        ${item.error ? `<div class="node-error">${item.error.slice(0, 150)}</div>` : ''}
      </div>
    </div>
  `;
}

function badge(status) {
  const cls = badgeMap[status] || 'badge-pending';
  return `<span class="badge ${cls}">${status || 'unknown'}</span>`;
}

const badgeMap = {
  'running': 'badge-running', 'active': 'badge-active',
  'done': 'badge-done', 'ready': 'badge-ready',
  'blocked': 'badge-blocked', 'failed': 'badge-failed',
  'pending': 'badge-pending', 'todo': 'badge-pending',
  'script': 'badge-script', 'agent': 'badge-agent',
};

function fmtNum(n) {
  n = Number(n);
  if (n >= 1e9) return (n/1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
  return String(n);
}
