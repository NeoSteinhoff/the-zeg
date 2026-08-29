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
};

// ─── DOM Elements ───
const elements = {
  themeToggle: document.getElementById('theme-toggle'),
  fullscreenBtn: document.getElementById('fullscreen-btn'),
  refreshBtn: document.getElementById('refresh-btn'),
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
  'tasks', 'cron-monitor', 'ventures', 'treasury', 'war-room'
];

function navigateTo(viewName) {
  if (!VIEWS.includes(viewName)) return;
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
      module.init(elements.mainContent, api);
      elements.statusText.textContent = `${viewName} ready`;
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
};

// ─── Global ZEG object (for views that need API access outside init) ───
window.ZEG = { api, state, elements };

// ─── Status Updates ───
function updateApiStatus(connected) {
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
            : 'Welcome to THE ZEG';
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
    // Number keys for view shortcuts
    if (e.metaKey && !isNaN(e.key) && e.key >= '1' && e.key <= '9') {
      const idx = parseInt(e.key) - 1;
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
  elements.refreshBtn.textContent = '○';
  const viewModule = await import(`./views/${state.currentView}.js`);
  if (viewModule.refresh) {
    await viewModule.refresh(api);
  }
  setTimeout(() => { elements.refreshBtn.textContent = '↻'; }, 500);
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

// Mobile sidebar toggle
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
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
  let remaining = REFRESH_INTERVAL / 1000;
  elements.statusRefresh.textContent = `○ Auto-refresh: ${remaining}s`;
  state.refreshTimer = setInterval(() => {
    refreshData();
    remaining = REFRESH_INTERVAL / 1000;
    elements.statusRefresh.textContent = `○ Auto-refresh: ${remaining}s`;
  }, REFRESH_INTERVAL);

  // Countdown timer
  const countdownTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) remaining = REFRESH_INTERVAL / 1000;
    if (elements.statusRefresh) {
      elements.statusRefresh.textContent = `○ Auto-refresh: ${remaining}s`;
    }
  }, 1000);
  state.countdownTimer = countdownTimer;
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
  elements.statusText.textContent = 'Welcome to THE ZEG';

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
