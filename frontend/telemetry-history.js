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
      const weightKg = Number(item.metrics?.weightKg ?? item.metrics?.weightkg ?? NaN);
      if (!Number.isNaN(weightKg)) {
        weight.push({ ts, weightKg });
      }
      const door = item.flags?.door;
      if (door) {
        doors.push({ ts, status: door });
      }
    });
    weight.sort((a, b) => new Date(a.ts) - new Date(b.ts));
    doors.sort((a, b) => new Date(a.ts) - new Date(b.ts));
    return { weight, doors };
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
    const data = state.weight;
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
      ${data.map((d, i) => `
        <circle cx="${scaleX(i)}" cy="${scaleY(d.weightKg)}" r="4" fill="var(--primary)" opacity="0.9">
          <title>${formatDateTime(d.ts)} — ${d.weightKg.toFixed(2)} kg</title>
        </circle>
      `).join('')}
    `;
    legend.textContent = `Min ${minWeight.toFixed(2)} kg · Max ${maxWeight.toFixed(2)} kg`;
    rangeLabel.textContent = `${formatDateTime(minTs)} → ${formatDateTime(maxTs)}`;
  }

  function renderDoorTimeline() {
    const container = document.getElementById('doorTimeline');
    const summary = document.getElementById('doorSummary');
    if (!container || !summary) return;
    const data = state.doors;
    if (!data.length) {
      container.innerHTML = '<div class="history-placeholder">No door events recorded.</div>';
      summary.textContent = '';
      return;
    }
    const totalOpen = data.filter((d) => d.status === 'open').length;
    container.innerHTML = `
      <ul class="door-events">
        ${data.slice(-40).reverse().map((d) => `
          <li>
            <span class="door-pill ${d.status}">${d.status}</span>
            <span class="door-ts">${formatDateTime(d.ts)}</span>
          </li>
        `).join('')}
      </ul>
    `;
    summary.textContent = `${data.length} events · ${totalOpen} openings`;
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initDownload();
      init();
    });
  } else {
    initDownload();
    init();
  }
})();




