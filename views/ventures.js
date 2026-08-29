/* ═══════════════════════════════════════════════════
   THE ZEG — Venture Pipeline View
   Business ventures in Kanban board format (Etsy POD, Fiverr, SaaS, etc.)
   ═══════════════════════════════════════════════════ */

export function init(container, api) {
  render(container, api);
}

export async function refresh(_api) {
  const container = document.querySelector('.main-content');
  if (container) render(container, _api || window.ZEG?.api);
}

const PIPELINE_STAGES = [
  { key: 'pending', label: 'Pending', color: 'var(--muted)' },
  { key: 'ready_to_build', label: 'Ready to Build', color: 'var(--blue)' },
  { key: 'building', label: 'Building', color: 'var(--purple)' },
  { key: 'live', label: 'Live', color: 'var(--good)' },
  { key: 'done', label: 'Done', color: 'var(--warm)' },
  { key: 'graveyard', label: 'Graveyard', color: 'var(--hot)' },
];

function render(container, api) {
  container.innerHTML = `
    <div id="ventures">
      <div class="stat-grid" id="ventures-stats"></div>
      <div class="card">
        <div class="card-header">Business Ventures Pipeline</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px" id="venture-filters"></div>
        <div id="venture-board" style="display:flex;gap:12px;overflow-x:auto;padding:8px 0"></div>
      </div>
    </div>
  `;
  loadData(api);
}

async function loadData(api) {
  // Try to get from business-brain state
  const data = await api.fetch('/api/ventures');
  if (!data) {
    showFallback();
    return;
  }

  const businesses = data.businesses || {};
  const ventures = [];
  for (const [key, val] of Object.entries(businesses)) {
    ventures.push({
      id: key,
      name: BUSINESS_NAMES[key] || key,
      status: val.status || 'unknown',
      revenue: val.revenue_usd || 0,
      target: val.revenue_target_usd || 0,
      category: key,
      description: getBizDescription(key),
    });
  }

  // Stats
  const liveCount = ventures.filter(v => v.status === 'live').length;
  const totalRevenue = ventures.reduce((sum, v) => sum + v.revenue, 0);
  const ready = ventures.filter(v => v.status === 'ready_to_build' || v.status === 'pending').length;

  document.getElementById('ventures-stats').innerHTML = `
    <div class="stat blue"><div class="num">${ventures.length}</div><div class="lbl">Total Ventures</div></div>
    <div class="stat green"><div class="num">${liveCount}</div><div class="lbl">Live</div></div>
    <div class="stat orange"><div class="num">$${totalRevenue.toFixed(2)}</div><div class="lbl">Total Revenue</div></div>
    <div class="stat purple"><div class="num">${ready}</div><div class="lbl">To Build</div></div>
    <div class="stat red"><div class="num">${ventures.filter(v => v.status === 'graveyard').length}</div><div class="lbl">Killed</div></div>
  `;

  // Filters
  const filters = document.getElementById('venture-filters');
  if (filters) {
    filters.innerHTML = `<button class="btn btn-ghost" style="font-size:10px;padding:2px 8px" onclick="filterVentures('all')">All</button>`;
    PIPELINE_STAGES.forEach(s => {
      filters.innerHTML += `<button class="btn btn-ghost" style="font-size:10px;padding:2px 8px" onclick="filterVentures('${s.key}')">${s.label}</button>`;
    });
  }

  renderBoard(ventures, 'all');
}

const BUSINESS_NAMES = {
  etsy_pod: 'Etsy POD',
  fiverr_thumbnails: 'Fiverr Thumbnails',
  micro_saas: 'Micro SaaS',
  content: 'Content',
  saas: 'SaaS',
  trading: 'Trading',
  productized: 'Productized',
};

const BUSINESS_DESCRIPTIONS = {
  etsy_pod: 'Print-on-demand store with POD designs',
  fiverr_thumbnails: 'Fiverr gig selling custom thumbnails',
  micro_saas: 'Micro SaaS tool for specific niche',
  content: 'Content creation and monetization',
  saas: 'Full SaaS product development',
  trading: 'Algorithmic trading systems',
  productized: 'Productized service offerings',
};

function getBizDescription(key) {
  return BUSINESS_DESCRIPTIONS[key] || 'Business venture';
}

function renderBoard(ventures, filter) {
  const board = document.getElementById('venture-board');
  if (!board) return;

  const visible = filter === 'all' ? ventures : ventures.filter(v => v.status === filter || v.category === filter);
  board.innerHTML = '';

  PIPELINE_STAGES.forEach(stage => {
    const colItems = visible.filter(v => (v.status || 'pending') === stage.key);
    const col = document.createElement('div');
    col.className = 'venture-column';
    col.style.cssText = `min-width:200px;display:flex;flex-direction:column`;

    col.innerHTML = `
      <div class="sec-h" style="margin:0 0 8px"><span style="color:${stage.color}">${stage.label}</span> <span class="count">${colItems.length}</span></div>
      <div style="flex:1">
        ${colItems.map(v => `
          <div class="card" style="cursor:move;margin-bottom:6px;padding:8px" onclick="viewVenture('${v.id}')">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
              <span class="badge badge-agent">${v.category}</span>
              <span style="font-weight:600;font-size:11px">${v.name}</span>
            </div>
            <div style="font-size:10px;color:var(--muted);line-height:1.4;margin-bottom:4px">${getBizDescription(v.category)}</div>
            <div style="display:flex;justify-content:space-between;font-size:10px">
              <span style="color:var(--good)">$${v.revenue.toFixed(2)}</span>
              <span style="color:var(--muted)">target: $${v.target.toFixed(2)}</span>
            </div>
          </div>
        `).join('') || '<div class="sub" style="padding:8px;font-size:10px">— empty —</div>'}
      </div>
    `;
    board.appendChild(col);
  });
}

function showFallback() {
  document.getElementById('ventures-stats').innerHTML =
    '<div class="stat orange"><div class="num">○○○</div><div class="lbl">API Disconnected</div></div>';
}

window.filterVentures = function(filter) {
  // Would need venture data cached
  console.log('Filter:', filter);
};

window.viewVenture = function(id) {
  console.log('View venture:', id);
};
