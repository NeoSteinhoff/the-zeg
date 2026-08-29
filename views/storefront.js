/**
 * Storefront View — Lead Storefront / Campaigns
 */
(function () {
  const css = document.createElement('style');
  css.textContent = `
    .storefront-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-4); }
    .storefront-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-4); transition: border-color var(--fast) ease, box-shadow var(--fast) ease; }
    .storefront-card:hover { border-color: var(--accent); box-shadow: var(--glow-sm); }
    .storefront-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-3); }
    .storefront-title { font-weight: 600; font-size: var(--text-lg); }
    .storefront-metric { font-size: var(--text-2xl); font-weight: 700; color: var(--accent); margin: var(--space-2) 0; }
    .storefront-desc { color: var(--muted); font-size: var(--text-sm); margin-bottom: var(--space-3); }
    .storefront-actions { display: flex; gap: var(--space-2); }
    .btn { padding: var(--space-2) var(--space-4); border-radius: var(--radius-md); font-weight: 500; cursor: pointer; border: 1px solid transparent; transition: all var(--fast) ease; }
    .btn-primary { background: var(--accent); color: var(--bg); }
    .btn-primary:hover { filter: brightness(1.1); }
    .btn-ghost { background: transparent; border-color: var(--border); color: var(--fg); }
    .stat-row { display: flex; justify-content: space-between; padding: var(--space-2) 0; border-bottom: 1px solid var(--border); font-size: var(--text-sm); }
    .stat-row:last-child { border-bottom: none; }
  `;
  document.head.appendChild(css);

  async function init(container, api) {
    container.innerHTML = `
      <section class="view">
        <header class="view-header">
          <h1 class="view-title">Lead Storefront</h1>
          <p class="view-subtitle">Campaigns, packs, and commission tracking</p>
        </header>
        <div id="sf-stats" class="stat-grid" style="margin-bottom: var(--space-6);"></div>
        <div id="sf-campaigns" class="storefront-grid"></div>
      </section>
    `;
    loadData(api);
  }

  async function loadData(api) {
    try {
      const data = await api.fetch('/api/storefront');
      if (!data) throw new Error('No data');
      renderStats(data.stats);
      renderCampaigns(data.campaigns || []);
    } catch (e) {
      console.warn('[Storefront] API failed, showing fallback:', e);
      showFallback();
    }
  }

  function renderStats(stats) {
    const el = document.getElementById('sf-stats');
    if (!el) return;
    const s = stats || { total_sales: 0, revenue: 0, packs_sold: 0, active_campaigns: 0, commission: 0 };
    el.innerHTML = `
      <div class="stat"><div class="num">${s.total_sales || 0}</div><div class="lbl">Total Sales</div></div>
      <div class="stat green"><div class="num">AED ${(s.revenue || 0).toLocaleString()}</div><div class="lbl">Revenue</div></div>
      <div class="stat blue"><div class="num">${s.packs_sold || 0}</div><div class="lbl">Packs Sold</div></div>
      <div class="stat orange"><div class="num">${s.active_campaigns || 0}</div><div class="lbl">Active Campaigns</div></div>
      <div class="stat purple"><div class="num">AED ${(s.commission || 0).toLocaleString()}</div><div class="lbl">Commission</div></div>
    `;
  }

  function renderCampaigns(campaigns) {
    const el = document.getElementById('sf-campaigns');
    if (!el) return;
    if (!campaigns.length) {
      el.innerHTML = '<p class="muted" style="grid-column:1/-1;text-align:center;padding:var(--space-8)">No campaigns configured</p>';
      return;
    }
    el.innerHTML = campaigns.map(c => `
      <article class="storefront-card">
        <div class="storefront-header">
          <h3 class="storefront-title">${c.name || 'Unnamed Campaign'}</h3>
          <span class="badge ${c.status === 'active' ? 'green' : 'gray'}">${c.status || 'draft'}</span>
        </div>
        <p class="storefront-desc">${c.description || 'No description'}</p>
        <div class="stat-row"><span>Pack Price</span><span>AED ${c.pack_price || 0}</span></div>
        <div class="stat-row"><span>Commission</span><span>${c.commission_pct || 0}%</span></div>
        <div class="stat-row"><span>Leads</span><span>${c.leads_count || 0}</span></div>
        <div class="storefront-actions">
          <button class="btn btn-primary" onclick="alert('Deploy ${c.name}')">Deploy</button>
          <button class="btn btn-ghost" onclick="alert('Edit ${c.name}')">Edit</button>
        </div>
      </article>
    `).join('');
  }

  function showFallback() {
    const statsEl = document.getElementById('sf-stats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="stat orange"><div class="num">○○○</div><div class="lbl">API Disconnected</div></div>
        <div class="stat orange"><div class="num">○○○</div><div class="lbl">API Disconnected</div></div>
        <div class="stat orange"><div class="num">○○○</div><div class="lbl">API Disconnected</div></div>
        <div class="stat orange"><div class="num">○○○</div><div class="lbl">API Disconnected</div></div>
        <div class="stat orange"><div class="num">○○○</div><div class="lbl">API Disconnected</div></div>
      `;
    }
    const campaignsEl = document.getElementById('sf-campaigns');
    if (campaignsEl) {
      campaignsEl.innerHTML = '<p class="muted" style="grid-column:1/-1;text-align:center;padding:var(--space-8)">No network data available</p>';
    }
  }

  window.StorefrontView = { init };
})();