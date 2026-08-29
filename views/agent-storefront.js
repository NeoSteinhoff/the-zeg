/* ═══════════════════════════════════════════════════
   THE ZEG — Agent Storefront View
   Lead packs: AED 950 (3,200 leads) + 12% commission
   ═══════════════════════════════════════════════════ */

export function init(container, api) {
  render(container, api);
}

export async function refresh() {
  const container = document.querySelector('.main-content');
  if (container) render(container, ZEG.api);
}

function render(container, api) {
  container.innerHTML = `
    <div id="storefront">
      <div class="stat-grid" id="sf-stats"></div>
      <div class="card">
        <div class="card-header">Storefront Catalog</div>
        <div id="sf-products"></div>
      </div>
      <div class="card">
        <div class="card-header">Recent Leads (Live Feed)</div>
        <div style="max-height:300px;overflow-y:auto">
          <table id="sf-leads">
            <thead>
              <tr><th>ID</th><th>Name</th><th>Source</th><th>Score</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header">Revenue Breakdown</div>
        <canvas id="sf-chart" width="800" height="200" style="width:100%;height:200px"></canvas>
      </div>
    </div>
  `;

  loadData(api);
}

async function loadData(api) {
  const data = await api.fetch('/api/storefront');
  if (!data) {
    showFallback();
    return;
  }

  const stats = data.stats || {};
  const products = data.products || [];
  const leads = data.leads || [];
  const revenue = data.revenue_breakdown || [];

  // Stats
  document.getElementById('sf-stats').innerHTML = `
    <div class="stat blue"><div class="num">${stats.total_sales || 0}</div><div class="lbl">Total Sales</div></div>
    <div class="stat green"><div class="num">AED ${(stats.revenue || 0).toLocaleString()}</div><div class="lbl">Total Revenue</div></div>
    <div class="stat orange"><div class="num">AED ${(stats.commission || 0).toLocaleString()}</div><div class="lbl">Commission (12%)</div></div>
    <div class="stat purple"><div class="num">${stats.packs_sold || 0}</div><div class="lbl">Packs Sold</div></div>
    <div class="stat red"><div class="num">${stats.active_campaigns || 0}</div><div class="lbl">Active Campaigns</div></div>
  `;

  // Products
  const sfProducts = document.getElementById('sf-products');
  if (sfProducts) {
    sfProducts.innerHTML = products.map(p => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--panel-2);border-radius:var(--radius);margin-bottom:8px">
        <div>
          <div style="font-weight:600;font-size:14px">${p.name} — <span style="color:var(--warm)">AED ${p.price}</span></div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${p.description || ''}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">(${p.lead_count} leads) · 12% commission</div>
        </div>
        <button class="btn btn-primary" style="font-size:12px;padding:6px 14px" onclick="purchasePack('${p.id}')">Purchase</button>
      </div>
    `).join('');
  }

  // Leads table
  const tbody = document.querySelector('#sf-leads tbody');
  if (tbody) {
    tbody.innerHTML = leads.slice(0, 50).map(l => `
      <tr>
        <td><span style="font-family:var(--mono);font-size:11px">#${l.id || '—'}</span></td>
        <td>${l.name || '—'}</td>
        <td><span class="badge badge-agent">${l.source || '—'}</span></td>
        <td>${l.score || 0}/100</td>
        <td><span class="badge ${l.status === 'sold' ? 'badge-ok' : l.status === 'contacted' ? 'badge-running' : 'badge-pending'}">${l.status || 'new'}</span></td>
        <td><button class="btn btn-ghost" style="font-size:10px;padding:2px 8px">contact</button></td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="empty">No leads yet</td></tr>';
  }

  // Revenue chart
  drawChart('sf-chart', revenue);
}

function drawChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !data.length) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const maxVal = Math.max(...data.map(d => d.value || 0));

  ctx.fillStyle = (getComputedStyle(document.body).getPropertyValue('--panel-2') || '#1a1c20').trim();
  ctx.fillRect(0, 0, w, h);

  const barWidth = (w - 40) / data.length - 5;
  const barHeight = (h - 40) / maxVal;
  const blue = getComputedStyle(document.body).getPropertyValue('--blue').trim() || '#4ea8ff';
  const warm = getComputedStyle(document.body).getPropertyValue('--warm').trim() || '#ffb020';

  data.forEach((d, i) => {
    const x = 20 + i * ((w - 40) / data.length);
    const y = h - 20 - (d.value || 0) * barHeight;
    ctx.fillStyle = d.category === 'commission' ? warm : blue;
    ctx.fillRect(x, y, barWidth, (d.value || 0) * barHeight);

    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--muted').trim() || '#8b93a3';
    ctx.font = '9px monospace';
    ctx.fillText(d.label || '', x, h - 8);
  });
}

async function purchasePack(productId) {
  try {
    const result = await ZEG.api.post('/api/storefront/purchase', { product_id: productId });
    if (result && result.success) {
      alert('Purchase successful! Leads will be delivered shortly.');
    } else {
      alert('Purchase queued (offline mode)');
    }
  } catch (e) {
    alert('Purchase failed: ' + e.message);
  }
}

window.purchasePack = purchasePack;

function showFallback() {
  document.getElementById('sf-stats').innerHTML =
    '<div class="stat orange"><div class="num">○○○</div><div class="lbl">API Disconnected</div></div>';
}