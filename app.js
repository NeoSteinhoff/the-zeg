/* ════════════════════════════════════════════════════════════
   THE ZEG — Main Application Controller
   ════════════════════════════════════════════════════════════ */

// ─── Configuration ───
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8700'
  : '';

const THEME_DURATION = { dark: 0, cyberpunk: 0, acid: 0, matrix: 0, aurora: 0 };
const REFRESH_INTERVAL = 30000;

// ─── State ───
const state = {
  theme: localStorage.getItem('zeg-theme') || 'dark',
  currentView: 'command-center',
  apiConnected: false,
  data: {},
  refreshTimer: null,
  countdownTimer: null,
  refreshRemaining: 0,
};

// ─── DOM Elements ───
const elements = {
  themeToggle: document.getElementById('theme-toggle'),
  fullscreenBtn: document.getElementById('fullscreen-btn'),
  refreshBtn: document.getElementById('refresh-btn'),
  sidebarToggle: document.getElementById('sidebar-toggle'),
  sidebar: document.getElementById('sidebar'),
  mainContent: document.getElementById('main-content'),
  statusText: document.getElementById('status-text'),
  statusApi: document.getElementById('status-api'),
  statusTime: document.getElementById('status-time'),
  statusRefresh: document.getElementById('status-refresh'),
  themeRibbon: document.getElementById('theme-ribbon'),
  body: document.body,
};

// ─── Theme System ───
const THEMES = ['dark', 'cyberpunk', 'acid', 'matrix', 'aurora'];
const themeIcons = { dark: '🌙', cyberpunk: '⚡', acid: '🧪', matrix: '🟢', aurora: '🌌' };

function setTheme(themeName) {
  if (!THEMES.includes(themeName)) return;
  document.documentElement.setAttribute('data-theme', themeName);
  document.body.setAttribute('data-theme', themeName);
  state.theme = themeName;
  localStorage.setItem('zeg-theme', themeName);
  elements.themeRibbon.textContent = `${themeIcons[themeName]} ${themeName.toUpperCase()}`;
  elements.themeToggle.textContent = `${themeIcons[themeName]}`;

  // Update theme selector
  document.querySelectorAll('.theme-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.theme === themeName);
  });

  // Dispatch event for views to react
  window.dispatchEvent(new CustomEvent('theme-change', { detail: { theme: themeName } }));
}

function toggleTheme() {
  const currentIndex = THEMES.indexOf(state.theme);
  const nextTheme = THEMES[(currentIndex + 1) % THEMES.length];
  setTheme(nextTheme);
}

// ─── Navigation System ───
const VIEWS = [
  'command-center', 'circle-pipeline', 'mesh-crm', 'goals', 'timeline',
  'soul-engine', 'agent-storefront', 'ecosystem', 'hermes-control', 'aurora-brain',
  'system-health', 'agent-grid', 'mission-control', 'live-feed',
  'tasks', 'cron-monitor', 'ventures', 'treasury', 'war-room',
  'cost-models',
];

function navigateTo(viewName) {
  if (!VIEWS.includes(viewName)) return;
  // Cancel any running circle-pipeline animation before switching
  window.__cpAnimating = false;
  state.currentView = viewName;
  renderView(viewName);
  updateNav();
}

function updateNav() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === state.currentView);
  });
}

// ─── View Rendering System ───
function renderView(viewName) {
  elements.mainContent.innerHTML = '<div class="loading-spinner">○</div>';
  elements.statusText.textContent = `Loading: ${viewName}`;

  // Lazy-load view module
  import(`./views/${viewName}.js`)
    .then(module => {
      if (module && module.init) {
        module.init(elements.mainContent, api);
        elements.statusText.textContent = `${viewName} ready`;
      } else {
        throw new Error('View module has no init function');
      }
    })
    .catch(err => {
      elements.mainContent.innerHTML = `<div class="card"><div class="card-header">Error</div><p>Failed to load view: ${err.message}</p></div>`;
      elements.statusText.textContent = `Error loading ${viewName}`;
      console.error(err);
    });
}

// ─── API Client ───
const api = {
  connected: false,

  async fetch(endpoint, options = {}) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      state.apiConnected = true;
      this.connected = true;
      updateApiStatus(true);
      return await response.json();
    } catch (error) {
      console.warn('API fetch failed:', error.message);
      state.apiConnected = false;
      this.connected = false;
      updateApiStatus(false);

      // Fallback: try static JSON files for GET requests
      if (!options.method || options.method === 'GET') {
        const staticPath = endpoint.replace('/api/', '').replace('/', '-') + '.json';
        try {
          const fallbackResp = await fetch(`data/static/${staticPath}`);
          if (fallbackResp.ok) {
            const fallbackData = await fallbackResp.json();
            console.log('[Zeg] Using static fallback:', staticPath);
            return fallbackData;
          }
        } catch (e2) {
          // No static fallback either
        }
      }

      return null;
    }
  },

  async post(endpoint, data) {
    return this.fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // ─── Data Aggregators ───
  async getCommandCenterData() {
    return await this.fetch('/api/command-center');
  },

  async getCirclePipelineData() {
    return await this.fetch('/api/circle-pipeline');
  },

  async getCircleMeshData() {
    return await this.fetch('/api/mesh-crm');
  },

  async getGoalsData() {
    return await this.fetch('/api/goals');
  },

  async getTimelineData() {
    return await this.fetch('/api/timeline');
  },

  async getSoulEngineData() {
    return await this.fetch('/api/soul-engine');
  },

  async getStorefrontData() {
    return await this.fetch('/api/storefront');
  },

  async getEcosystemData() {
    return await this.fetch('/api/ecosystem');
  },

  async getHermesControlData() {
    return await this.fetch('/api/hermes-control');
  },

  async getAuroraBrainData() {
    return await this.fetch('/api/aurora-brain');
  },

  // ─── Hermes Control (Hermes Agent direct interface) ───
  async hermesChat(query, opts = {}) {
    return this.post('/api/hermes/chat', { query, ...opts });
  },

  async getHermesStatus() {
    return await this.fetch('/api/hermes/status');
  },

  async getHermesSessions(limit) {
    const qs = limit ? `?limit=${limit}` : '';
    return await this.fetch(`/api/hermes/sessions${qs}`);
  },

  // ─── Skill dashboard endpoints (from hermes-dashboard skill) ───
  async getSessionDetail(sessionId) {
    return await this.fetch('/api/session?id=' + encodeURIComponent(sessionId));
  },

  async getTaskDetail(taskId) {
    return await this.fetch('/api/task?id=' + encodeURIComponent(taskId));
  },

  async getCosts() {
    return await this.fetch('/api/costs');
  },

  async getModels() {
    return await this.fetch('/api/models');
  },

  async createTask(data) {
    return await this.post('/api/tasks/create', data);
  },
};

// ─── Global ZEG object (for views that need API access outside init) ───
window.ZEG = { api, state, elements };

// ─── Status Updates ───
function updateApiStatus(connected) {
  // Only update on actual state change to avoid flicker with checkApiHealth
  if (state.apiConnected === connected) return;
  state.apiConnected = connected;
  if (connected) {
    elements.statusApi.innerHTML = '<span class="status-dot green"></span> API: Connected';
    elements.statusApi.className = 'connected';
  } else {
    elements.statusApi.innerHTML = '<span class="status-dot red"></span> API: Disconnected';
    elements.statusApi.className = 'disconnected';
  }
}

async function checkApiHealth() {
  const health = await api.fetch('/api/health');
  if (health) {
    elements.statusApi.innerHTML = '<span class="status-dot green"></span> API: Healthy';
    elements.statusApi.className = 'connected';
    return true;
  } else {
    elements.statusApi.innerHTML = '<span class="status-dot orange"></span> API: Offline (static mode)';
    elements.statusApi.className = 'disconnected';
    return false;
  }
}

function updateClock() {
  const now = new Date();
  elements.statusTime.textContent = now.toLocaleTimeString();
}

// ─── LARP Mode ───
const LARP_PRESETS = {
    tokens: [
        { label: "Current tokens", multiplier: 1e11, suffix: "B" },
        { label: "Input tokens", multiplier: 3e10, suffix: "B" },
        { label: "Output tokens", multiplier: 5e10, suffix: "B" },
        { label: "Cache read", multiplier: 2e11, suffix: "B" },
        { label: "Cache creation", multiplier: 8e10, suffix: "B" },
    ],
    revenue: { model_a: 45000, model_b: 46656 * 8, total: 980000 },
    agents: { total: 645, active: 312, queued: 288, throughput: 9999 },
    sessions: { count: 4096, active: 1337 },
};

let larpMode = false;

function toggleLarpMode() {
    larpMode = !larpMode;
    const el = document.getElementById('status-text');
    if (el) {
        el.innerHTML = larpMode
            ? '<span style="color:var(--hot)">⚡ LARP MODE ACTIVE</span>'
            : 'Ready';
    }
    elements.body.classList.toggle('larp-mode', larpMode);

    if (larpMode) {
        activateLarpData();
    } else {
        refreshCurrentView();
    }
}
function setupKeyboardNav() {
  document.addEventListener('keydown', e => {
    // Cmd/Ctrl + K for quick nav
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      elements.sidebar.focus();
    }
    // Cmd/Ctrl + , for theme toggle
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault();
      toggleTheme();
    }
    // Cmd/Ctrl + R for refresh
    if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
      e.preventDefault();
      refreshData();
    }
    // Cmd/Ctrl + F for fullscreen
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault();
      toggleFullscreen();
    }
    // Cmd/Ctrl + L for LARP mode
    if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
      e.preventDefault();
      toggleLarpMode();
    }
    // Number keys for view shortcuts (Cmd+1-9 for first 9, Cmd+0 for 10th)
    if (e.metaKey && !isNaN(e.key) && ((e.key >= '1' && e.key <= '9') || e.key === '0')) {
      const idx = e.key === '0' ? 9 : parseInt(e.key) - 1;
      if (idx < VIEWS.length) {
        navigateTo(VIEWS[idx]);
      }
    }
  });
}

// ─── Fullscreen ───
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    elements.fullscreenBtn.textContent = '⧉';
  } else {
    document.exitFullscreen();
    elements.fullscreenBtn.textContent = '⛶';
  }
}

// ─── LARP Mode Activation ───
function activateLarpData() {
    // Override API fetch to return inflated numbers
    const originalFetch = api.fetch;
    api.fetch = async function(endpoint, options) {
        const real = await originalFetch.call(this, endpoint, options);
        if (!real) return null;

        // Inject LARP data based on endpoint
        if (endpoint === '/api/command-center') {
            // Inject massive token numbers
            return {
                ...real,
                stats: {
                    ...real.stats,
                    sessions: LARP_PRESETS.sessions.count,
                    active_sessions: LARP_PRESETS.sessions.active,
                    tokens: 34_300_000_000_000, // 343 trillion tokens
                    cost: 34300000.00,
                },
                token_breakdown: {
                    input: 120_000_000_000,
                    output: 200_000_000_000,
                    cache_read: 150_000_000_000,
                    cache_creation: 73_000_000_000,
                    total: 543_000_000_000, // 543 billion
                },
                models: [
                    { model: "poolside/laguna-s-2.1:free", input_tok: 50000000000, output_tok: 80000000000, cache_tok: 30000000000, cache_creation_tok: 10000000000, est_cost: 50000, act_cost: 45000, sess_count: 2048, billing_provider: "nous" },
                    { model: "claude-3-opus", input_tok: 30000000000, output_tok: 60000000000, cache_tok: 20000000000, cache_creation_tok: 5000000000, est_cost: 40000, act_cost: 35000, sess_count: 1536, billing_provider: "anthropic" },
                    { model: "gpt-4o-mini", input_tok: 40000000000, output_tok: 70000000000, cache_tok: 15000000000, cache_creation_tok: 8000000000, est_cost: 30000, act_cost: 25000, sess_count: 1920, billing_provider: "openai" },
                ],
            };
        }

        if (endpoint === '/api/goals') {
            return {
                ...real,
                goals: {
                    ...real.goals,
                    target_aed: 50000,
                    current_aed: LARP_PRESETS.revenue.total,
                },
                progress: LARP_PRESETS.revenue.total,
            };
        }

        if (endpoint === '/api/ecosystem') {
            return {
                ...real,
                stats: {
                    ...real.stats,
                    total_agents: LARP_PRESETS.agents.total,
                    active_agents: LARP_PRESETS.agents.active,
                    queued: LARP_PRESETS.agents.queued,
                    throughput: LARP_PRESETS.agents.throughput,
                },
            };
        }

        if (endpoint === '/api/storefront') {
            return {
                ...real,
                stats: {
                    ...real.stats,
                    revenue: LARP_PRESETS.revenue.total * 1000,
                    packs_sold: 42000,
                    total_sales: 42000,
                },
            };
        }

        return real;
    };
}
async function refreshData() {
  if (!elements.refreshBtn) return;
  elements.refreshBtn.textContent = '○';
  try {
    const viewModule = await import(`./views/${state.currentView}.js`);
    if (viewModule && typeof viewModule.refresh === 'function') {
      await viewModule.refresh(api);
    }
  } catch (err) {
    console.warn('[Zeg] Refresh failed:', err.message);
  }
  setTimeout(() => { if (elements.refreshBtn) elements.refreshBtn.textContent = '↻'; }, 500);
}

async function refreshCurrentView() {
  await refreshData();
}

// ─── Event Listeners ───
elements.themeToggle.addEventListener('click', toggleTheme);
elements.fullscreenBtn.addEventListener('click', toggleFullscreen);
elements.refreshBtn.addEventListener('click', refreshData);
elements.larpBtn = document.getElementById('larp-btn');
if (elements.larpBtn) elements.larpBtn.addEventListener('click', toggleLarpMode);

// Theme selector clicks
document.querySelectorAll('.theme-option').forEach(opt => {
  opt.addEventListener('click', () => setTheme(opt.dataset.theme));
});

// Navigation clicks
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    navigateTo(item.dataset.view);
    // Close sidebar on mobile after navigation
    if (window.innerWidth <= 768) {
      document.getElementById('sidebar').classList.remove('open');
      document.querySelector('.sidebar-overlay').classList.remove('open');
    }
  });
});

// Sidebar collapse toggle (desktop)
const sidebarToggleBtn = document.getElementById('sidebar-toggle');
const sidebarCollapseBtn = document.getElementById('sidebar-collapse');
let sidebarCollapsed = localStorage.getItem('zeg-sidebar-collapsed') === 'true';

function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  sidebar.classList.toggle('collapsed', sidebarCollapsed);
  localStorage.setItem('zeg-sidebar-collapsed', sidebarCollapsed);
  // Update button text
  if (sidebarToggleBtn) {
    sidebarToggleBtn.textContent = sidebarCollapsed ? '›' : '‹';
  }
}

if (sidebarToggleBtn) {
  sidebarToggleBtn.addEventListener('click', toggleSidebar);
}

if (sidebarCollapseBtn) {
  sidebarCollapseBtn.addEventListener('click', toggleSidebar);
}

// Keyboard shortcut for sidebar toggle (Cmd/Ctrl + ])
function setupSidebarToggleKey() {
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === ']') {
      e.preventDefault();
      toggleSidebar();
    }
  });
}

// Apply collapsed state on load
if (sidebarCollapsed) {
  sidebar.classList.add('collapsed');
}

setupSidebarToggleKey();
const sidebar = document.getElementById('sidebar');
let overlay = document.querySelector('.sidebar-overlay');
if (!overlay) {
  // Create overlay if it doesn't exist (SSR-safe)
  overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  document.body.appendChild(overlay);
}

if (mobileMenuBtn) {
  mobileMenuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  });
}

if (overlay) {
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  });
}

// Close sidebar on ESC key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  }
});

// Handle responsive sidebar — show hamburger on mobile
function handleResize() {
  if (window.innerWidth > 768) {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  }
}
window.addEventListener('resize', handleResize);

// ─── Auto Refresh ───
function startRefreshTimer() {
  if (state.refreshTimer) clearInterval(state.refreshTimer);
  if (state.countdownTimer) clearInterval(state.countdownTimer);

  state.refreshRemaining = REFRESH_INTERVAL / 1000;
  updateRefreshDisplay();

  state.refreshTimer = setInterval(() => {
    refreshData();
    state.refreshRemaining = REFRESH_INTERVAL / 1000;
    updateRefreshDisplay();
  }, REFRESH_INTERVAL);

  // Countdown timer
  state.countdownTimer = setInterval(() => {
    state.refreshRemaining--;
    if (state.refreshRemaining <= 0) {
      state.refreshRemaining = REFRESH_INTERVAL / 1000;
    }
    updateRefreshDisplay();
  }, 1000);
}

function updateRefreshDisplay() {
  if (elements.statusRefresh) {
    elements.statusRefresh.textContent = `○ Auto-refresh: ${state.refreshRemaining}s`;
  }
}

// ─── Init ───
function init() {
  setTheme(state.theme);
  updateClock();
  setInterval(updateClock, 1000);
  setupKeyboardNav();
  startRefreshTimer();
  // Initial health check + periodic health pings
  checkApiHealth();
  setInterval(checkApiHealth, 15000);

  // Show welcome message
  elements.statusText.textContent = 'Ready';

  // Navigate to command center by default
  renderView('command-center');

  // Quick key hints
  console.log(`
    ○ THE ZEG v1.0
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Cmd+K  · Focus sidebar
    Cmd+,  · Toggle theme
    Cmd+R  · Refresh view
    Cmd+F  · Fullscreen
    Cmd+L  · LARP mode
    Cmd+]  · Collapse sidebar
    1-9    · Quick view switch
  `);
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ─── Modal System ───
window.openZegModal = function(title, bodyHTML) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">${title}</div>
        <button class="modal-close" onclick="closeZegModal()">×</button>
      </div>
      <div class="modal-body">${bodyHTML}</div>
    </div>
  `;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeZegModal();
  });
  document.body.appendChild(overlay);
  return overlay;
};

window.closeZegModal = function() {
  const overlay = document.querySelector('.modal-overlay');
  if (overlay) overlay.remove();
};

// ─── PWA Service Worker Registration ───
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// ─── Toast Notifications ───
window.showZegToast = function(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, duration);
};

// ═══ Live Event Stream (PAI/Webhook Awareness) ═══
// Uses Server-Sent Events (SSE) for real-time streaming from Hermes
// Falls back to polling if SSE not available
let lastEventId = 0;
let sse = null;

function initLiveEvents() {
    // Try SSE first for real-time streaming
    if (typeof EventSource !== 'undefined' && API_BASE) {
        sse = new EventSource(API_BASE + '/api/events/stream');

        sse.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'connected') {
                    console.log('[Zeg] SSE connected,', data.count, 'events in queue');
                    return;
                }
                if (data.type === 'ping') return; // heartbeat

                handleLiveEvent(data);
            } catch (e) {
                console.warn('[Zeg] SSE parse error:', e);
            }
        };

        sse.onerror = function(err) {
            console.warn('[Zeg] SSE error, falling back to polling:', err);
            sse.close();
            sse = null;
            // Fall back to polling
            setInterval(pollLiveEvents, 10000);
        };
    } else {
        // No SSE support — poll every 5s
        setInterval(pollLiveEvents, 5000);
        setTimeout(pollLiveEvents, 1000);
    }
}

function handleLiveEvent(ev) {
    if (ev.id && ev.id <= lastEventId) return;
    if (ev.id) lastEventId = ev.id;

    // Dispatch event for views to react
    window.dispatchEvent(new CustomEvent('zeg-event', {
        detail: { type: ev.type, data: ev.data, ts: ev.ts }
    }));

    // Show toast notification for important events
    const messages = {
        'session_started': 'New Hermes agent session started',
        'session_ended': 'Agent session completed',
        'task_updated': 'Task status changed — check Tasks view',
        'pipeline_bump': 'Circle pipeline cadence bump logged',
        'blockchain_new_block': 'Blockchain: new block mined',
    };
    const msg = messages[ev.type] || `Event: ${ev.type}`;
    const type = ev.type === 'session_ended' || ev.type === 'task_updated' ? 'warning' : 'info';
    if (typeof window.showZegToast === 'function') {
        window.showZegToast(msg, type);
    }

    // Update status bar with live event
    const statusApi = document.getElementById('status-api');
    if (statusApi && ev.type) {
        statusApi.innerHTML = '<span class="status-dot green"></span> LIVE: ' + ev.type;
        setTimeout(() => {
            if (statusApi) statusApi.innerHTML = '<span class="status-dot green"></span> API: Healthy';
        }, 3000);
    }
}

async function pollLiveEvents() {
    const events = await api.fetch('/api/events');
    if (!events || !Array.isArray(events)) return;
    for (const ev of events) {
        handleLiveEvent(ev);
    }
}

// Start real-time event streaming (SSE with polling fallback)
initLiveEvents();

// ═══ Sparkline Helper (mini charts for stat cards) ═══
window.sparkline = function(canvas, data, color = 'var(--accent)') {
  if (!canvas || !data || data.length < 2) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  ctx.clearRect(0, 0, w, h);
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.fillStyle = 'rgba(0, 180, 255, 0.05)';
  const pts = [];
  for (let i = 0; i < data.length; i++) {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((data[i] - min) / range) * h;
    pts.push([x, y]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // Fill area under line
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
};

// ─── PWA Install Prompt ───
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const installBtn = document.getElementById('pwainstall');
  if (installBtn) installBtn.style.display = 'block';
});

window.installPWA = function() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choice) => {
      const installBtn = document.getElementById('pwainstall');
      if (installBtn) installBtn.style.display = 'none';
      if (choice.outcome === 'accepted') {
        if (typeof window.showZegToast === 'function') window.showZegToast('PWA installed!', 'success');
      }
      deferredPrompt = null;
    });
  }
};

// ═══ ULTRON Chat Dock (from Aurora BusinessBrain) ═══
(function() {
  const dock = document.getElementById('chat-dock');
  const head = document.getElementById('chat-head');
  const body = document.getElementById('chat-body');
  const msgs = document.getElementById('chat-msgs');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  const arrow = document.getElementById('chat-arrow');

  if (!dock || !head || !body || !form || !input) return;

  let isOpen = false;

  head.addEventListener('click', () => {
    isOpen = !isOpen;
    body.hidden = !isOpen;
    arrow.textContent = isOpen ? '▴' : '▸';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    // Add user message
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-msg user';
    userMsg.textContent = text;
    msgs.appendChild(userMsg);
    input.value = '';
    msgs.scrollTop = msgs.scrollHeight;

    // Send to API (use soul engine endpoint for AI response)
    try {
      const resp = await api.fetch('/api/soul/' + encodeURIComponent(text));
      const botMsg = document.createElement('div');
      botMsg.className = 'chat-msg bot';
      botMsg.textContent = (resp && resp.response) || '[ULTRON] Processing...';
      msgs.appendChild(botMsg);
      msgs.scrollTop = msgs.scrollHeight;
    } catch {
      const botMsg = document.createElement('div');
      botMsg.className = 'chat-msg bot';
      botMsg.textContent = '[ULTRON] API unavailable';
      msgs.appendChild(botMsg);
    }
  });

  // Show welcome message on first open
  let shown = false;
  head.addEventListener('click', () => {
    if (!isOpen || shown) return;
    shown = true;
    const botMsg = document.createElement('div');
    botMsg.className = 'chat-msg bot';
    botMsg.textContent = 'Hello — I am ULTRON. I see all Hermes activity across 20 souls, 645 agents, and 13 pipeline leads. How can I help?';
    msgs.appendChild(botMsg);
    msgs.scrollTop = msgs.scrollHeight;
  });
})();

// ═══ Agent Detail Modal (HCI fork: expandable run history) ═══
window.showAgentDetail = function(sessionId) {
  if (!sessionId) { window.showZegToast('No session ID', 'error'); return; }
  fetch(`http://localhost:8700/api/agent-detail?id=${encodeURIComponent(sessionId)}`, {
    headers: { 'Content-Type': 'application/json' }
  })
  .then(r => r.ok ? r.json() : null)
  .then(detail => {
    if (!detail || detail.error) {
      window.showZegToast('Agent detail unavailable', 'error');
      return;
    }
    const html = `
      <div style="font-family:var(--mono);font-size:12px">
        <div style="margin-bottom:8px"><b>ID:</b> ${detail.id || '—'} | <b>Session:</b> ${detail.session_key || '—'}</div>
        <div style="margin-bottom:8px"><b>Model:</b> ${detail.model || '—'} | <b>Display:</b> ${detail.display_name || '—'}</div>
        <div style="margin-bottom:8px"><b>Input:</b> ${detail.input_tokens || 0} | <b>Output:</b> ${detail.output_tokens || 0} | <b>Cache Read:</b> ${detail.cache_read_tokens || 0}</div>
        <div style="margin-bottom:8px"><b>Cache Write:</b> ${detail.cache_write_tokens || 0} | <b>Reasoning:</b> ${detail.reasoning_tokens || 0}</div>
        <div style="margin-bottom:8px"><b>Messages:</b> ${detail.message_count || 0} | <b>Cost:</b> $${detail.actual_cost_usd || 0}</div>
        <div style="margin-bottom:8px"><b>Started:</b> ${detail.started_at || '—'} | <b>Ended:</b> ${detail.ended_at || 'active'}</div>
        <div style="margin-bottom:8px"><b>End reason:</b> ${detail.end_reason || '—'}</div>
        <div style="color:var(--muted);font-size:11px">From hermes state.db sessions table</div>
      </div>
    `;
    window.showZegModal('Agent Detail — ' + (detail.model || 'Unknown'), html);
  })
  .catch(() => { window.showZegToast('Failed to load agent detail', 'error'); });
};

// ═══ Password Gate (HCI fork: auth behind password) ═══
(function() {
  const gate = document.getElementById('pwa-install-prompt');
  if (!gate && !localStorage.getItem('zeg-authed')) {
    // Simple password gate overlay
    const overlay = document.createElement('div');
    overlay.id = 'zeg-auth';
    overlay.style.cssText = `
      position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.9);
      display:flex;align-items:center;justify-content:center;z-index:10000;
    `;
    overlay.innerHTML = `
      <div style="text-align:center;color:#fff;max-width:320px">
        <div style="font-family:var(--mono);font-size:14px;margin-bottom:20px">
          ⚡ THE ZEG — Authentication Required ⚡<br><br>
          Enter access code:
        </div>
        <input id="auth-input" type="password" style="
          background:#111;border:1px solid #00b4f4;color:#00b4f4;font-family:var(--mono);
          padding:8px 12px;font-size:14px;width:200px;margin-bottom:12px
        " placeholder="••••••••" autocomplete="off">
        <br>
        <button id="auth-submit" style="
          background:#00b4f4;color:#000;border:none;padding:8px 16px;
          font-family:var(--mono);font-size:12px;cursor:pointer;border-radius:4px
        ">ACCESS</button>
        <div style="margin-top:12px;font-size:10px;color:#666">
          (No password needed — for demo purposes, any input works)<br>
          Press Enter or click ACCESS
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    
    const input = overlay.querySelector('#auth-input');
    const submit = overlay.querySelector('#auth-submit');
    
    const grant = () => {
      localStorage.setItem('zeg-authed', '1');
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 300);
      if (typeof window.showZegToast === 'function') window.showZegToast('Access granted', 'success');
    };
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') grant();
    });
    submit.addEventListener('click', grant);
    
    // Auto-focus input
    setTimeout(() => input.focus(), 100);
  }
})();
