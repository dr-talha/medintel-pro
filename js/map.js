/* ============================================================
   MedIntel Pro — map.js
   Leaflet Disease Heatmap · Outbreak Circles · Tooltips
   Country Detail · Filters · Live Data · WHO Alerts
   ============================================================ */

'use strict';

/* ══════════════════════════════════════════
   MAP STATE
   ══════════════════════════════════════════ */

const MapState = {
  map:             null,
  markerLayer:     null,
  heatLayer:       null,
  selectedDisease: null,
  selectedCountry: null,
  allData:         [],
  alerts:          [],
  activeFilters: {
    diseases:   new Set(['COVID-19']),
    severities: new Set(['critical', 'high', 'medium', 'low']),
    dateRange:  '30d',
  },
  refreshInterval: null,
};

/* Disease colour palette */
const DISEASE_COLORS = {
  'COVID-19':    '#fc4e2a',
  'Influenza':   '#fd8d3c',
  'Mpox':        '#e377c2',
  'Cholera':     '#17becf',
  'Dengue':      '#bcbd22',
  'Measles':     '#9467bd',
  'Ebola':       '#d62728',
  'default':     '#3ecf8e',
};

/* Severity → circle radius multiplier */
const SEVERITY_RADIUS = {
  critical: 1.4,
  high:     1.0,
  medium:   0.7,
  low:      0.4,
};

/* ══════════════════════════════════════════
   INIT
   ══════════════════════════════════════════ */

async function initMap() {
  const mapEl = document.getElementById('disease-map');
  if (!mapEl || typeof L === 'undefined') return;

  buildLeafletMap(mapEl);
  bindFilterEvents();
  bindMobilePanelToggle();

  await Promise.all([
    loadHeatmapData(),
    loadOutbreakAlerts(),
    loadGlobalStats(),
  ]);

  /* Refresh outbreak counts every 10 minutes */
  MapState.refreshInterval = setInterval(loadHeatmapData, 10 * 60 * 1000);
}

/* ── Build Leaflet map ── */
function buildLeafletMap(el) {
  MapState.map = L.map(el, {
    center:          [20, 10],
    zoom:            2,
    minZoom:         2,
    maxZoom:         10,
    zoomControl:     false,
    attributionControl: true,
  });

  /* Tile layer — CartoDB dark */
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://carto.com/">CARTO</a> © OpenStreetMap contributors',
    subdomains:  'abcd',
    maxZoom:     19,
  }).addTo(MapState.map);

  /* Zoom control — bottom right */
  L.control.zoom({ position: 'bottomright' }).addTo(MapState.map);

  /* Layer groups */
  MapState.markerLayer = L.layerGroup().addTo(MapState.map);

  /* Click on map background → deselect country */
  MapState.map.on('click', () => {
    closeCountryDrawer();
    MapState.selectedCountry = null;
  });
}

/* ══════════════════════════════════════════
   DATA LOADING
   ══════════════════════════════════════════ */

async function loadHeatmapData() {
  try {
    const disease = MapState.selectedDisease || null;
    const data    = await window.MedIntel.DiseaseAPI.getHeatmap(disease, 500);

    MapState.allData = data;
    renderCircles(data);
    renderOutbreakList(data);
  } catch (err) {
    console.warn('[Map] Heatmap load error:', err.message);
  }
}

async function loadOutbreakAlerts() {
  try {
    const alerts = await window.MedIntel.DiseaseAPI.getAlerts();
    MapState.alerts = alerts;
    renderAlertBanners(alerts);
  } catch { /* non-critical */ }
}

async function loadGlobalStats() {
  try {
    const stats = await window.MedIntel.DiseaseAPI.getGlobalStats();
    renderGlobalStats(stats);
  } catch { /* non-critical */ }
}

/* ══════════════════════════════════════════
   CIRCLES ON MAP
   ══════════════════════════════════════════ */

function renderCircles(data) {
  MapState.markerLayer.clearLayers();

  data.forEach(point => {
    if (!point.latitude || !point.longitude) return;
    if (!passesFilters(point)) return;

    const color    = DISEASE_COLORS[point.disease_name] || DISEASE_COLORS.default;
    const severity = getSeverity(point.case_count);
    const radius   = getCircleRadius(point.case_count);

    /* Outer glow ring */
    const ring = L.circleMarker([point.latitude, point.longitude], {
      radius:      radius * 1.8,
      color:       color,
      fillColor:   color,
      fillOpacity: 0.08,
      weight:      0,
      className:   'outbreak-circle',
    });

    /* Main circle */
    const circle = L.circleMarker([point.latitude, point.longitude], {
      radius,
      color:       color,
      fillColor:   color,
      fillOpacity: 0.55,
      weight:      1,
      className:   'outbreak-circle',
    });

    /* Tooltip on hover */
    circle.bindTooltip(buildTooltipHTML(point), {
      direction:   'top',
      offset:      [0, -radius],
      className:   '',
      permanent:   false,
      opacity:     1,
    });

    /* Click → country detail */
    circle.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      openCountryDetail(point);
    });

    ring.addTo(MapState.markerLayer);
    circle.addTo(MapState.markerLayer);
  });
}

function buildTooltipHTML(point) {
  const color = DISEASE_COLORS[point.disease_name] || DISEASE_COLORS.default;
  return `
    <div class="map-tooltip__card">
      <div class="map-tooltip__country">
        ${point.country_code ? `<span>${getFlag(point.country_code)}</span>` : ''}
        <strong>${escapeHTML(point.country_code || point.region || 'Unknown')}</strong>
      </div>
      <div class="map-tooltip__disease" style="color:${color}">
        ${escapeHTML(point.disease_name || '')}
      </div>
      <div class="map-tooltip__stats">
        <div>
          <span class="map-tooltip__stat-val map-tooltip__stat-val--cases">
            ${formatNum(point.case_count)}
          </span>
          <span class="map-tooltip__stat-label">Cases</span>
        </div>
        <div>
          <span class="map-tooltip__stat-val map-tooltip__stat-val--deaths">
            ${formatNum(point.deaths)}
          </span>
          <span class="map-tooltip__stat-label">Deaths</span>
        </div>
        <div>
          <span class="map-tooltip__stat-val map-tooltip__stat-val--rec">
            ${formatNum(point.recovered)}
          </span>
          <span class="map-tooltip__stat-label">Recovered</span>
        </div>
        <div>
          <span class="map-tooltip__stat-val map-tooltip__stat-val--active">
            ${formatNum((point.case_count || 0) - (point.recovered || 0) - (point.deaths || 0))}
          </span>
          <span class="map-tooltip__stat-label">Active</span>
        </div>
      </div>
      <div class="map-tooltip__footer">
        Updated: ${point.reported_at ? new Date(point.reported_at).toLocaleDateString() : 'N/A'}
        · Source: ${escapeHTML(point.source || 'disease.sh')}
      </div>
    </div>
  `;
}

/* ── Circle radius scaling ── */
function getCircleRadius(cases) {
  if (!cases) return 4;
  if (cases > 10_000_000) return 24;
  if (cases > 1_000_000)  return 18;
  if (cases > 100_000)    return 13;
  if (cases > 10_000)     return 9;
  if (cases > 1_000)      return 6;
  return 4;
}

function getSeverity(cases) {
  if (cases > 1_000_000) return 'critical';
  if (cases > 100_000)   return 'high';
  if (cases > 10_000)    return 'medium';
  return 'low';
}

/* ══════════════════════════════════════════
   COUNTRY DETAIL DRAWER
   ══════════════════════════════════════════ */

async function openCountryDetail(point) {
  MapState.selectedCountry = point;

  const drawer = document.getElementById('country-detail-drawer');
  if (!drawer) return;

  drawer.innerHTML = `
    <div class="country-detail-drawer__handle"></div>
    <div class="country-detail-drawer__header">
      <div>
        <div class="country-detail-name">
          ${getFlag(point.country_code)} ${escapeHTML(point.country_code || 'Unknown')}
        </div>
        <div style="font-size:var(--fs-sm);color:var(--clr-primary);font-family:var(--font-mono);">
          ${escapeHTML(point.disease_name || '')}
        </div>
      </div>
      <button onclick="closeCountryDrawer()" class="btn btn-ghost btn-icon">✕</button>
    </div>

    <div class="country-detail-stats">
      ${statCard('Cases',     formatNum(point.case_count),  'var(--clr-warning)')}
      ${statCard('Deaths',    formatNum(point.deaths),       'var(--clr-danger)')}
      ${statCard('Recovered', formatNum(point.recovered),    'var(--clr-success)')}
      ${statCard('Active',    formatNum((point.case_count||0)-(point.recovered||0)-(point.deaths||0)), 'var(--clr-info)')}
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      <a href="disease.html?q=${encodeURIComponent(point.disease_name || '')}"
         class="btn btn-outline btn-sm">View Disease Info →</a>
      <button class="btn btn-ghost btn-sm"
              onclick="MapModule.flyToCountry(${point.latitude}, ${point.longitude})">
        🔍 Zoom In
      </button>
    </div>

    <div class="disclaimer-strip" style="margin-top:16px;">
      Data from disease.sh · WHO GHO · Updated ${point.reported_at
        ? new Date(point.reported_at).toLocaleDateString() : 'recently'}
    </div>
  `;

  drawer.classList.add('open');

  /* Pan map to country */
  flyToCountry(point.latitude, point.longitude);
}

function closeCountryDrawer() {
  document.getElementById('country-detail-drawer')?.classList.remove('open');
}

function flyToCountry(lat, lng, zoom = 5) {
  MapState.map?.flyTo([lat, lng], zoom, { animate: true, duration: 1.2 });
}

function statCard(label, value, color) {
  return `
    <div class="country-detail-stat">
      <div style="font-family:var(--font-mono);font-size:var(--fs-xl);font-weight:600;color:${color};line-height:1;">
        ${escapeHTML(value)}
      </div>
      <div style="font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:.1em;color:var(--clr-text-faint);font-family:var(--font-mono);margin-top:4px;">
        ${escapeHTML(label)}
      </div>
    </div>
  `;
}

/* ══════════════════════════════════════════
   OUTBREAK LIST (sidebar)
   ══════════════════════════════════════════ */

function renderOutbreakList(data) {
  const list = document.getElementById('outbreak-list');
  if (!list) return;

  const sorted = [...data]
    .filter(d => passesFilters(d))
    .sort((a, b) => (b.case_count || 0) - (a.case_count || 0))
    .slice(0, 30);

  if (!sorted.length) {
    list.innerHTML = `<p style="color:var(--clr-text-muted);font-size:var(--fs-sm);padding:12px 0;">
      No outbreaks match current filters.
    </p>`;
    return;
  }

  list.innerHTML = sorted.map(point => {
    const color    = DISEASE_COLORS[point.disease_name] || DISEASE_COLORS.default;
    const severity = getSeverity(point.case_count);
    return `
      <div class="outbreak-card" onclick="MapModule.openCountryDetail(${JSON.stringify(point).replace(/"/g,'&quot;')})"
           style="--card-severity-color:${color}">
        <div class="outbreak-card__top">
          <div class="outbreak-card__country">
            <span class="outbreak-card__flag">${getFlag(point.country_code)}</span>
            <div>
              <div class="outbreak-card__name">${escapeHTML(point.country_code || 'Unknown')}</div>
              <div class="outbreak-card__region">${escapeHTML(point.disease_name || '')}</div>
            </div>
          </div>
          <span class="badge severity-${severity === 'critical' ? 'major' : severity === 'high' ? 'major' : 'minor'}">
            ${severity}
          </span>
        </div>
        <div class="outbreak-card__stats">
          <div class="outbreak-stat outbreak-stat--cases">
            <span class="outbreak-stat__val">${formatNum(point.case_count)}</span>
            <span class="outbreak-stat__label">Cases</span>
          </div>
          <div class="outbreak-stat outbreak-stat--deaths">
            <span class="outbreak-stat__val">${formatNum(point.deaths)}</span>
            <span class="outbreak-stat__label">Deaths</span>
          </div>
          <div class="outbreak-stat outbreak-stat--rec">
            <span class="outbreak-stat__val">${formatNum(point.recovered)}</span>
            <span class="outbreak-stat__label">Rec.</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/* ══════════════════════════════════════════
   ALERT BANNERS (WHO / CDC)
   ══════════════════════════════════════════ */

function renderAlertBanners(alerts) {
  const wrap = document.getElementById('alert-banners');
  if (!wrap || !alerts?.length) return;

  wrap.innerHTML = alerts.slice(0, 3).map(alert => `
    <div class="outbreak-alert-banner">
      <div class="outbreak-alert-banner__icon">🚨</div>
      <div class="outbreak-alert-banner__body">
        <div class="outbreak-alert-banner__title">
          ${escapeHTML(alert.title || 'Outbreak Alert')}
          <span class="outbreak-alert-banner__source">${escapeHTML(alert.source || 'WHO')}</span>
        </div>
        <div class="outbreak-alert-banner__desc">${escapeHTML(alert.description || '')}</div>
        <div class="outbreak-alert-banner__ts">${alert.published_at
          ? new Date(alert.published_at).toLocaleString() : ''}</div>
      </div>
    </div>
  `).join('');
}

/* ══════════════════════════════════════════
   GLOBAL STATS BAR
   ══════════════════════════════════════════ */

function renderGlobalStats(stats) {
  if (!stats) return;
  setEl('stat-global-cases',    formatNum(stats.total_cases));
  setEl('stat-global-deaths',   formatNum(stats.total_deaths));
  setEl('stat-global-rec',      formatNum(stats.total_recovered));
  setEl('stat-global-active',   formatNum(stats.total_active));
  setEl('stat-countries',       stats.affected_countries || '—');
  setEl('stat-last-updated',    stats.updated_at
    ? new Date(stats.updated_at).toLocaleTimeString() : '—');
}

/* ══════════════════════════════════════════
   FILTERS
   ══════════════════════════════════════════ */

function bindFilterEvents() {
  /* Disease chips */
  document.querySelectorAll('.disease-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const disease = chip.dataset.disease;
      if (!disease) return;

      chip.classList.toggle('active');
      if (MapState.activeFilters.diseases.has(disease)) {
        MapState.activeFilters.diseases.delete(disease);
      } else {
        MapState.activeFilters.diseases.add(disease);
      }

      renderCircles(MapState.allData);
      renderOutbreakList(MapState.allData);
    });
  });

  /* Severity toggles */
  document.querySelectorAll('.severity-toggle-row input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const sev = cb.dataset.severity;
      if (!sev) return;
      if (cb.checked) {
        MapState.activeFilters.severities.add(sev);
      } else {
        MapState.activeFilters.severities.delete(sev);
      }
      renderCircles(MapState.allData);
      renderOutbreakList(MapState.allData);
    });
  });

  /* Date range buttons */
  document.querySelectorAll('.map-date-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.map-date-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      MapState.activeFilters.dateRange = btn.dataset.range || '30d';
      loadHeatmapData();
    });
  });

  /* Overlay toggle buttons */
  document.querySelectorAll('.map-overlay-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      const layer = btn.dataset.layer;
      handleLayerToggle(layer, btn.classList.contains('active'));
    });
  });

  /* Search inside panel */
  const panelSearch = document.getElementById('map-search');
  if (panelSearch) {
    panelSearch.addEventListener('input', () => {
      filterOutbreakListBySearch(panelSearch.value.trim());
    });
  }
}

function passesFilters(point) {
  /* Disease filter */
  if (
    MapState.activeFilters.diseases.size > 0 &&
    !MapState.activeFilters.diseases.has(point.disease_name)
  ) return false;

  /* Severity filter */
  const sev = getSeverity(point.case_count);
  if (!MapState.activeFilters.severities.has(sev)) return false;

  return true;
}

function handleLayerToggle(layer, active) {
  if (layer === 'heatmap' && MapState.heatLayer) {
    active
      ? MapState.map.addLayer(MapState.heatLayer)
      : MapState.map.removeLayer(MapState.heatLayer);
  }
}

function filterOutbreakListBySearch(query) {
  const items = document.querySelectorAll('#outbreak-list .outbreak-card');
  items.forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = query && !text.includes(query.toLowerCase()) ? 'none' : '';
  });
}

/* ══════════════════════════════════════════
   MOBILE PANEL TOGGLE
   ══════════════════════════════════════════ */

function bindMobilePanelToggle() {
  const toggleBtn = document.getElementById('map-panel-toggle');
  const panel     = document.querySelector('.map-panel');
  if (!toggleBtn || !panel) return;

  toggleBtn.addEventListener('click', () => {
    panel.classList.toggle('open');
  });

  /* Close on outside click */
  MapState.map?.on('click', () => panel.classList.remove('open'));
}

/* ══════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════ */

function formatNum(n) {
  if (n == null || n === undefined) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function getFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '🌍';
  const offset = 0x1F1E6 - 65;
  return String.fromCodePoint(
    countryCode.toUpperCase().charCodeAt(0) + offset,
    countryCode.toUpperCase().charCodeAt(1) + offset,
  );
}

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '—';
}

/* ══════════════════════════════════════════
   CLEANUP
   ══════════════════════════════════════════ */

function destroyMap() {
  if (MapState.refreshInterval) clearInterval(MapState.refreshInterval);
  MapState.map?.remove();
  MapState.map = null;
}

/* ══════════════════════════════════════════
   EXPORTS
   ══════════════════════════════════════════ */

const MapModule = {
  init: initMap,
  destroyMap,
  openCountryDetail,
  closeCountryDrawer,
  flyToCountry,
  loadHeatmapData,
  MapState,
};

window.MedIntel         = window.MedIntel || {};
window.MedIntel.Map     = MapModule;
window.MapModule        = MapModule;
window.closeCountryDrawer = closeCountryDrawer;

document.addEventListener('DOMContentLoaded', initMap);
