/* ════════════════════════════════════════════════════════════
   THE ZEG — Health View
   Health & fitness tracking: workouts, sleep, vitals, habits
   ════════════════════════════════════════════════════════════ */

import { fmtNum, fmtDuration, showLoading } from '../utils.js';

export function init(container, api) {
  showLoading('Loading health…', container);
  render(container, api);
}

export async function refresh(_api) {
  const container = document.querySelector('.main-content');
  if (container) render(container, _api || window.ZEG?.api);
}

function render(container, api) {
  container.innerHTML = `
    <div id="health">
      <div class="stat-grid" id="health-stats"></div>

      <div class="card">
        <div class="card-header">Vital Signs</div>
        <div class="stat-grid" id="vitals-grid"></div>
      </div>

      <div class="card">
        <div class="card-header">Workout History (Last 30 Days)</div>
        <table id="workouts-table">
          <thead>
            <tr><th>Date</th><th>Type</th><th>Duration</th><th>Calories</th><th>RPE</th><th>Notes</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-header">Sleep Tracking (Last 14 Days)</div>
        <table id="sleep-table">
          <thead>
            <tr><th>Date</th><th>Duration</th><th>Quality</th><th>Deep Sleep</th><th>REM</th><th>HRV</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-header">Body Measurements</div>
        <table id="measurements-table">
          <thead>
            <tr><th>Date</th><th>Weight (kg)</th><th>Body Fat %</th><th>Muscle Mass</th><th>Waist (cm)</th><th>Notes</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-header">Weekly Activity Targets</div>
        <div id="activity-targets"></div>
      </div>

      <div class="card">
        <div class="card-header">Supplements & Medications</div>
        <table id="supplements-table">
          <thead>
            <tr><th>Name</th><th>Dosage</th><th>Frequency</th><th>Time</th><th>Purpose</th><th>Status</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  `;
  loadData(api);
}

async function loadData(api) {
  const data = await api.fetch('/api/health');
  if (!data) {
    showFallback();
    return;
  }

  const stats = data.stats || {};
  const vitals = data.vitals || {};
  const workouts = data.workouts || [];
  const sleep = data.sleep || [];
  const measurements = data.measurements || [];
  const targets = data.targets || {};
  const supplements = data.supplements || [];

  // Stats cards
  document.getElementById('health-stats').innerHTML = `
    <div class="stat blue"><div class="num">${stats.workouts_this_week || 0}</div><div class="lbl">Workouts This Week</div></div>
    <div class="stat green"><div class="num">${fmtDuration(stats.total_active_minutes || 0)}</div><div class="lbl">Active Minutes</div></div>
    <div class="stat orange"><div class="num">${stats.avg_sleep_hours || 0}h</div><div class="lbl">Avg Sleep</div></div>
    <div class="stat purple"><div class="num">${stats.current_streak || 0}</div><div class="lbl">Day Streak</div></div>
    <div class="stat red"><div class="num">${stats.resting_hr || '—'}</div><div class="lbl">Resting HR</div></div>
    <div class="stat yellow"><div class="num">${stats.hrv || '—'}ms</div><div class="lbl">HRV</div></div>
  `;

  // Vitals grid
  const vitalsGrid = document.getElementById('vitals-grid');
  if (vitalsGrid) {
    const v = vitals;
    vitalsGrid.innerHTML = `
      <div class="stat"><div class="num">${v.resting_hr || '—'}</div><div class="lbl">Resting HR (bpm)</div></div>
      <div class="stat"><div class="num">${v.hrv || '—'}</div><div class="lbl">HRV (ms)</div></div>
      <div class="stat"><div class="num">${v.bp_systolic || '—'}/${v.bp_diastolic || '—'}</div><div class="lbl">Blood Pressure</div></div>
      <div class="stat"><div class="num">${v.spo2 || '—'}%</div><div class="lbl">SpO₂</div></div>
      <div class="stat"><div class="num">${v.body_temp || '—'}°C</div><div class="lbl">Body Temp</div></div>
      <div class="stat"><div class="num">${v.respiratory_rate || '—'}</div><div class="lbl">Resp. Rate</div></div>
      <div class="stat"><div class="num">${v.vo2max || '—'}</div><div class="lbl">VO₂ Max</div></div>
      <div class="stat"><div class="num">${v.stress_score || '—'}</div><div class="lbl">Stress Score</div></div>
    `;
  }

  // Workouts table
  const woBody = document.querySelector('#workouts-table tbody');
  if (woBody) {
    woBody.innerHTML = workouts.slice(0, 20).map(w => `
      <tr>
        <td><span style="font-family:var(--mono);font-size:11px">${w.date ? new Date(w.date).toLocaleDateString() : '—'}</span></td>
        <td><span class="badge ${workoutTypeBadge(w.type)}">${w.type || '—'}</span></td>
        <td><span style="font-family:var(--mono)">${fmtDuration(w.duration_min * 60000)}</span></td>
        <td>${w.calories || '—'}</td>
        <td><span class="badge ${rpeBadge(w.rpe)}">${w.rpe || '—'}</span></td>
        <td style="font-size:11px;color:var(--muted)">${w.notes || '—'}</td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="empty">No workouts logged</td></tr>';
  }

  // Sleep table
  const slBody = document.querySelector('#sleep-table tbody');
  if (slBody) {
    slBody.innerHTML = sleep.slice(0, 14).map(s => `
      <tr>
        <td><span style="font-family:var(--mono);font-size:11px">${s.date ? new Date(s.date).toLocaleDateString() : '—'}</span></td>
        <td><span style="font-family:var(--mono)">${fmtDuration((s.duration_hours || 0) * 3600000)}</span></td>
        <td><span class="badge ${qualityBadge(s.quality)}">${s.quality || '—'}</span></td>
        <td>${s.deep_hours || '—'}h</td>
        <td>${s.rem_hours || '—'}h</td>
        <td>${s.hrv || '—'}</td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="empty">No sleep data</td></tr>';
  }

  // Measurements table
  const msBody = document.querySelector('#measurements-table tbody');
  if (msBody) {
    msBody.innerHTML = measurements.slice(0, 20).map(m => `
      <tr>
        <td><span style="font-family:var(--mono);font-size:11px">${m.date ? new Date(m.date).toLocaleDateString() : '—'}</span></td>
        <td style="font-family:var(--mono)">${m.weight || '—'}</td>
        <td style="font-family:var(--mono)">${m.body_fat || '—'}%</td>
        <td style="font-family:var(--mono)">${m.muscle_mass || '—'}kg</td>
        <td style="font-family:var(--mono)">${m.waist || '—'}</td>
        <td style="font-size:11px;color:var(--muted)">${m.notes || '—'}</td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="empty">No measurements</td></tr>';
  }

  // Activity targets
  const targetBox = document.getElementById('activity-targets');
  if (targetBox) {
    const t = targets;
    targetBox.innerHTML = `
      <div class="health-row">
        <span class="health-label">Workouts / Week</span>
        <div class="health-bar"><div class="health-fill" style="width:${Math.min(100, (t.workouts_done || 0) / (t.workouts_target || 1) * 100)}%;background:var(--good)"></div></div>
        <span class="health-num">${t.workouts_done || 0} / ${t.workouts_target || 0}</span>
      </div>
      <div class="health-row">
        <span class="health-label">Active Minutes / Week</span>
        <div class="health-bar"><div class="health-fill" style="width:${Math.min(100, (t.active_minutes_done || 0) / (t.active_minutes_target || 1) * 100)}%;background:var(--blue)"></div></div>
        <span class="health-num">${fmtDuration((t.active_minutes_done || 0) * 60000)} / ${fmtDuration((t.active_minutes_target || 150) * 60000)}</span>
      </div>
      <div class="health-row">
        <span class="health-label">Steps / Day (Avg)</span>
        <div class="health-bar"><div class="health-fill" style="width:${Math.min(100, (t.avg_steps || 0) / (t.steps_target || 1) * 100)}%;background:var(--purple)"></div></div>
        <span class="health-num">${fmtNum(t.avg_steps || 0)} / ${fmtNum(t.steps_target || 10000)}</span>
      </div>
      <div class="health-row">
        <span class="health-label">Sleep Hours / Night</span>
        <div class="health-bar"><div class="health-fill" style="width:${Math.min(100, (t.avg_sleep || 0) / (t.sleep_target || 1) * 100)}%;background:var(--warm)"></div></div>
        <span class="health-num">${t.avg_sleep || 0}h / ${t.sleep_target || 8}h</span>
      </div>
    `;
  }

  // Supplements table
  const supBody = document.querySelector('#supplements-table tbody');
  if (supBody) {
    supBody.innerHTML = supplements.map(s => `
      <tr>
        <td>${s.name || '—'}</td>
        <td>${s.dosage || '—'}</td>
        <td>${s.frequency || '—'}</td>
        <td>${s.time || '—'}</td>
        <td style="font-size:11px;color:var(--muted)">${s.purpose || '—'}</td>
        <td><span class="badge ${s.active ? 'badge-ok' : 'badge-blocked'}">${s.active ? 'Active' : 'Paused'}</span></td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="empty">No supplements</td></tr>';
  }
}

function workoutTypeBadge(type) {
  const map = { strength: 'badge-running', cardio: 'badge-ok', hiit: 'badge-hot', yoga: 'badge-agent', mobility: 'badge-pending', sports: 'badge-warn', other: 'badge-idle' };
  return map[(type || '').toLowerCase()] || 'badge-pending';
}

function rpeBadge(rpe) {
  if (!rpe) return 'badge-pending';
  if (rpe >= 9) return 'badge-hot';
  if (rpe >= 7) return 'badge-running';
  if (rpe >= 5) return 'badge-warn';
  return 'badge-ok';
}

function qualityBadge(q) {
  const map = { excellent: 'badge-ok', good: 'badge-agent', fair: 'badge-warn', poor: 'badge-failed' };
  return map[(q || '').toLowerCase()] || 'badge-pending';
}

function showFallback() {
  document.getElementById('health-stats').innerHTML =
    '<div class="stat orange"><div class="num">○○○</div><div class="lbl">API Disconnected</div></div>';
}