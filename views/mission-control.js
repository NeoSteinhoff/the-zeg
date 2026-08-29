/* ════════════════════════════════════════════════════════════
   THE ZEG — Mission Control View
   Aurora BusinessBrain Mission Control — agent grid, venture
   pipeline, seed form, launch pad, live feed all-in-one
   Features from: Aurora BusinessBrain dashboard/index.html
   ════════════════════════════════════════════════════════════ */

export function init(container, api) {
  container.innerHTML = `
    <div id="mission-control">
      <header class="mc-header">
        <h1>🛰️ Mission Control</h1>
        <span id="mc-mode-badge" class="badge badge-live">🟢 LIVE</span>
        <span id="mc-uptime" class="uptime">—</span>
      </header>

      <div class="stat-grid" id="mc-stats"></div>

      <main class="mc-main">
        <div class="mc-col-main">
          <section>
            <h2>Agents <span class="hint">the swarm</span></h2>
            <div id="mc-agents" class="agent-grid"></div>
          </section>
          <section>
            <h2>Venture Pipeline <span class="hint">every business, every stage</span></h2>
            <div id="mc-board" class="board"></div>
          </section>
        </div>
        <aside class="mc-col-side">
          <section class="seed-box">
            <h2>Seed an idea</h2>
            <form id="mc-seed-form">
              <input id="mc-seed-input" type="text" maxlength="300" placeholder="e.g. retro tees for plant parents…" autocomplete="off" />
              <button class="btn btn-primary" type="submit">→ VISION</button>
            </form>
          </section>
          <section>
            <h2>Launch Pad <span class="count-pill" id="mc-approval-count" hidden></span></h2>
            <div id="mc-approvals" class="approvals"></div>
          </section>
          <section class="feed-section">
            <h2>Live Feed</h2>
            <div id="mc-feed" class="feed"></div>
          </section>
        </aside>
      </main>
    </div>
  `;
  initUptime();
  loadData(api);
  initSeedForm();
}

export async function refresh() {
  loadData(window.ZEG?.api);
}

function initUptime() {
  const start = Date.now();
  const el = document.getElementById('mc-uptime');
  const update = () => {
    const elapsed = Math.floor((Date.now() - start) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    if (el) el.textContent = `Uptime: ${mins}m ${secs}s`;
  };
  update();
  setInterval(update, 1000);
}

function initSeedForm() {
  const form = document.getElementById('mc-seed-form');
  const input = document.getElementById('mc-seed-input');
  if (!form || !input) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const idea = input.value.trim();
    if (!idea) return;
    input.value = '';
    addFeedItem('seed', `Seeded idea: "${idea.slice(0, 80)}"`, 'sys');
    addApproval(idea);
  });
}

async function loadData(api) {
  if (!api) api = window.ZEG?.api;
  if (!api) return;

  const [ventures, ecosystem, pipeline, tasks] = await Promise.all([
    api.fetch('/api/ventures'),
    api.fetch('/api/ecosystem'),
    api.fetch('/api/timeline'),
    api.fetch('/api/tasks'),
  ].map(p => p.catch(() => null)));

  render(ventures, ecosystem, pipeline, tasks);
}

function render(ventures, ecosystem, pipeline, tasks) {
  const el = (id) => document.getElementById(id);

  // Stats
  const biz = ventures?.businesses || {};
  let totalRevenue = 0;
  let totalBiz = 0;
  const bizBuckets = ['etsy_pod', 'fiverr_thumbnails', 'micro_saas', 'content', 'saas', 'trading', 'productized'];
  bizBuckets.forEach(bucket => {
    const b = biz[bucket];
    if (b) {
      totalBiz++;
      totalRevenue += b.revenue_usd || 0;
    }
  });
  const ecoStats = ecosystem?.stats || {};
  const taskList = tasks?.tasks || [];

  el('mc-stats').innerHTML = `
    <div class="stat purple"><div class="num">${totalBiz}</div><div class="lbl">Ventures</div></div>
    <div class="stat green"><div class="num">${fmtNum(totalRevenue)}</div><div class="lbl">Revenue $</div></div>
    <div class="stat blue"><div class="num">${ecoStats.total_agents || 0}</div><div class="lbl">AI Agents</div></div>
    <div class="stat orange"><div class="num">${taskList.filter(t => t.status === 'todo').length}</div><div class="lbl">Pending Tasks</div></div>
    <div class="stat red"><div class="num">${taskList.filter(t => t.status === 'blocked').length}</div><div class="lbl">Blocked</div></div>
  `;

  // Agent grid
  el('mc-agents').innerHTML = ecoStats.agents?.length ? ecoStats.agents.map(a => `
    <div class="agent-card ${a.status || ''}">
      <div class="agent-name">${a.name || a.id || 'Agent'}</div>
      <div class="agent-status">${a.status || 'unknown'}</div>
      <div class="metric-row"><span>Throughput</span><span>${a.throughput || 0}/s</span></div>
    </div>
  `).join('') : '<div class="empty">No agent data</div>';

  // Venture pipeline board
  el('mc-board').innerHTML = renderVentureBoard(biz);

  // Seed input
  el('mc-approvals').innerHTML = '<div class="sub" style="padding:10px">No pending launches</div>';
}

function renderVentureBoard(biz) {
  const buckets = [
    { id: 'etsy_pod', name: 'Etsy POD', label: '🛍️ Etsy' },
    { id: 'fiverr_thumbnails', name: 'Fiverr Thumbnails', label: '💸 Fiverr' },
    { id: 'micro_saas', name: 'Micro SaaS', label: '☁️ SaaS' },
    { id: 'content', name: 'Content', label: '📝 Content' },
    { id: 'saas', name: 'SaaS', label: '🏢 SaaS' },
    { id: 'trading', name: 'Trading', label: '📈 Trading' },
    { id: 'productized', name: 'Productized', label: '📦 Product' },
  ];
  let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">';
  buckets.forEach(b => {
    const data = biz[b.id] || {};
    const pending = (data.pending || []).length;
    const accepted = (data.accepted || []).length;
    const revenue = data.revenue_usd || 0;
    const color = revenue > 0 ? 'var(--good)' : '#5b6473';
    html += `
      <div class="card" style="text-align:center;padding:10px">
        <div style="font-size:14px">${b.label}</div>
        <div style="font-weight:600;font-size:14px;color:${color}">$${revenue}</div>
        <div style="font-size:10px;color:var(--muted)">${pending} pending · ${accepted} accepted</div>
      </div>
    `;
  });
  html += '</div>';
  return html;
}

function addFeedItem(type, text, severity) {
  const feed = document.getElementById('mc-feed');
  if (!feed) return;
  const cls = severity === 'err' ? 'feed-error' : severity === 'warn' ? 'feed-warn' : 'feed-item';
  const ts = new Date().toLocaleTimeString();
  const colors = { sys: 'var(--accent)', err: 'var(--hot)', warn: 'var(--warm)' };
  feed.innerHTML = `
    <div class="${cls}" style="font-size:11px;padding:4px 0;border-bottom:1px solid var(--border);color:${colors[severity]||'var(--muted)'}">
      <span style="color:${colors[severity]||'var(--muted)'}">[${ts}]</span> ${text}
    </div>
  ` + feed.innerHTML;
}

function addApproval(idea) {
  const count = document.getElementById('mc-approval-count');
  const approvals = document.getElementById('mc-approvals');
  if (!count || !approvals) return;
  count.hidden = false;
  count.textContent = '1';
  approvals.innerHTML = `
    <div class="approval-item" style="padding:6px 0;border-bottom:1px solid var(--border)">
      <div style="font-size:12px">${idea.slice(0, 60)}</div>
      <div style="font-size:10px;color:var(--muted)">Awaiting launch approval</div>
    </div>
  ` + approvals.innerHTML;
}

let feedCount = 0;
function addLiveFeed(text, type) {
  addFeedItem(type, text, type === 'err' ? 'err' : type === 'warn' ? 'warn' : 'sys');
}

function fmtNum(n) {
  n = Number(n);
  if (n >= 1e9) return (n/1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
  return String(n);
}
