/* ═══════════════════════════════════════════════════
   THE ZEG — Goals View
   Revenue tracking for Dubai real estate automation
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
    <div id="goals">
      <div class="stat-grid" id="goals-stats"></div>
      <div class="card">
        <div class="card-header">Model A: Done-For-You (AED 5,500 + 3,000/mo)</div>
        <div class="stat-grid" id="goals-model-a"></div>
      </div>
      <div class="card">
        <div class="card-header">Model B: Lead Resale (AED 950/3,200 + 12% commission)</div>
        <div class="stat-grid" id="goals-model-b"></div>
      </div>
      <div class="card">
        <div class="card-header">Daily Activity Timeline</div>
        <table id="goals-timeline">
          <thead>
            <tr><th>Date</th><th>Activity</th><th>Channel</th><th>Status</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="card">
        <div class="card-header">Progress to AED 50K Target</div>
        <div style="height:20px;background:var(--panel-2);border-radius:99px;overflow:hidden">
          <div id="goals-progress-bar" style="height:100%;background:linear-gradient(90deg,var(--hot),var(--warm));width:0%;transition:width 1s"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:11px;color:var(--muted)">
          <span>AED 0</span><span id="goals-current">AED 0</span><span>AED 50,000</span>
        </div>
      </div>
    </div>
  `;

  loadData(api);
}

async function loadData(api) {
  const data = await api.fetch('/api/goals');
  if (!data) {
    showFallback();
    return;
  }

  const goals = data.goals || {};
  const modelA = goals.model_a || {};
  const modelB = goals.model_b || {};
  const timeline = data.timeline || [];
  const progress = data.progress || 0;

  // Main stats
  document.getElementById('goals-stats').innerHTML = `
    <div class="stat blue"><div class="num">${goals.target_aed || 50000}</div><div class="lbl">Target (AED)</div></div>
    <div class="stat green"><div class="num">${goals.current_aed || 0}</div><div class="lbl">Current Revenue</div></div>
    <div class="stat orange"><div class="num">${modelA.clients || 0}</div><div class="lbl">Model A Clients</div></div>
    <div class="stat purple"><div class="num">${modelB.sales || 0}</div><div class="lbl">Model B Packs Sold</div></div>
    <div class="stat red"><div class="num">${goals.days_remaining || 60}</div><div class="lbl">Days Remaining</div></div>
  `;

  // Model A
  document.getElementById('goals-model-a').innerHTML = `
    <div class="stat blue"><div class="num">${modelA.whatsapp_sent || 0}/${modelA.whatsapp_total || 31}</div><div class="lbl">WhatsApp Voice Notes</div></div>
    <div class="stat green"><div class="num">${modelA.replies || 0}</div><div class="lbl">Replies Received</div></div>
    <div class="stat orange"><div class="num">${modelA.booked || 0}</div><div class="lbl">Viewings Booked</div></div>
    <div class="stat green"><div class="num">${modelA.closed || 0}</div><div class="lbl">Deals Closed</div></div>
    <div class="stat purple"><div class="num">AED ${(modelA.revenue || 0).toLocaleString()}</div><div class="lbl">Revenue</div></div>
  `;

  // Model B
  document.getElementById('goals-model-b').innerHTML = `
    <div class="stat blue"><div class="num">${modelB.starter_sold || 0}</div><div class="lbl">Starter Packs (950)</div></div>
    <div class="stat green"><div class="num">${modelB.pro_sold || 0}</div><div class="lbl">Pro Packs (3,200)</div></div>
    <div class="stat orange"><div class="num">${modelB.affiliate_sales || 0}</div><div class="lbl">Affiliate Commissions</div></div>
    <div class="stat purple"><div class="num">AED ${(modelB.projected_per_blast || 46656).toLocaleString()}</div><div class="lbl">Projected/Blast</div></div>
    <div class="stat red"><div class="num">AED ${(modelB.revenue || 0).toLocaleString()}</div><div class="lbl">Revenue</div></div>
  `;

  // Timeline
  const tbody = document.querySelector('#goals-timeline tbody');
  if (tbody) {
    tbody.innerHTML = timeline.map(t => `
      <tr>
        <td>${t.date || '—'}</td>
        <td>${t.activity || '—'}</td>
        <td><span class="badge ${t.channel === 'whatsapp' ? 'badge-agent' : 'badge-running'}">${t.channel || '—'}</span></td>
        <td><span class="badge ${t.status === 'done' ? 'badge-ok' : t.status === 'pending' ? 'badge-pending' : 'badge-failed'}">${t.status || '—'}</span></td>
      </tr>
    `).join('') || '<tr><td colspan="4" class="empty">No activity yet</td></tr>';
  }

  // Progress bar
  const pct = Math.min(100, (progress / (goals.target_aed || 50000)) * 100);
  document.getElementById('goals-progress-bar').style.width = `${pct}%`;
  document.getElementById('goals-current').textContent = `AED ${progress.toLocaleString()}`;
}

function showFallback() {
  document.getElementById('goals-stats').innerHTML =
    '<div class="stat orange"><div class="num">○○○</div><div class="lbl">API Disconnected</div></div>';
}