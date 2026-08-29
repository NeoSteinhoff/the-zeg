/* ═══════════════════════════════════════════════════
   THE ZEG — Treasury View
   Money tracking: revenue, costs, goal ladder, ledger
   ═══════════════════════════════════════════════════ */

export function init(container, api) {
  render(container, api);
}

export async function refresh(_api) {
  const container = document.querySelector('.main-content');
  if (container) render(container, _api || window.ZEG?.api);
}

function render(container, api) {
  container.innerHTML = `
    <div id="treasury">
      <div class="stat-grid" id="treasury-stats"></div>
      <div class="card">
        <div class="card-header">Goal Ladder</div>
        <div id="goal-ladder" style="margin-bottom:12px"></div>
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <input type="number" id="money-amount" placeholder="$ amount" style="flex:1;background:var(--panel);border:1px solid var(--border);color:var(--fg);padding:6px;border-radius:var(--radius);font-family:var(--mono);font-size:12px">
          <select id="money-kind" style="background:var(--panel);border:1px solid var(--border);color:var(--fg);padding:6px;border-radius:var(--radius);font-family:inherit;font-size:12px">
            <option value="revenue">+ revenue</option>
            <option value="cost">− cost</option>
          </select>
          <input type="text" id="money-note" placeholder="note" style="flex:1;background:var(--panel);border:1px solid var(--border);color:var(--fg);padding:6px;border-radius:var(--radius);font-family:var(--mono);font-size:12px">
          <button class="btn btn-primary" onclick="logMoney()" style="font-size:11px">Log</button>
        </div>
      </div>
      <div class="card">
        <div class="card-header">Ledger (last 20)</div>
        <table id="ledger-table">
          <thead>
            <tr><th>Date</th><th>Type</th><th>Amount</th><th>Note</th><th>Venture</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  `;
  loadData(api);
}

const GOALS = [1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000];

async function loadData(api) {
  const data = await api.fetch('/api/goals');
  if (!data) {
    showFallback();
    return;
  }

  const goals = data.goals || {};
  const progress = data.progress || 0;
  const target = goals.target_aed || 50000;

  // Convert AED to USD for display (approx 1 AED = 0.27 USD)
  const progressUSD = (progress || 0) * 0.27;

  document.getElementById('treasury-stats').innerHTML = `
    <div class="stat green"><div class="num">AED ${(progress || 0).toLocaleString()}</div><div class="lbl">Total Revenue (AED)</div></div>
    <div class="stat blue"><div class="num">$${progressUSD.toFixed(2)}</div><div class="lbl">Total Revenue (USD)</div></div>
    <div class="stat orange"><div class="num">${((progress / target) * 100 || 0).toFixed(0)}%</div><div class="lbl">to AED ${target.toLocaleString()}</div></div>
    <div class="stat purple"><div class="num">${GOALS.filter(g => g <= progress).length}</div><div class="lbl">Goals Hit (AED)</div></div>
    <div class="stat red"><div class="num">AED ${(target - progress).toLocaleString()}</div><div class="lbl">to Target</div></div>
  `;

  // Goal ladder (AED-denominated to match progress)
  const ladder = document.getElementById('goal-ladder');
  if (ladder) {
    ladder.innerHTML = GOALS.map(g => {
      const reached = progress >= g;
      return `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span class="badge ${reached ? 'badge-ok' : 'badge-pending'}">${reached ? '✓' : '○'}</span>
          <span style="${reached ? 'color:var(--good);text-decoration:line-through' : 'color:var(--muted)'}">AED ${g.toLocaleString()}</span>
          <div style="flex:1;height:4px;background:var(--panel-2);border-radius:99px;overflow:hidden">
            <div style="height:100%;background:${reached ? 'var(--good)' : 'var(--border)'};width:${reached ? '100%' : (progress / g * 100 || 0) + '%'}"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Ledger table
  const tbody = document.querySelector('#ledger-table tbody');
  if (tbody) {
    tbody.innerHTML = (data.timeline || []).slice(0, 20).map(t => `
      <tr>
        <td><span style="font-family:var(--mono);font-size:11px">${t.timestamp || '—'}</span></td>
        <td><span class="badge ${t.type === 'revenue' ? 'badge-ok' : t.type === 'cost' ? 'badge-failed' : 'badge-running'}">${t.type || '—'}</span></td>
        <td>${t.amount ? '$' + t.amount.toLocaleString() : '—'}</td>
        <td>${t.title || '—'}</td>
        <td>${t.description || '—'}</td>
      </tr>
    `).join('') || '<tr><td colspan="5" class="empty">No ledger entries</td></tr>';
  }
}

function showFallback() {
  document.getElementById('treasury-stats').innerHTML =
    '<div class="stat orange"><div class="num">○○○</div><div class="lbl">API Disconnected</div></div>';
}

window.logMoney = function() {
  const amount = document.getElementById('money-amount').value;
  const kind = document.getElementById('money-kind').value;
  const note = document.getElementById('money-note').value;
  if (!amount) return;
  console.log('Log money:', { amount, kind, note });
  alert('[Zeg] Money logged: $' + amount + ' (' + kind + ') — ' + note);
  // Clear form
  document.getElementById('money-amount').value = '';
  document.getElementById('money-note').value = '';
};
