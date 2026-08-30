/**
 * ════════════════════════════════════════════════════════════
   THE ZEG — Finance View
   Business finance tracking: revenue, expenses, cash flow, projections
   ════════════════════════════════════════════════════════════
 */
import { fmtNum, fmtPercent, showError, showLoading } from '../utils.js';

let currentData = null;
let currentContainer = null;

export function init(container, api) {
  currentContainer = container;
  showLoading('Loading finance…', container);
  render(container, api);
}

async function render(container, api) {
  try {
    const data = await api.fetch('/api/finance');
    if (!data || !data.finance) {
      // Fallback to static
      const fallback = await fetch('/data/static/finance.json');
      if (fallback.ok) {
        const fd = await fallback.json();
        data = fd;
      }
    }
    
    if (!data) {
      showError('Failed to load finance data', container);
      return;
    }
    
    currentData = data;
    renderFinance(data, container, api);
    
    const statusText = document.getElementById('status-text');
    if (statusText) statusText.textContent = 'Finance Dashboard ready';
    
  } catch (err) {
    showError(err.message || 'Failed to load', container);
  }
}

function renderFinance(data, container, api) {
  const f = data.finance || data;
  const progress = f.projections ? Math.min(100, (f.projections.current_aed || 0) / f.projections.goal_aed * 100) : 0;
  
  container.innerHTML = `
    <div class="section-header">
      <span class="section-icon">💰</span>
      <span class="section-title">Finance Dashboard</span>
      <span class="section-subtitle">Steinhoff Group — Dubai Real Estate Automation</span>
    </div>
    
    <div class="stat-grid">
      <div class="stat">
        <div class="num" style="color: var(--good)">AED ${fmtNum(f.net_worth_aed || 0)}</div>
        <div class="lbl">Net Worth</div>
      </div>
      <div class="stat">
        <div class="num" style="color: var(--accent)">AED ${fmtNum(f.monthly_revenue_aed || 0)}</div>
        <div class="lbl">Monthly Revenue</div>
      </div>
      <div class="stat">
        <div class="num" style="color: var(--warm)">AED ${fmtNum(f.monthly_expenses_aed || 0)}</div>
        <div class="lbl">Monthly Expenses</div>
      </div>
      <div class="stat">
        <div class="num" style="color: var(--good)">AED ${fmtNum(f.cash_flow_aed || 0)}</div>
        <div class="lbl">Monthly Cash Flow</div>
      </div>
    </div>
    
    ${f.projections ? `
    <div class="card">
      <div class="card-header">Goal Progress</div>
      <div class="health-row">
        <span class="health-label">50K AED in 2 months — ${f.projections.days_remaining || 31} days left</span>
        <div class="health-bar">
          <div class="health-fill" style="width: ${progress}%">${Math.round(progress)}%</div>
        </div>
        <span class="health-num">AED ${fmtNum(f.projections.current_aed || 18450)} / ${fmtNum(f.projections.goal_aed || 50000)}</span>
      </div>
    </div>
    ` : ''}
    
    <div class="grid-2">
      <div class="card">
        <div class="card-header">Revenue Streams</div>
        <table class="data-table">
          <thead>
            <tr><th>Stream</th><th>Amount (AED)</th><th>Frequency</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${(f.revenue_streams || []).map(s => `
              <tr>
                <td>${s.name}</td>
                <td>${fmtNum(s.amount_aed)}</td>
                <td>${s.frequency}</td>
                <td><span class="status-dot ${s.status === 'active' ? 'green' : 'orange'}"></span> ${s.status}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <div class="card">
        <div class="card-header">Expenses</div>
        <table class="data-table">
          <thead>
            <tr><th>Item</th><th>Amount (AED)</th><th>Frequency</th></tr>
          </thead>
          <tbody>
            ${(f.expenses || []).map(e => `
              <tr>
                <td>${e.name}</td>
                <td>${fmtNum(e.amount_aed)}</td>
                <td>${e.frequency}</td>
              </tr>
            `).join('')}
            <tr style="font-weight: 600; border-top: 2px solid var(--border);">
              <td>Total</td>
              <td>${fmtNum(f.monthly_expenses_aed || 0)}</td>
              <td>monthly</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    
    ${f.projections ? `
    <div class="card">
      <div class="card-header">Projections</div>
      <div class="stat-grid">
        <div class="stat">
          <div class="num" style="color: var(--blue)">AED ${fmtNum(f.projections.month_1_aed || 18450)}</div>
          <div class="lbl">Month 1</div>
        </div>
        <div class="stat">
          <div class="num" style="color: var(--purple)">AED ${fmtNum(f.projections.month_2_aed || 32000)}</div>
          <div class="lbl">Month 2</div>
        </div>
        <div class="stat">
          <div class="num" style="color: var(--accent)">AED ${fmtNum(f.projections.goal_aed || 50000)}</div>
          <div class="lbl">Goal</div>
        </div>
      </div>
    </div>
    ` : ''}
  `;
}

export async function refresh(api) {
  if (currentContainer) {
    await render(currentContainer, api);
  }
}
