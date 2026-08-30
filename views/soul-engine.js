/* ══════════════════════════════════════════════════
   THE ZEG — Soul Engine View
   20 first-person souls + Hamza-Ali persona
   ═══════════════════════════════════════════════════ */

import { showLoading, escapeHtml, createTextElement } from '../utils.js';

export function init(container, api) {
  showLoading('Loading soul engine…', container);
  render(container, api);
}

export async function refresh(_api) {
  const container = document.querySelector('.main-content');
  if (container) render(container, _api || window.ZEG?.api);
}

function render(container, api) {
  container.innerHTML = `
    <div id="soul-engine">
      <div class="stat-grid" id="soul-stats"></div>
      <div class="card">
        <div class="card-header">Soul Catalog (20 First-Person Souls)</div>
        <div id="soul-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px"></div>
      </div>
      <div class="card">
        <div class="card-header">Active Soul: <span id="soul-active-name">—</span></div>
        <div style="display:flex;gap:8px;margin-bottom:10px">
          <input type="text" id="soul-prompt" style="flex:1;background:var(--panel);border:1px solid var(--border);color:var(--fg);padding:8px;border-radius:var(--radius);font-family:inherit;font-size:13px" placeholder="Ask the soul...">
          <button class="btn btn-primary" onclick="sendToSoul()">Send</button>
          <button class="btn btn-ghost" onclick="talkToSoul()">Talk</button>
        </div>
        <div id="soul-response" style="min-height:200px;background:var(--panel-2);border-radius:var(--radius);padding:16px;font-size:14px;line-height:1.6"></div>
      </div>
    </div>
  `;

  loadData(api);
}

async function loadData(api) {
  const data = await api.fetch('/api/soul-engine');
  if (!data) {
    showFallback();
    return;
  }

  const stats = data.stats || {};
  // SECURITY: Use DOM APIs instead of innerHTML with template literals
  const statsEl = document.getElementById('soul-stats');
  statsEl.innerHTML = ''; // Clear
  [
    { class: 'blue', num: stats.total_souls || 20, lbl: 'Total Souls' },
    { class: 'green', num: stats.dating_souls || 6, lbl: 'Dating Souls' },
    { class: 'orange', num: stats.business_souls || 12, lbl: 'Business Souls' },
    { class: 'red', num: stats.discipline_souls || 1, lbl: 'Discipline Souls' },
    { class: 'purple', num: stats.creative_souls || 1, lbl: 'Creative Souls' },
  ].forEach(s => {
    const card = document.createElement('div');
    card.className = `stat ${s.class}`;
    const num = document.createElement('div');
    num.className = 'num';
    num.textContent = s.num;
    const lbl = document.createElement('div');
    lbl.className = 'lbl';
    lbl.textContent = s.lbl;
    card.appendChild(num);
    card.appendChild(lbl);
    statsEl.appendChild(card);
  });

  const souls = data.souls || [];
  const grid = document.getElementById('soul-grid');
  if (grid) {
    grid.innerHTML = '';
    souls.forEach(s => {
      const card = document.createElement('div');
      card.className = 'card';
      card.style.cursor = 'pointer';
      card.onclick = () => selectSoul(s.name);
      
      const header = document.createElement('div');
      header.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px';
      
      const badge = document.createElement('span');
      const category = s.category || 'unknown';
      const badgeClass = category === 'dating' ? 'badge-hot' : 
                        category === 'business' ? 'badge-agent' : 
                        category === 'discipline' ? 'badge-pending' : 'badge-running';
      badge.className = `badge ${badgeClass}`;
      badge.textContent = category;
      
      const nameSpan = document.createElement('span');
      nameSpan.style.cssText = 'font-weight:500;font-size:12px';
      nameSpan.textContent = s.name || '—';
      
      header.appendChild(badge);
      header.appendChild(nameSpan);
      
      const desc = document.createElement('div');
      desc.style.cssText = 'font-size:10px;color:var(--muted);line-height:1.4';
      desc.textContent = (s.description || '').slice(0, 80) + ((s.description || '').length > 80 ? '...' : '');
      
      const btnContainer = document.createElement('div');
      btnContainer.style.cssText = 'margin-top:6px;display:flex;gap:4px';
      ['ask', 'talk', 'advise'].forEach(fn => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-ghost';
        btn.style.cssText = 'font-size:9px;padding:2px 6px';
        btn.textContent = fn;
        btn.onclick = (e) => {
          e.stopPropagation();
          quickSoul(s.name, fn);
        };
        btnContainer.appendChild(btn);
      });
      
      card.appendChild(header);
      card.appendChild(desc);
      card.appendChild(btnContainer);
      grid.appendChild(card);
    });
    
    if (!souls.length) {
      grid.innerHTML = '<div class="sub">No souls loaded</div>';
    }
  }

  // Select default soul
  if (souls.length) {
    selectSoul(souls[0].name);
  }
}

function selectSoul(name) {
  document.getElementById('soul-active-name').textContent = name;
  const response = document.getElementById('soul-response');
  response.innerHTML = '';
  const div = document.createElement('div');
  div.style.color = 'var(--muted)';
  div.textContent = `Soul "${name}" selected. Ask it anything.`;
  response.appendChild(div);
}

async function sendToSoul() {
  const prompt = document.getElementById('soul-prompt');
  const response = document.getElementById('soul-response');
  const soul = document.getElementById('soul-active-name').textContent;
  if (!prompt.value.trim()) return;

  const query = prompt.value;
  response.innerHTML = '';
  const thinking = document.createElement('div');
  thinking.style.color = 'var(--muted)';
  thinking.textContent = 'Thinking... 🤔';
  response.appendChild(thinking);

  try {
    const result = await ZEG.api.fetch(`/api/soul/${soul}?q=${encodeURIComponent(query)}`);
    response.innerHTML = '';
    if (result && result.response) {
      // SECURITY: result.response comes from API — treat as untrusted, use textContent
      const div = document.createElement('div');
      div.textContent = result.response;
      response.appendChild(div);
    } else {
      const div = document.createElement('div');
      div.style.color = 'var(--muted)';
      div.textContent = `[Offline mode] Soul "${soul}" would respond to: "${query}"`;
      response.appendChild(div);
    }
  } catch (e) {
    response.innerHTML = '';
    const div = document.createElement('div');
    div.style.color = 'var(--muted)';
    div.textContent = `[API Error] Could not reach soul "${soul}"`;
    response.appendChild(div);
  }
}

async function talkToSoul() {
  const soul = document.getElementById('soul-active-name').textContent;
  try {
    const result = await ZEG.api.fetch(`/api/soul/${soul}/talk?duration=30`);
    const response = document.getElementById('soul-response');
    response.innerHTML = '';
    if (result && result.transcript) {
      // SECURITY: transcript from API — use textContent in pre element
      const pre = document.createElement('pre');
      pre.style.cssText = 'font-size:12px;line-height:1.6;white-space:pre-wrap';
      pre.textContent = result.transcript;
      response.appendChild(pre);
    }
  } catch (e) {
    console.error(e);
  }
}

async function quickSoul(name, action) {
  selectSoul(name);
  if (action === 'ask') {
    document.getElementById('soul-prompt').value = 'What is your core advice for this situation?';
    await sendToSoul();
  } else if (action === 'talk') {
    await talkToSoul();
  } else if (action === 'advise') {
    document.getElementById('soul-prompt').value = 'Advise me on a critical decision I am facing.';
    await sendToSoul();
  }
}

window.selectSoul = selectSoul;
window.sendToSoul = sendToSoul;
window.talkToSoul = talkToSoul;
window.quickSoul = quickSoul;

function showFallback() {
  const statsEl = document.getElementById('soul-stats');
  statsEl.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'stat orange';
  const num = document.createElement('div');
  num.className = 'num';
  num.textContent = '○○○';
  const lbl = document.createElement('div');
  lbl.className = 'lbl';
  lbl.textContent = 'API Disconnected';
  div.appendChild(num);
  div.appendChild(lbl);
  statsEl.appendChild(div);
}