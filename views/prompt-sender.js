/**
 * Prompt Sender — Enhanced Hermes control interface
 * Better than the normal Hermes app: features + command palette + chat history + tools
 */
import { escapeHtml, fmtNum, showLoading, showError, el } from '../utils.js';
import { ZEG } from '../components.js';

export async function init(container) {
  showLoading(container, 'Loading Hermes Prompt Sender...');
  container.innerHTML = '';

  const app = el('div', { class: 'prompt-sender-app' }, [
    // Left: Chat history
    el('div', { class: 'chat-history-sidebar' }, [
      el('div', { class: 'chat-history-header' }, [
        el('h2', { html: '🔮 Hermes Sessions' }),
        el('button', { class: 'btn btn-primary btn-sm', html: '+ New Session' }),
      ]),
      el('div', { class: 'chat-sessions-list' }, [
        // Demo sessions
        ...[
          { id: 's1', title: 'Dashboard overhaul', msgs: 12, last: '2m ago', active: true },
          { id: 's2', title: 'Circle pipeline fix', msgs: 8, last: '15m ago', active: false },
          { id: 's3', title: 'Security audit', msgs: 24, last: '1h ago', active: false },
        ].map(s => el('div', {
          class: `chat-session-item ${s.active ? 'active' : ''}`,
          html: `<div class="session-title">${escapeHtml(s.title)}</div><div class="session-meta"><span class="session-msgs">${s.msgs} msgs</span><span class="session-time">${s.last}</span></div>`
        }))
      ]),
    ]),

    // Right: Main chat interface
    el('div', { class: 'chat-main-area' }, [
      // Message display area
      el('div', { class: 'chat-messages' }, [
        // Welcome message
        el('div', { class: 'message hermes-message' }, [
          el('div', { class: 'message-header' }, [
            el('span', { class: 'message-author', html: 'Hermes' }),
            el('span', { class: 'message-time', html: 'now' }),
          ]),
          el('div', { class: 'message-content' }, [
            el('p', { html: 'Hello! I am Hermes — your AI agent for coding, research, and automation. What can I help you with today?' }),
            el('div', { class: 'message-tools' }, [
              el('span', { class: 'tool-tag', html: 'terminal' }),
              el('span', { class: 'tool-tag', html: 'file' }),
              el('span', { class: 'tool-tag', html: 'web' }),
              el('span', { class: 'tool-tag', html: 'delegation' }),
              el('span', { class: 'tool-tag', html: 'session_search' }),
              el('span', { class: 'tool-tag', html: 'memory' }),
            ]),
          ]),
        ]),
      ]),

      // Input area — Aceternity-style advanced prompt sender
      el('div', { class: 'chat-input-area' }, [
        // Command palette / quick actions
        el('div', { class: 'input-quick-actions' }, [
          el('button', { class: 'quick-action-btn', html: '⚡ LARP Mode' }),
          el('button', { class: 'quick-action-btn', html: '🔍 Deep Research' }),
          el('button', { class: 'quick-action-btn', html: '🧠 Memory Recall' }),
          el('button', { class: 'quick-action-btn', html: '📡 Webhook Listen' }),
        ]),

        // Model selector + input
        el('div', { class: 'input-row' }, [
          el('select', { class: 'model-selector', html: '' }, [
            el('option', { html: 'poolside/laguna-s-2.1:free (Default)' }),
            el('option', { html: 'claude-sonnet-4 (Premium)' }),
            el('option', { html: 'gpt-4o-mini (Alt)' }),
          ]),
          el('input', {
            type: 'text',
            class: 'prompt-input',
            placeholder: 'Ask Hermes anything... (Cmd+K to focus)',
            autocomplete: 'off',
          }),
          el('button', { class: 'send-btn btn btn-primary', html: '→' }),
        ]),

        // Advanced options
        el('div', { class: 'input-advanced-options' }, [
          el('label', { class: 'option-row' }, [
            el('input', { type: 'checkbox', class: 'opt-checkbox', checked: true }),
            el('span', { html: 'Use skills' }),
          ]),
          el('label', { class: 'option-row' }, [
            el('input', { type: 'checkbox', class: 'opt-checkbox' }),
            el('span', { html: 'Web search' }),
          ]),
          el('label', { class: 'option-row' }, [
            el('input', { type: 'checkbox', class: 'opt-checkbox' }),
            el('span', { html: 'File browsing' }),
          ]),
          el('input', { type: 'text', class: 'profile-input', placeholder: 'Profile (optional)' }),
        ]),
      ]),
    ]),
  ]);

  // Add keyboard shortcuts
  const promptInput = container.querySelector('.prompt-input');
  if (promptInput) {
    const focusInput = (e) => {
      e.preventDefault();
      promptInput.focus();
    };
    document.addEventListener('keydown', (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        focusInput(e);
      }
    });
  }

  // Send button handler
  const sendBtn = container.querySelector('.send-btn');
  if (sendBtn && promptInput) {
    sendBtn.addEventListener('click', async () => {
      const query = promptInput.value.trim();
      if (!query) return;

      const model = container.querySelector('.model-selector').value;
      const profile = container.querySelector('.profile-input').value.trim();
      const opts = Array.from(container.querySelectorAll('.opt-checkbox:checked'));
      const skills = opts.length > 0 ? 'true' : undefined;

      // Show user message
      const messages = container.querySelector('.chat-messages');
      const userMsg = el('div', { class: 'message user-message' }, [
        el('div', { class: 'message-header' }, [
          el('span', { class: 'message-author', html: 'You' }),
          el('span', { class: 'message-time', html: 'now' }),
        ]),
        el('div', { class: 'message-content' }, [
          el('p', { html: escapeHtml(query) }),
        ]),
      ]);
      messages.appendChild(userMsg);

      // Clear input
      promptInput.value = '';

      // Show loading
      const statusEl = el('div', { class: 'message hermes-message', html: `<div class="message-header"><span class="message-author">Hermes</span><span class="message-time">typing...</span></div><div class="message-content"><p>Thinking...</p></div>` });
      messages.appendChild(statusEl);

      // Call API
      try {
        const resp = await fetch('http://localhost:8700/api/hermes/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, profile: profile || undefined, model, skills }),
        });
        const data = await resp.json();

        statusEl.innerHTML = `
          <div class="message-header">
            <span class="message-author">Hermes</span>
            <span class="message-time">now</span>
          </div>
          <div class="message-content">
            <p style="white-space: pre-wrap;">${escapeHtml(data.response || 'No response')}</p>
          </div>
        `;
      } catch (e) {
        statusEl.innerHTML = `
          <div class="message-header">
            <span class="message-author">Hermes</span>
            <span class="message-time">error</span>
          </div>
          <div class="message-content">
            <p style="color: var(--hot);">Failed to connect to Hermes API.</p>
          </div>
        `;
      }

      // Scroll to bottom
      messages.scrollTop = messages.scrollHeight;
    });
  }

  return {
    refresh: async () => {
      try {
        const resp = await fetch('http://localhost:8700/api/hermes/status');
        return await resp.json();
      } catch {
        return { ok: false };
      }
    }
  };
}
