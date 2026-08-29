/* ═══════════════════════════════════════════════════
   THE ZEG — Soul Engine View
   20 first-person souls + Hamza-Ali persona
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
  document.getElementById('soul-stats').innerHTML = `
    <div class="stat blue"><div class="num">${stats.total_souls || 20}</div><div class="lbl">Total Souls</div></div>
    <div class="stat green"><div class="num">${stats.dating_souls || 6}</div><div class="lbl">Dating Souls</div></div>
    <div class="stat orange"><div class="num">${stats.business_souls || 12}</div><div class="lbl">Business Souls</div></div>
    <div class="stat red"><div class="num">${stats.discipline_souls || 1}</div><div class="lbl">Discipline Souls</div></div>
    <div class="stat purple"><div class="num">${stats.creative_souls || 1}</div><div class="lbl">Creative Souls</div></div>
  `;

  const souls = data.souls || [];
  const grid = document.getElementById('soul-grid');
  if (grid) {
    grid.innerHTML = souls.map(s => `
      <div class="card" style="cursor:pointer" onclick="selectSoul('${s.name}')">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span class="badge ${s.category === 'dating' ? 'badge-hot' : s.category === 'business' ? 'badge-agent' : s.category === 'discipline' ? 'badge-pending' : 'badge-running'}">${s.category}</span>
          <span style="font-weight:500;font-size:12px">${s.name}</span>
        </div>
        <div style="font-size:10px;color:var(--muted);line-height:1.4">${(s.description || '').slice(0, 80)}${(s.description || '').length > 80 ? '...' : ''}</div>
        <div style="margin-top:6px;display:flex;gap:4px">
          ${['ask','talk','advise'].map(fn => `<button class="btn btn-ghost" style="font-size:9px;padding:2px 6px" onclick="quickSoul('${s.name}','${fn}')">${fn}</button>`).join('')}
        </div>
      </div>
    `).join('') || '<div class="sub">No souls loaded</div>';
  }

  // Select default soul
  if (souls.length) {
    selectSoul(souls[0].name);
  }
}

function selectSoul(name) {
  document.getElementById('soul-active-name').textContent = name;
  document.getElementById('soul-response').innerHTML =
    `<div style="color:var(--muted)">Soul "${name}" selected. Ask it anything.</div>`;
}

async function sendToSoul() {
  const prompt = document.getElementById('soul-prompt');
  const response = document.getElementById('soul-response');
  const soul = document.getElementById('soul-active-name').textContent;
  if (!prompt.value.trim()) return;

  const query = prompt.value;
  response.innerHTML = `<div style="color:var(--muted)">Thinking... 🤔</div>`;

  try {
    const result = await ZEG.api.fetch(`/api/soul/${soul}?q=${encodeURIComponent(query)}`);
    if (result && result.response) {
      response.innerHTML = `<div>${result.response}</div>`;
    } else {
      response.innerHTML = `<div style="color:var(--muted)">[Offline mode] Soul "${soul}" would respond to: "${query}"</div>`;
    }
  } catch (e) {
    response.innerHTML = `<div style="color:var(--muted)">[API Error] Could not reach soul "${soul}"</div>`;
  }
}

async function talkToSoul() {
  const soul = document.getElementById('soul-active-name').textContent;
  try {
    const result = await ZEG.api.fetch(`/api/soul/${soul}/talk?duration=30`);
    if (result && result.transcript) {
      document.getElementById('soul-response').innerHTML =
        `<pre style="font-size:12px;line-height:1.6;white-space:pre-wrap">${result.transcript}</pre>`;
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
  document.getElementById('soul-stats').innerHTML =
    '<div class="stat orange"><div class="num">○○○</div><div class="lbl">API Disconnected</div></div>';
}