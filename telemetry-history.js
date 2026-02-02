(function () {
  'use strict';

  const state = {
    pantry: null,
    history: [],
    weight: [],
    doors: [],
  };

  function formatDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function formatRelative(iso) {
    if (!iso) return '';
    const now = Date.now();
    const ts = new Date(iso).getTime();
    if (Number.isNaN(ts)) return '';
    const diffMs = now - ts;
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 1) return 'updated <1h ago';
    if (diffHours < 24) return `updated ${Math.round(diffHours)}h ago`;
    return `updated ${Math.round(diffHours / 24)}d ago`;
  }

  function parseHistory(items) {
    if (!Array.isArray(items)) return { weight: [], doors: [] };
    const weight = [];
    const doors = [];
    items.forEach((item) => {
      const ts = item.ts;
      // mass may be provided as `mass` (lbs) or in metrics.weightKg
      let weightKg = NaN;
      if (item.mass !== undefined && item.mass !== null) {
        const massNum = Number(item.mass);
        if (!Number.isNaN(massNum)) weightKg = massNum * 0.453592; // convert lb -> kg
      }
      const metricsWeight = Number(item.metrics?.weightKg ?? item.metrics?.weightkg ?? NaN);
      if (Number.isNaN(weightKg) && !Number.isNaN(metricsWeight)) weightKg = metricsWeight;
      if (!Number.isNaN(weightKg)) {
        weight.push({ ts, weightKg });
      }
      // door may be top-level `door` (0/1) or flags.door
      const doorRaw = (item.door !== undefined && item.door !== null) ? item.door : item.flags?.door;
      // normalize to numeric 0/1 or strings 'open'/'closed'
      let doorState = null;
      if (doorRaw === 1 || doorRaw === '1' || doorRaw === 'open' || doorRaw === 'opened') doorState = 'open';
      if (doorRaw === 0 || doorRaw === '0' || doorRaw === 'closed' || doorRaw === 'close') doorState = 'closed';
      if (doorState) {
        doors.push({ ts, status: doorState, raw: doorRaw });
      }
    });
    weight.sort((a, b) => new Date(a.ts) - new Date(b.ts));
    doors.sort((a, b) => new Date(a.ts) - new Date(b.ts));
    return { weight, doors };
  }

  // Process raw history to detect open->close cycles and compute weight changes
  function processDoorEvents(history) {
    // history: array of raw items sorted ascending by ts
    if (!Array.isArray(history) || history.length === 0) return [];
    // Build a timeline of events with door and mass information
    const timeline = history.map(item => {
      const ts = item.ts;
      let massKg = NaN;
      if (item.mass !== undefined && item.mass !== null) {
        const n = Number(item.mass);
        if (!Number.isNaN(n)) massKg = n * 0.453592;
      }
      const metricsWeight = Number(item.metrics?.weightKg ?? item.metrics?.weightkg ?? NaN);
      if (Number.isNaN(massKg) && !Number.isNaN(metricsWeight)) massKg = metricsWeight;
      const doorRaw = (item.door !== undefined && item.door !== null) ? item.door : item.flags?.door;
      let doorState = null;
      if (doorRaw === 1 || doorRaw === '1' || doorRaw === 'open' || doorRaw === 'opened') doorState = 'open';
      if (doorRaw === 0 || doorRaw === '0' || doorRaw === 'closed' || doorRaw === 'close') doorState = 'closed';
      return { ts, massKg: Number.isFinite(massKg) ? massKg : null, doorState };
    }).sort((a,b)=>new Date(a.ts)-new Date(b.ts));

    const cycles = [];
    let waitingOpen = null;
    // We'll scan timeline and look for closed -> open (start) then open -> closed (end)
    for (let i = 0; i < timeline.length; i++) {
      const ev = timeline[i];
      if (!ev.doorState) continue;
      if (ev.doorState === 'open') {
        // start an open cycle if not already started
        if (!waitingOpen) {
          waitingOpen = { openTs: ev.ts, openMass: ev.massKg };
        } else {
          // repeated open, update openMass if available
          if (ev.massKg !== null) waitingOpen.openMass = ev.massKg;
        }
      }
      if (ev.doorState === 'closed') {
        if (waitingOpen) {
          // close completes a cycle
          const cycle = {
            openTs: waitingOpen.openTs,
            openMass: waitingOpen.openMass,
            closeTs: ev.ts,
            closeMass: ev.massKg,
          };
          // if openMass was null, try to find nearest mass before open
          if (cycle.openMass === null) {
            for (let j = timeline.indexOf(ev)-1; j >=0; j--) {
              if (timeline[j].massKg !== null) { cycle.openMass = timeline[j].massKg; break; }
            }
          }
          // if closeMass null, try to find nearest mass after close
          if (cycle.closeMass === null) {
            for (let j = timeline.indexOf(ev)+1; j < timeline.length; j++) {
              if (timeline[j].massKg !== null) { cycle.closeMass = timeline[j].massKg; break; }
            }
          }
          // compute delta if we have both
          if (Number.isFinite(cycle.openMass) && Number.isFinite(cycle.closeMass)) {
            cycle.delta = Number((cycle.closeMass - cycle.openMass).toFixed(3));
          } else {
            cycle.delta = null;
          }
          // duration in minutes
          const openTsNum = Date.parse(cycle.openTs);
          const closeTsNum = Date.parse(cycle.closeTs);
          cycle.durationMin = Number.isFinite(openTsNum) && Number.isFinite(closeTsNum) ? Math.round((closeTsNum - openTsNum)/60000) : null;
          cycles.push(cycle);
          waitingOpen = null;
        }
      }
    }
    return cycles;
  }

  function formatKgDelta(delta) {
    if (delta === null || delta === undefined || Number.isNaN(Number(delta))) return '—';
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta.toFixed(2)} kg`;
  }

  function renderSummary() {
    const el = document.getElementById('historySummary');
    if (!el) return;
    const latest = state.history[0];
    if (!latest || !state.pantry) {
      el.innerHTML = '<div class="history-placeholder">No telemetry records found for this pantry yet.</div>';
      return;
    }
    const lastWeight = state.weight.length ? state.weight[state.weight.length - 1].weightKg : '—';
    const lastDoor = state.doors.length ? state.doors[state.doors.length - 1].status : '—';
    el.innerHTML = `
      <div class="history-summary">
        <div class="history-summary-main">
          <h2>${state.pantry.name}</h2>
          <p class="history-summary-sub">${state.pantry.address || ''}</p>
        </div>
        <div class="history-summary-grid">
          <div>
            <div class="history-summary-label">Last updated</div>
            <div class="history-summary-value">${formatDateTime(latest.ts)}</div>
            <div class="history-meta">${formatRelative(latest.ts)}</div>
          </div>
          <div>
            <div class="history-summary-label">Latest weight</div>
            <div class="history-summary-value">${lastWeight === '—' ? '—' : `${lastWeight.toFixed(2)} kg`}</div>
          </div>
          <div>
            <div class="history-summary-label">Latest door event</div>
            <div class="history-summary-value">${lastDoor}</div>
          </div>
          <div>
            <div class="history-summary-label">Records loaded</div>
            <div class="history-summary-value">${state.history.length}</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderWeightChart() {
    const svg = document.getElementById('weightChart');
    const legend = document.getElementById('weightLegend');
    const rangeLabel = document.getElementById('weightRange');
    if (!svg || !legend || !rangeLabel) return;
    // If we have processed recent cycles, show only points around those cycles
    let data = state.weight;
    if (Array.isArray(state.cycles) && state.cycles.length) {
      // collect open and close points for the most recent 4 cycles (chronological)
      const recent = state.cycles.slice(-4);
      const points = [];
      recent.forEach(c => {
        if (c.openTs && c.openMass !== null) points.push({ ts: c.openTs, weightKg: c.openMass, marker: 'open', delta: c.delta });
        if (c.closeTs && c.closeMass !== null) points.push({ ts: c.closeTs, weightKg: c.closeMass, marker: 'close', delta: c.delta });
      });
      // sort points by time
      points.sort((a,b)=>new Date(a.ts)-new Date(b.ts));
      data = points;
    }
    if (!data.length) {
      svg.innerHTML = '';
      legend.textContent = 'No weight data available.';
      rangeLabel.textContent = '';
      return;
    }
    const width = svg.viewBox.baseVal.width || 720;
    const height = svg.viewBox.baseVal.height || 320;
    const margin = { top: 20, right: 32, bottom: 36, left: 56 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const minWeight = Math.min(...data.map((d) => d.weightKg));
    const maxWeight = Math.max(...data.map((d) => d.weightKg));
    const scaleY = (value) => {
      if (maxWeight === minWeight) return margin.top + plotHeight / 2;
      return margin.top + (maxWeight - value) * (plotHeight / (maxWeight - minWeight));
    };
    const scaleX = (index) => {
      if (data.length === 1) return margin.left + plotWidth / 2;
      return margin.left + (index / (data.length - 1)) * plotWidth;
    };
    const points = data.map((d, i) => `${scaleX(i)},${scaleY(d.weightKg)}`).join(' ');
    const minTs = data[0].ts;
    const maxTs = data[data.length - 1].ts;
    svg.innerHTML = `
      <rect x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}" fill="var(--bg)" stroke="var(--border)" stroke-width="1" rx="8"></rect>
      <polyline fill="none" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="${points}"></polyline>
      ${data.map((d, i) => {
        const title = `${formatDateTime(d.ts)} — ${d.weightKg.toFixed(2)} kg`;
        // marker coloring: open/close if present
        let fill = 'var(--primary)';
        if (d.marker === 'open') fill = 'orange';
        if (d.marker === 'close' && d.delta !== undefined && d.delta !== null) fill = d.delta > 0 ? 'green' : 'crimson';
        return `
        <circle cx="${scaleX(i)}" cy="${scaleY(d.weightKg)}" r="6" fill="${fill}" opacity="0.95">
          <title>${title}</title>
        </circle>
      `}).join('')}
    `;
    legend.textContent = `Min ${minWeight.toFixed(2)} kg · Max ${maxWeight.toFixed(2)} kg`;
    rangeLabel.textContent = `${formatDateTime(minTs)} → ${formatDateTime(maxTs)}`;
  }

  function renderDoorTimeline() {
    const container = document.getElementById('doorTimeline');
    const summary = document.getElementById('doorSummary');
    if (!container || !summary) return;
    // Use processed cycles if available
    const cycles = Array.isArray(state.cycles) ? state.cycles.slice().reverse() : [];
    if (!cycles.length) {
      container.innerHTML = '<div class="history-placeholder">No recent activity recorded.</div>';
      summary.textContent = '';
      return;
    }
    // take most recent 4 cycles
    const recent = cycles.slice(0, 4);
    container.innerHTML = recent.map(cycle => {
      const time = formatDateTime(cycle.closeTs || cycle.openTs);
      const delta = cycle.delta;
      const isAdd = delta !== null && delta > 0;
      const label = delta === null ? '—' : (isAdd ? `添加了 ${Math.abs(delta).toFixed(2)} kg` : `取走了 ${Math.abs(delta).toFixed(2)} kg`);
      const icon = delta === null ? '📦' : (isAdd ? '📦' : '🧾');
      const duration = cycle.durationMin !== null ? `${cycle.durationMin} 分钟` : '—';
      const deltaDisplay = formatKgDelta(delta);
      const cls = delta === null ? 'activity-neutral' : (isAdd ? 'activity-add' : 'activity-remove');
      return `
        <div class="activity-card ${cls}">
          <div class="activity-time">${time}</div>
          <div class="activity-main">
            <div class="activity-icon">${icon}</div>
            <div class="activity-body">
              <div class="activity-title">${isAdd ? '添加物品' : '取走物品'}</div>
              <div class="activity-desc">${label} · 门开启了 ${duration}</div>
            </div>
            <div class="activity-delta">${deltaDisplay}</div>
          </div>
        </div>
      `;
    }).join('');
    summary.textContent = `${cycles.length} cycles · ${recent.length} shown`;
  }

  function renderTable() {
    const tbody = document.querySelector('#historyTable tbody');
    if (!tbody) return;
    if (!state.history.length) {
      tbody.innerHTML = '<tr><td colspan="4">No telemetry records yet.</td></tr>';
      return;
    }
    tbody.innerHTML = state.history
      .map((item) => {
        const weight = Number(item.metrics?.weightKg ?? item.metrics?.weightkg);
        const door = item.flags?.door ?? '—';
        const notes = item.flags?.note ?? '';
        return `
          <tr>
            <td>${formatDateTime(item.ts)}</td>
            <td>${Number.isFinite(weight) ? weight.toFixed(2) : '—'}</td>
            <td>${door}</td>
            <td>${notes}</td>
          </tr>
        `;
      })
      .join('');
  }

  function initDownload() {
    const btn = document.getElementById('downloadCsv');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (!state.history.length) return;
      const headers = ['timestamp', 'weightKg', 'door', 'notes'];
      const rows = state.history
        .map((item) => {
          const weight = Number(item.metrics?.weightKg ?? item.metrics?.weightkg);
          const door = item.flags?.door ?? '';
          const notes = item.flags?.note ?? '';
          return [
            item.ts,
            Number.isFinite(weight) ? weight.toFixed(3) : '',
            door,
            notes.replaceAll('"', '""'),
          ];
        });
      const csv = [headers.join(','), ...rows.map((r) => r.map((v) => (v && v.includes(',') ? `"${v}"` : v)).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${state.pantry?.id || 'pantry'}-telemetry.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const pantryId = params.get('pantryId');
    if (!pantryId) {
      document.getElementById('historyHeading').textContent = 'Sensor History';
      document.getElementById('historySubheading').textContent = 'Missing pantry identifier in URL.';
      return;
    }

    try {
      const [pantry, response] = await Promise.all([
        window.PantryAPI.getPantry(pantryId),
        window.PantryAPI.getTelemetryHistory(pantryId),
      ]);
      state.pantry = pantry;
      state.history = Array.isArray(response) ? response : [];
      const { weight, doors } = parseHistory(state.history);
      state.weight = weight;
      state.doors = doors;
      // process open/close cycles from raw history for recent activity
      state.cycles = processDoorEvents(state.history);
      document.getElementById('historyHeading').textContent = pantry.name || 'Sensor History';
      document.getElementById('historySubheading').textContent = `${pantry.address || ''}`;
      renderSummary();
      renderWeightChart();
      renderDoorTimeline();
      renderTable();
    } catch (err) {
      document.getElementById('historySubheading').textContent = 'Failed to load pantry telemetry.';
      console.error('Error loading telemetry history:', err);
    }
  }

  function initBackLink() {
    const link = document.querySelector('[data-role="history-back"]');
    if (!link) return;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      window.history.back();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initBackLink();
      initDownload();
      init();
    });
  } else {
    initBackLink();
    initDownload();
    init();
  }
})();




