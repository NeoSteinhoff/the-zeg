/* ════════════════════════════════════════════════════════════
   THE ZEG — Hermes Control View
   Interface to interact with Hermes Agent directly from the dashboard.
   Send prompts, view sessions, check process status.
   ════════════════════════════════════════════════════════════ */

import { fmtNum, fmtRelative, showLoading } from '../utils.js';

export function init(container, api) {
  showLoading('Loading Hermes control…', container);
  render(container);
  loadData(api);
}

export async function refresh(_api) {
  loadData(window.ZEG?.api);
}

async function loadData(api) {
  if (!api) api = window.ZEG?.api;
  if (!api) return;

  const [status, sessions, sys] = await Promise.all([
    api.getHermesStatus(),
    api.getHermesSessions(20),
    api.fetch('/api/system'),
  ].map(p => p.catch(() => null)));

  renderStatus(status, sessions, sys);
}

function render(container) {
  container.innerHTML = `
    <div id="hermes-control">
      <header class="hc-header">
        <h1>🔑 Hermes Control</h1>
        <span id="hc-mode-badge" class="badge badge-ok">● Ready</span>
      </header>
      <p style="color:var(--muted);margin-bottom:16px">
        Interface to the Hermes Agent — send prompts, view sessions, check process status.
        Uses <code style="color:var(--accent)">hermes chat -q</code> for one-shot queries.
      </p>

      <div class="cards" id="hc-stats"></div>

      <div class="panel">
        <h2>🧠 Hermes Processes</h2>
        <div id="hc-processes">
          <div class="loading-spinner">○</div>
        </div>
      </div>

      <div class="panel">
        <h2>📝 Send Prompt to Hermes</h2>
        <form id="hc-prompt-form">
          <input id="hc-prompt-input" type="text" maxlength="500"
            placeholder='e.g. "Summarize my recent sessions" or "What is my goal?"'
            autocomplete="off" />
          <div style="margin-top:8px">
            <button class="btn btn-primary" type="submit">→ Send to Hermes</button>
            <button type="button" class="btn btn-ghost" id="hc-clear-btn" style="margin-left:8px">Clear</button>
          </div>
        </form>
        <div id="hc-response" style="margin-top:16px;display:none;">
          <div class="card-header">Response</div>
          <div class="card" id="hc-response-content" style="white-space:pre-wrap;font-family:var(--mono);font-size:12px"></div>
        </div>
      </div>

      <div class="panel">
        <h2>📋 Recent Sessions</h2>
        <div id="hc-sessions">
          <div class="loading-spinner">○</div>
        </div>
      </div>
    </div>
  `;

  initPromptForm();
}

function initPromptForm() {
  const form = document.getElementById('hc-prompt-form');
  const input = document.getElementById('hc-prompt-input');
  const clearBtn = document.getElementById('hc-clear-btn');
  if (!form || !input) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (!query) return;

    const responseEl = document.getElementById('hc-response');
    const contentEl = document.getElementById('hc-response-content');
    if (!responseEl || !contentEl) return;

    responseEl.style.display = 'block';
    contentEl.textContent = '⧗ Waiting for Hermes…';

    try {
      const result = await window.ZEG.api.hermesChat(query);
      if (result && result.response) {
        contentEl.textContent = result.response;
      } else if (result && result.error) {
        contentEl.textContent = `❌ Error: ${result.error}`;
      } else {
        contentEl.textContent = 'No response from Hermes.';
      }
    } catch (err) {
      contentEl.textContent = `❌ Network error: ${err.message}`;
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (input) input.value = '';
      const responseEl = document.getElementById('hc-response');
      if (responseEl) responseEl.style.display = 'none';
    });
  }
}

function renderStatus(status, sessions, sys) {
  const el = (id) => document.getElementById(id);
  const badge = (id) => document.getElementById(id);

  // Stats
  const procCount = (status?.running || []).length;
  const gatewayUp = status?.gateway || false;
  const sessCount = (sessions?.sessions || []).length;
  const sysStats = sys?.command_center?.stats || {};

  const statsEl = el('hc-stats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="stat ${procCount > 0 ? 'green' : 'red'}"><div class="num">${procCount}</div><div class="lbl">Hermes Procs</div></div>
      <div class="stat ${gatewayUp ? 'green' : 'red'}"><div class="num">${gatewayUp ? 'UP' : 'DOWN'}</div><div class="lbl">Gateway</div></div>
      <div class="stat blue"><div class="num">${sessCount}</div><div class="lbl">Recent Sessions</div></div>
      <div class="stat orange"><div class="num">${fmtNum(sysStats.active_sessions || 0)}</div><div class="lbl">Active Sessions</div></div>
    `;
  }

  // Mode badge
  const badgeEl = badge('hc-mode-badge');
  if (badgeEl) {
    badgeEl.className = `badge ${gatewayUp ? 'badge-ok' : 'badge-failed'}`;
    badgeEl.textContent = gatewayUp ? '● LIVE' : '● OFFLINE';
  }

  // Processes
  const procEl = el('hc-processes');
  if (procEl) {
    if (!status || procCount === 0) {
      procEl.innerHTML = '<div class="empty-state">No Hermes processes detected. Start one with: <code>hermes</code> or <code>hermes gateway start</code></div>';
    } else {
      procEl.innerHTML = `
        <table>
          <thead><tr><th>PID</th><th>Command</th><th>CPU</th><th>Mem</th></tr></thead>
          <tbody>
          ${status.running.map(p => `
            <tr>
              <td class="mono">${p.pid}</td>
              <td class="mono">${p.command}</td>
              <td>${p.cpu}</td>
              <td>${p.mem}</td>
            </tr>
          `).join('')}
          </tbody>
        </table>
      `;
    }
  }

  // Sessions
  const sessEl = el('hc-sessions');
  if (sessEl) {
    const sl = sessions?.sessions || [];
    if (!sl.length) {
      sessEl.innerHTML = '<div class="empty-state">No recent sessions found in state.db.</div>';
    } else {
      sessEl.innerHTML = `
        <table>
          <thead><tr><th>Session</th><th>Model</th><th>Tokens</th><th>Cost</th><th>Status</th><th>Updated</th></tr></thead>
          <tbody>
          ${sl.map(s => {
            const isended = s.ended_at ? 'done' : 'running';
            const badgeCls = isended === 'done' ? 'badge-ok' : 'badge-running';
            const badgeTxt = isended === 'done' ? 'Done' : 'Active';
            const totalTok = (s.input_tokens || 0) + (s.output_tokens || 0);
            const updated = s.ended_at || s.started_at;
            return `
            <tr>
              <td class="mono">${s.display_name || s.title || 'Untitled'}</td>
              <td>${s.model || '—'}</td>
              <td>${fmtNum(totalTok)}</td>
              <td>$${s.actual_cost_usd || '0.00'}</td>
              <td><span class="badge ${badgeCls}">${badgeTxt}</span></td>
              <td><span class="sub">${fmtRelative(updated)}</span></td>
            </tr>
          `;
          }).join('')}
          </tbody>
        </table>
      `;
    }
  }
}
