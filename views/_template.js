/* ════════════════════════════════════════════════════════════
   THE ZEG — View Template
   Use this as a starting point for new views. Copy and rename.
   ════════════════════════════════════════════════════════════ */

/**
 * @module views/<ViewName>
 * @description <One-line description of what this view does>
 * @requires utils.js
 */

import {
  $,
  $$,
  on,
  off,
  emit,
  state,
  api,
  render,
  debounce,
  throttle,
  formatDate,
  formatCurrency,
  escapeHtml,
  clamp,
  uuid,
  storage,
  showLoading,
  fmtNum,
  fmtCurrency,
  fmtPercent,
  fmtFileSize,
  fmtDuration,
  fmtRelative,
  fmtDateTime,
  renderStatus,
  emptyState,
  showError,
  renderTable,
  el,
  elAll,
} from '../utils.js';

/** @type {ViewApi | null} */
let api = null;

/** @type {HTMLElement | null} */
let rootEl = null;

/** @type {number | null} */
let refreshTimer = null;

/** @type {string} */
const VIEW_NAME = '<ViewName>';

/** @type {string} */
const VIEW_TITLE = '<Human Readable Title>';

/**
 * Initialize the view
 * @param {HTMLElement} container - Root element to render into
 * @param {ViewApi} viewApi - API client instance (ZEG.api)
 * @returns {Promise<void>}
 */
export async function init(container, viewApi) {
  api = viewApi;
  rootEl = container;
  container.innerHTML = getTemplate();
  bindEvents(container);
  await loadData();
  startAutoRefresh();
}

/**
 * Clean up resources when leaving this view
 * @returns {void}
 */
export function destroy() {
  stopAutoRefresh();
  rootEl = null;
  // Remove any window-bound handlers
  // window.myHandler = null;
}

/**
 * Refresh data and re-render
 * @returns {Promise<void>}
 */
export async function refresh() {
  await loadData();
}

/**
 * Load all data for this view
 * @returns {Promise<void>}
 */
async function loadData() {
  if (!rootEl) return;
  const loadingEl = $('[data-loading]', rootEl);
  if (loadingEl) showLoading(loadingEl, true);

  try {
    // Fetch all endpoints concurrently
    const [data1, data2, data3] = await Promise.all([
      api.fetch('/api/endpoint1').catch(() => null),
      api.fetch('/api/endpoint2').catch(() => null),
      api.fetch('/api/endpoint3').catch(() => null),
    ]);

    renderView(data1, data2, data3);
  } catch (err) {
    showError(err, '[ViewName] loadData');
    renderFallback();
  } finally {
    if (loadingEl) showLoading(loadingEl, false);
  }
}

/**
 * Render the view with loaded data
 * @param {Object} data1 - Response from /api/endpoint1
 * @param {Object} data2 - Response from /api/endpoint2
 * @param {Object} data3 - Response from /api/endpoint3
 * @returns {void}
 */
function renderView(data1, data2, data3) {
  // Render stats cards
  renderStats(data1?.stats);

  // Render main content
  renderContent(data1, data2, data3);
}

/**
 * Render stats cards
 * @param {Object} stats - Stats object from API
 * @returns {void}
 */
function renderStats(stats) {
  if (!rootEl) return;
  const statsContainer = $('[data-stats]', rootEl);
  if (!statsContainer) return;

  const statItems = [
    { label: 'Stat Label 1', value: fmtNum(stats?.stat1) },
    { label: 'Stat Label 2', value: fmtCurrency(stats?.stat2) },
    { label: 'Stat Label 3', value: fmtPercent(stats?.stat3) },
  ];

  statsContainer.innerHTML = statItems
    .map(
      (s) => `
    <div class="stat-card">
      <div class="stat-value">${escapeHtml(s.value)}</div>
      <div class="stat-label">${escapeHtml(s.label)}</div>
    </div>
  `
    )
    .join('');
}

/**
 * Render main content area
 * @param {Object} data1
 * @param {Object} data2
 * @param {Object} data3
 * @returns {void}
 */
function renderContent(data1, data2, data3) {
  // Implement view-specific rendering here
  // Use renderTable(), emptyState(), renderStatus() from utils
}

/**
 * Render fallback UI when API is unavailable
 * @returns {void}
 */
function renderFallback() {
  if (!rootEl) return;

  const statsContainer = $('[data-stats]', rootEl);
  if (statsContainer) {
    statsContainer.innerHTML = Array(5)
      .fill(
        `
    <div class="stat-card">
      <div class="stat-value">○○○</div>
      <div class="stat-label">API Disconnected</div>
    </div>
  `
      )
      .join('');
  }

  const contentContainer = $('[data-content]', rootEl);
  if (contentContainer) {
    contentContainer.innerHTML = emptyState(
      'No data available',
      'Check your connection and try refreshing.'
    );
  }
}

/**
 * Bind DOM event listeners
 * @param {HTMLElement} root - Container element
 * @returns {void}
 */
function bindEvents(root) {
  // Example: Refresh button
  on(root, 'click', '[data-action="refresh"]', () => refresh());

  // Example: Form submit
  on(root, 'submit', '[data-form]', handleFormSubmit);

  // Example: Delegated click for dynamic elements
  on(root, 'click', '[data-action="detail"]', (e) => {
    const id = e.currentTarget.dataset.id;
    viewDetail(id);
  });
}

/**
 * Handle form submission
 * @param {Event} e
 * @returns {Promise<void>}
 */
async function handleFormSubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);

  try {
    await api.post('/api/endpoint', data);
    await refresh();
  } catch (err) {
    showError(err, '[ViewName] handleFormSubmit');
  }
}

/**
 * View detail for an item
 * @param {string} id
 * @returns {Promise<void>}
 */
async function viewDetail(id) {
  try {
    const data = await api.fetch(`/api/endpoint/${id}`);
    // Open modal or navigate
  } catch (err) {
    showError(err, '[ViewName] viewDetail');
  }
}

/**
 * Start auto-refresh interval
 * @returns {void}
 */
function startAutoRefresh() {
  // Refresh every 30 seconds
  refreshTimer = window.setInterval(() => refresh(), 30000);
}

/**
 * Stop auto-refresh interval
 * @returns {void}
 */
function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

/**
 * Get the HTML template for this view
 * @returns {string}
 */
function getTemplate() {
  return `
  <div class="view view-${VIEW_NAME.toLowerCase()}">
    <header class="view-header">
      <h1>${escapeHtml(VIEW_TITLE)}</h1>
      <button class="btn btn-secondary" data-action="refresh" aria-label="Refresh">
        ⟳ Refresh
      </button>
    </header>

    <div class="view-loading" data-loading aria-live="polite"></div>

    <section class="view-stats" data-stats aria-label="Statistics"></section>

    <section class="view-content" data-content aria-label="Main content"></section>
  </div>
  `;
}

// Auto-register with the view system if available
if (typeof window !== 'undefined' && window.ZEG?.views) {
  window.ZEG.views.register(VIEW_NAME, { init, destroy, refresh });
}

export default { init, destroy, refresh };