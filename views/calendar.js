/**
 * Calendar System — Aceternity sidebar-12 pattern
 * Calendar with events, scheduling, and cron integration
 */
import { escapeHtml, fmtNum, showLoading, showError, el } from '../utils.js';
import { ZEG } from '../components.js';

// Demo events from crons + dating pipeline + goals
const DEMO_EVENTS = [
  {
    id: 'e1',
    date: '2026-08-30',
    time: '14:30',
    title: 'WhatsApp Voice Notes — Batch 14',
    description: 'Send to 3 Dubai real estate agents in pipeline',
    type: 'action',
    color: 'var(--accent)',
    completed: false,
  },
  {
    id: 'e2',
    date: '2026-08-30',
    time: '15:00',
    title: 'Cron: lead-research',
    description: 'Auto-resume after rate limit timeout',
    type: 'cron',
    color: 'var(--warm)',
    completed: false,
  },
  {
    id: 'e3',
    date: '2026-08-30',
    time: '09:15',
    title: 'Due: Sarah (Heat: 92)',
    description: 'Schedule follow-up — pipeline active',
    type: 'dating',
    color: 'var(--purple)',
    completed: false,
  },
  {
    id: 'e4',
    date: '2026-08-30',
    time: '08:00',
    title: 'Review YOOF metrics',
    description: 'Extreme action bias check',
    type: 'review',
    color: 'var(--good)',
    completed: true,
  },
  {
    id: 'e5',
    date: '2026-08-29',
    time: '18:00',
    title: 'Vercel deploy verification',
    description: 'Confirmed all endpoints live',
    type: 'done',
    color: 'var(--good)',
    completed: true,
  },
];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function generateCalendar(year, month) {
  const days = [];
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = getDaysInMonth(year, month);

  // Empty cells for days in previous month
  for (let i = 0; i < firstDay; i++) {
    days.push({ day: '', currentMonth: false });
  }

  // Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({
      day: d,
      currentMonth: true,
      date: new Date(year, month, d).toISOString().split('T')[0],
      events: DEMO_EVENTS.filter(e => e.date === new Date(year, month, d).toISOString().split('T')[0]),
    });
  }

  // Fill to complete the grid (6 rows of 7 = 42)
  while (days.length < 42) {
    days.push({ day: '', currentMonth: false });
  }

  return days;
}

export async function init(container) {
  showLoading(container, 'Loading Calendar...');
  container.innerHTML = '';

  const now = new Date();
  let currentMonth = now.getMonth();
  let currentYear = now.getFullYear();

  const app = el('div', { class: 'calendar-app' }, [
    // Left: Month selector + events list
    el('div', { class: 'calendar-sidebar' }, [
      el('div', { class: 'calendar-header' }, [
        el('button', { class: 'btn btn-ghost btn-sm', id: 'cal-prev', html: '←' }),
        el('h2', { id: 'cal-month-year', class: 'cal-month-year', html: `${MONTH_NAMES[currentMonth]} ${currentYear}` }),
        el('button', { class: 'btn btn-ghost btn-sm', id: 'cal-next', html: '→' }),
      ]),
      el('button', { id: 'cal-today', class: 'btn btn-ghost btn-sm cal-today-btn', html: 'Today' }),
      el('div', { class: 'calendar-events-list' }, [
        el('h3', { html: 'Upcoming Events' }),
        el('div', { id: 'cal-events', class: 'cal-events' }),
      ]),
    ]),

    // Right: Calendar grid
    el('div', { class: 'calendar-grid-container' }, [
      el('div', { class: 'calendar-grid' }, [
        // Day names
        ...DAY_NAMES.map(d => el('div', { class: 'cal-day-name', html: d })),
        // Calendar days
        { days: generateCalendar(currentYear, currentMonth), render: (days) => days.map(d => {
          const cell = el('div', {
            class: `cal-day ${d.currentMonth ? 'current' : 'other'} ${d.events && d.events.length ? 'has-events' : ''}`,
          });
          if (d.day) {
            cell.appendChild(el('span', { class: 'cal-day-num', html: d.day }));
            if (d.events && d.events.length) {
              d.events.forEach(e => {
                const eventDot = el('div', {
                  class: 'cal-event-dot',
                  style: { background: e.color, borderRadius: '2px', height: '4px', marginTop: '2px' },
                  title: `${e.time} ${e.title}`,
                });
                cell.appendChild(eventDot);
              });
            }
          }
          return cell;
        })},
      ]),
    ]),
  ]);

  // Event handlers for month navigation
  const prevBtn = container.querySelector('#cal-prev');
  const nextBtn = container.querySelector('#cal-next');
  const monthYearEl = container.querySelector('#cal-month-year');

  function updateCalendar() {
    const days = generateCalendar(currentYear, currentMonth);
    monthYearEl.textContent = `${MONTH_NAMES[currentMonth]} ${currentYear}`;

    const grid = container.querySelector('.calendar-grid');
    // Remove day name headers but keep them
    const dayHeaders = grid.querySelectorAll('.cal-day-name');
    // Clear day cells only
    grid.innerHTML = '';
    DAY_NAMES.forEach(d => grid.appendChild(el('div', { class: 'cal-day-name', html: d })));
    days.forEach(d => {
      const cell = el('div', {
        class: `cal-day ${d.currentMonth ? 'current' : 'other'} ${d.events && d.events.length ? 'has-events' : ''}`,
      });
      if (d.day) {
        cell.appendChild(el('span', { class: 'cal-day-num', html: d.day }));
        if (d.events && d.events.length) {
          d.events.forEach(e => {
            const eventDot = el('div', {
              class: 'cal-event-dot',
              style: { background: e.color, borderRadius: '2px', height: '4px', marginTop: '2px' },
              title: `${e.time} ${e.title}`,
            });
            cell.appendChild(eventDot);
          });
        }
      }
      grid.appendChild(cell);
    });

    // Update events list
    const today = new Date().toISOString().split('T')[0];
    const upcoming = DEMO_EVENTS.filter(e => e.date >= today).sort((a, b) => {
      if (a.date !== b.date) return a.date > b.date ? 1 : -1;
      return a.time > b.time ? 1 : -1;
    });

    const eventsList = container.querySelector('#cal-events');
    eventsList.innerHTML = '';
    upcoming.forEach(e => {
      const card = ZEG.CometCard({
        className: 'cal-event-card',
        children: el('div', { class: 'cal-event-content' }, [
          el('div', { class: 'cal-event-time', html: `${e.time} • ${e.date}` }),
          el('div', { class: 'cal-event-title', html: escapeHtml(e.title) }),
          el('div', { class: 'cal-event-desc', html: escapeHtml(e.description) }),
          el('span', { class: 'cal-event-badge', style: { background: e.color }, html: e.type }),
        ]),
      });
      eventsList.appendChild(card);
    });
  }

  if (prevBtn) prevBtn.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    updateCalendar();
  });

  if (nextBtn) nextBtn.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    updateCalendar();
  });

  const todayBtn = container.querySelector('#cal-today');
  if (todayBtn) todayBtn.addEventListener('click', () => {
    currentMonth = now.getMonth();
    currentYear = now.getFullYear();
    updateCalendar();
  });

  updateCalendar();

  container.appendChild(app);

  return {
    refresh: async () => {
      // Fetch cron jobs + dating pipeline dates
      try {
        const [crons, pipeline] = await Promise.all([
          fetch('http://localhost:8700/api/crons').then(r => r.json()),
          fetch('http://localhost:8700/api/pipeline-status').then(r => r.json()),
        ]);
        return { crons: crons.crons?.length, pipeline: pipeline };
      } catch {
        return { ok: false };
      }
    }
  };
}
