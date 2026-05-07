/* ============================================================
   MedIntel Pro — drug.js
   Drug Search · Autocomplete · Interaction Checker
   Recall Alerts · Drug Detail · RAG pipeline
   ============================================================ */

'use strict';

/* ══════════════════════════════════════════
   DRUG SEARCH MODULE
   ══════════════════════════════════════════ */

const DrugSearch = (() => {
  let debounceTimer   = null;
  let activeAbort     = null;
  let selectedDrugs   = [];   /* for interaction checker */
  const DEBOUNCE_MS   = 280;

  /* ── Init search page ── */
  function init() {
    const searchInput = document.getElementById('drug-search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const query = searchInput.value.trim();

      hideAutocomplete();

      if (query.length < 2) return;

      debounceTimer = setTimeout(() => runSearch(query, searchInput), DEBOUNCE_MS);
    });

    searchInput.addEventListener('keydown', (e) => handleAutocompleteKeys(e));

    /* Click outside closes dropdown */
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-input-wrap')) hideAutocomplete();
    });

    /* Interaction checker init */
    initInteractionChecker();

    /* If URL has ?drug= param, auto-load */
    const urlDrug = new URLSearchParams(window.location.search).get('drug');
    if (urlDrug) {
      searchInput.value = urlDrug;
      runSearch(urlDrug, searchInput);
    }
  }

  /* ── Run search + show autocomplete ── */
  async function runSearch(query, inputEl) {
    /* Cancel previous in-flight */
    if (activeAbort) activeAbort.abort();
    activeAbort = new AbortController();

    showSearchLoading(inputEl);

    try {
      const results = await window.MedIntel.DrugAPI.search(query, {
        signal: activeAbort.signal,
      });

      hideSearchLoading(inputEl);

      if (!results || !results.length) {
        showAutocomplete([{ empty: true }], inputEl);
        return;
      }

      showAutocomplete(results, inputEl);

    } catch (err) {
      hideSearchLoading(inputEl);
      if (err.name !== 'AbortError') showSearchError(err);
    }
  }

  /* ── Autocomplete dropdown ── */
  function showAutocomplete(results, anchorEl) {
    hideAutocomplete();

    const wrap = anchorEl.closest('.search-input-wrap') || anchorEl.parentElement;
    const dropdown = document.createElement('div');
    dropdown.className = 'autocomplete';
    dropdown.id = 'drug-autocomplete';

    if (results[0]?.empty) {
      dropdown.innerHTML = `
        <div class="autocomplete__item" style="color:var(--clr-text-muted);cursor:default;">
          No drugs found. Try generic or brand name.
        </div>`;
    } else {
      results.slice(0, 10).forEach((drug, idx) => {
        const item = document.createElement('div');
        item.className = 'autocomplete__item';
        item.dataset.idx = idx;
        item.innerHTML = `
          <div>
            <div class="autocomplete__name">${escapeHTML(drug.brand_name || drug.generic_name)}</div>
            <div class="autocomplete__sub">${escapeHTML(drug.generic_name || '')} · ${escapeHTML(drug.drug_class || '')}</div>
          </div>
          <span class="badge badge-muted autocomplete__type">
            ${drug.controlled_schedule ? 'Sch ' + drug.controlled_schedule : 'Rx'}
          </span>
        `;
        item.addEventListener('click', () => selectDrug(drug));
        dropdown.appendChild(item);
      });
    }

    wrap.style.position = 'relative';
    wrap.appendChild(dropdown);
  }

  function hideAutocomplete() {
    document.getElementById('drug-autocomplete')?.remove();
  }

  /* Arrow key navigation */
  function handleAutocompleteKeys(e) {
    const dropdown = document.getElementById('drug-autocomplete');
    if (!dropdown) return;

    const items = dropdown.querySelectorAll('.autocomplete__item');
    const focused = dropdown.querySelector('.focused');
    let idx = focused ? parseInt(focused.dataset.idx ?? -1) : -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focused?.classList.remove('focused');
      idx = Math.min(idx + 1, items.length - 1);
      items[idx]?.classList.add('focused');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focused?.classList.remove('focused');
      idx = Math.max(idx - 1, 0);
      items[idx]?.classList.add('focused');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focused) focused.click();
    } else if (e.key === 'Escape') {
      hideAutocomplete();
    }
  }

  /* ── Select a drug → show detail ── */
  async function selectDrug(drug) {
    hideAutocomplete();
    const input = document.getElementById('drug-search-input');
    if (input) input.value = drug.brand_name || drug.generic_name;

    renderDrugSkeleton();

    try {
      /* Fetch full detail by ID */
      const detail = await window.MedIntel.DrugAPI.getById(drug.id);
      renderDrugDetail(detail);
      pushURLState(drug);
      trackRecentDrug(drug);
    } catch (err) {
      renderDrugError(err);
    }
  }

  /* ── Render drug detail card ── */
  function renderDrugDetail(drug) {
    const container = document.getElementById('drug-result');
    if (!container) return;

    const pregnancy = formatPregnancy(drug.pregnancy_safety);
    const schedule  = drug.controlled_schedule
      ? `<span class="badge badge-warning">Schedule ${drug.controlled_schedule}</span>`
      : '';

    container.innerHTML = `
      <div class="drug-card" style="animation:scaleIn .25s var(--ease-spring) both">
        <div class="drug-card__header">
          <div class="drug-card__name-block">
            <div class="drug-card__brand">${escapeHTML(drug.brand_name || 'N/A')}</div>
            <div class="drug-card__generic">${escapeHTML(drug.generic_name || '')}</div>
            <div class="drug-card__class">${escapeHTML(drug.drug_class || '')}</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start;">
            ${pregnancy}
            ${schedule}
          </div>
        </div>

        <div class="drug-card__body">
          ${fieldHTML('Indications',             drug.indications)}
          ${fieldHTML('Mechanism of Action',     drug.mechanism_of_action)}
          ${fieldHTML('Dosage & Administration', drug.dosage)}
          ${fieldHTML('Contraindications',       drug.contraindications)}
          ${fieldHTML('Side Effects',            drug.side_effects)}
        </div>

        <div class="drug-card__footer">
          <div class="drug-card__source">
            <span>Sources:</span>
            <span class="data-source-chip">DailyMed</span>
            <span class="data-source-chip">RxNorm</span>
            <span class="data-source-chip">openFDA</span>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-outline btn-sm" onclick="DrugSearch.addToInteractionChecker(${JSON.stringify(drug).replace(/"/g, '&quot;')})">
              + Add to Interaction Checker
            </button>
            <button class="btn btn-ghost btn-sm" onclick="DrugSearch.askAI('${escapeAttr(drug.generic_name || drug.brand_name)}')">
              Ask AI →
            </button>
          </div>
        </div>
      </div>
      <div class="disclaimer-strip" style="margin-top:12px;">
        Always verify drug information with a licensed pharmacist or prescribing physician.
        Last synced from DailyMed: ${new Date().toLocaleDateString()}.
      </div>
    `;

    /* Check for active recalls */
    loadDrugRecalls(drug.brand_name || drug.generic_name, container);
  }

  function fieldHTML(label, value) {
    if (!value || value === 'N/A') return '';
    return `
      <div class="drug-card__field">
        <div class="drug-card__field-label">${escapeHTML(label)}</div>
        <div class="drug-card__field-value">${escapeHTML(value)}</div>
      </div>
    `;
  }

  function formatPregnancy(code) {
    const map = {
      A: { label: 'Pregnancy: A', cls: 'badge-success' },
      B: { label: 'Pregnancy: B', cls: 'badge-success' },
      C: { label: 'Pregnancy: C', cls: 'badge-warning' },
      D: { label: 'Pregnancy: D', cls: 'badge-danger' },
      X: { label: 'Pregnancy: X', cls: 'badge-danger' },
    };
    const entry = map[code?.toUpperCase()];
    return entry ? `<span class="badge ${entry.cls}">${entry.label}</span>` : '';
  }

  /* ── Load recalls for a drug ── */
  async function loadDrugRecalls(drugName, container) {
    try {
      const recalls = await window.MedIntel.DrugAPI.getRecallsByDrug(drugName);
      if (!recalls?.length) return;

      const recallSection = document.createElement('div');
      recallSection.style.marginTop = '12px';
      recallSection.innerHTML = recalls.map(r => `
        <div class="recall-card">
          <div class="recall-card__class">${escapeHTML(r.recall_class || 'N/A')}</div>
          <div>
            <strong style="color:var(--clr-danger);font-size:var(--fs-sm);">Active Recall</strong>
            <p style="font-size:var(--fs-sm);color:var(--clr-text-secondary);margin-top:4px;">
              ${escapeHTML(r.reason || '')}
            </p>
            <small style="color:var(--clr-text-faint);">
              Initiated: ${r.date_initiated || 'Unknown'} · Source: openFDA
            </small>
          </div>
        </div>
      `).join('');

      container.appendChild(recallSection);
    } catch { /* non-critical */ }
  }

  /* ── Skeleton loader ── */
  function renderDrugSkeleton() {
    const container = document.getElementById('drug-result');
    if (!container) return;
    container.innerHTML = `
      <div class="card" style="display:flex;flex-direction:column;gap:16px;">
        <div class="skeleton" style="height:28px;width:40%"></div>
        <div class="skeleton" style="height:18px;width:25%"></div>
        <div class="skeleton" style="height:80px;width:100%"></div>
        <div class="skeleton" style="height:60px;width:100%"></div>
        <div class="skeleton" style="height:60px;width:100%"></div>
      </div>
    `;
  }

  function renderDrugError(err) {
    const container = document.getElementById('drug-result');
    if (!container) return;
    container.innerHTML = `
      <div class="alert alert-warning">
        <span class="alert__icon">⚠️</span>
        <div>
          <strong class="alert__title">Could not load drug data</strong>
          <span class="alert__body">${escapeHTML(err.message || 'Please try again.')}</span>
        </div>
      </div>
    `;
  }

  function showSearchLoading(inputEl) {
    const wrap = inputEl.parentElement;
    wrap.classList.add('searching');
  }

  function showSearchError(err) {
    console.warn('[DrugSearch]', err.message);
  }

  function hideSearchLoading(inputEl) {
    inputEl?.parentElement?.classList.remove('searching');
  }

  /* ── URL state ── */
  function pushURLState(drug) {
    const name = encodeURIComponent(drug.brand_name || drug.generic_name);
    history.pushState({ drugId: drug.id }, '', `?drug=${name}`);
  }

  /* ── Recent drugs (localStorage) ── */
  function trackRecentDrug(drug) {
    try {
      let recents = JSON.parse(localStorage.getItem('medintel_recent_drugs') || '[]');
      recents = recents.filter(d => d.id !== drug.id);
      recents.unshift({ id: drug.id, name: drug.brand_name || drug.generic_name, class: drug.drug_class });
      recents = recents.slice(0, 8);
      localStorage.setItem('medintel_recent_drugs', JSON.stringify(recents));
    } catch { /* private mode */ }
  }

  /* ── Add drug to interaction checker ── */
  function addToInteractionChecker(drug) {
    if (selectedDrugs.find(d => d.id === drug.id)) return;
    if (selectedDrugs.length >= 10) {
      showToast('Maximum 10 drugs for interaction check', 'warning');
      return;
    }
    selectedDrugs.push(drug);
    renderInteractionPills();

    /* Switch to interaction tab if it exists */
    document.querySelector('.tab[data-tab="interactions"]')?.click();
  }

  /* ── AI ask shortcut ── */
  function askAI(drugName) {
    const q = `Tell me about ${drugName} — its uses, dosage, and key side effects.`;
    window.location.href = `chat.html?q=${encodeURIComponent(q)}`;
  }

  return { init, selectDrug, addToInteractionChecker, askAI };
})();

/* ══════════════════════════════════════════
   INTERACTION CHECKER MODULE
   ══════════════════════════════════════════ */

const InteractionChecker = (() => {
  let selectedDrugs = [];

  function init() {
    const addBtn    = document.getElementById('interaction-add-btn');
    const checkBtn  = document.getElementById('interaction-check-btn');
    const clearBtn  = document.getElementById('interaction-clear-btn');

    addBtn?.addEventListener('click', openDrugPicker);
    checkBtn?.addEventListener('click', runCheck);
    clearBtn?.addEventListener('click', clearAll);

    /* Quick-add search */
    const quickSearch = document.getElementById('interaction-search');
    if (quickSearch) {
      let debounce;
      quickSearch.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => runQuickSearch(quickSearch.value), 280);
      });
    }
  }

  async function runQuickSearch(query) {
    if (query.length < 2) return;
    try {
      const results = await window.MedIntel.DrugAPI.search(query);
      renderQuickSearchResults(results);
    } catch { /* ignore */ }
  }

  function renderQuickSearchResults(results) {
    const list = document.getElementById('interaction-search-results');
    if (!list) return;
    list.innerHTML = results.slice(0, 6).map(drug => `
      <div class="autocomplete__item" onclick="InteractionChecker.addDrug(${drug.id}, '${escapeAttr(drug.brand_name || drug.generic_name)}', '${escapeAttr(drug.rxcui || '')}')">
        <div>
          <div class="autocomplete__name">${escapeHTML(drug.brand_name || drug.generic_name)}</div>
          <div class="autocomplete__sub">${escapeHTML(drug.drug_class || '')}</div>
        </div>
        <button class="btn btn-outline btn-xs">+ Add</button>
      </div>
    `).join('');
    list.hidden = false;
  }

  function addDrug(id, name, rxcui) {
    if (selectedDrugs.find(d => d.id === id)) return;
    if (selectedDrugs.length >= 10) {
      showToast('Maximum 10 drugs', 'warning');
      return;
    }
    selectedDrugs.push({ id, name, rxcui });
    renderPills();
    updateCheckButton();
    /* Clear search */
    const searchEl = document.getElementById('interaction-search');
    if (searchEl) searchEl.value = '';
    document.getElementById('interaction-search-results')?.setAttribute('hidden', '');
  }

  function removeDrug(id) {
    selectedDrugs = selectedDrugs.filter(d => d.id !== id);
    renderPills();
    updateCheckButton();
    clearResults();
  }

  function renderPills() {
    const pillsEl = document.getElementById('interaction-pills');
    if (!pillsEl) return;

    if (!selectedDrugs.length) {
      pillsEl.innerHTML = `
        <span style="color:var(--clr-text-faint);font-size:var(--fs-sm);">
          Add 2–10 drugs to check interactions
        </span>`;
      return;
    }

    pillsEl.innerHTML = selectedDrugs.map(d => `
      <span class="badge badge-primary" style="gap:8px;padding:6px 10px;">
        ${escapeHTML(d.name)}
        <button onclick="InteractionChecker.removeDrug(${d.id})"
          style="background:none;border:none;cursor:pointer;color:inherit;line-height:1;padding:0;font-size:12px;">✕</button>
      </span>
    `).join('');
  }

  function updateCheckButton() {
    const btn = document.getElementById('interaction-check-btn');
    if (!btn) return;
    btn.disabled = selectedDrugs.length < 2;
    btn.textContent = selectedDrugs.length < 2
      ? 'Add at least 2 drugs'
      : `Check ${selectedDrugs.length} Drug Interactions`;
  }

  async function runCheck() {
    if (selectedDrugs.length < 2) return;

    const resultsEl = document.getElementById('interaction-results');
    if (!resultsEl) return;

    resultsEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;color:var(--clr-text-muted);">
        <div class="spinner"></div> Checking interactions…
      </div>`;

    try {
      const rxcuis = selectedDrugs.map(d => d.rxcui).filter(Boolean);
      const interactions = await window.MedIntel.DrugAPI.checkInteractions(rxcuis);
      renderResults(interactions);
    } catch (err) {
      resultsEl.innerHTML = `
        <div class="alert alert-warning">
          <span>⚠️</span>
          <div>
            <strong class="alert__title">Check failed</strong>
            <span class="alert__body">${escapeHTML(err.message)}</span>
          </div>
        </div>`;
    }
  }

  function renderResults(interactions) {
    const resultsEl = document.getElementById('interaction-results');
    if (!resultsEl) return;

    if (!interactions.length) {
      resultsEl.innerHTML = `
        <div class="alert alert-success">
          <span>✅</span>
          <div>
            <strong class="alert__title">No known interactions found</strong>
            <span class="alert__body">
              No interactions detected between these drugs in the RxNorm database.
              Always confirm with a pharmacist.
            </span>
          </div>
        </div>`;
      return;
    }

    const byseverity = {
      Major:    interactions.filter(i => i.severity === 'Major'),
      Moderate: interactions.filter(i => i.severity === 'Moderate'),
      Minor:    interactions.filter(i => i.severity === 'Minor'),
    };

    let html = '';
    ['Major', 'Moderate', 'Minor'].forEach(sev => {
      if (!byseverity[sev].length) return;
      html += byseverity[sev].map(ix => `
        <div class="interaction-card interaction-card--${sev.toLowerCase()}">
          <div class="interaction-card__icon">
            ${sev === 'Major' ? '🚨' : sev === 'Moderate' ? '⚠️' : 'ℹ️'}
          </div>
          <div class="interaction-card__body">
            <div class="interaction-card__title">
              ${escapeHTML(ix.drug_a_rxcui)} ↔ ${escapeHTML(ix.drug_b_rxcui)}
              <span class="badge ${severityBadgeClass(sev)}">${sev}</span>
            </div>
            <div class="interaction-card__desc">${escapeHTML(ix.description || '')}</div>
          </div>
        </div>
      `).join('');
    });

    resultsEl.innerHTML = `
      <div style="margin-bottom:12px;">
        <span class="badge badge-danger">${byseverity.Major.length} Major</span>
        <span class="badge badge-warning" style="margin-left:6px;">${byseverity.Moderate.length} Moderate</span>
        <span class="badge badge-info" style="margin-left:6px;">${bySelector.Minor?.length || 0} Minor</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;">${html}</div>
      <div class="disclaimer-strip" style="margin-top:16px;">
        Data sourced from RxNorm Interaction API. Always verify with a licensed pharmacist.
      </div>
    `;
  }

  function severityBadgeClass(sev) {
    return { Major: 'severity-major', Moderate: 'severity-moderate', Minor: 'severity-minor' }[sev] || 'badge-muted';
  }

  function clearAll() {
    selectedDrugs = [];
    renderPills();
    updateCheckButton();
    clearResults();
  }

  function clearResults() {
    const el = document.getElementById('interaction-results');
    if (el) el.innerHTML = '';
  }

  function openDrugPicker() {
    document.getElementById('interaction-search')?.focus();
  }

  return { init, addDrug, removeDrug, runCheck, clearAll };
})();

/* ══════════════════════════════════════════
   RECALLS MODULE
   ══════════════════════════════════════════ */

const RecallsModule = (() => {
  async function init() {
    const container = document.getElementById('recalls-container');
    if (!container) return;

    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;color:var(--clr-text-muted);">
        <div class="spinner"></div> Loading active recalls…
      </div>`;

    try {
      // Use FDA Drug Enforcement API via proxy
      const data = await (await fetch('http://localhost:3001/api/fda/recalls')).json();
      const recalls = data.results || [];
      renderRecalls(recalls, container);
    } catch (err) {
      console.warn('Recalls fetch failed:', err);
      container.innerHTML = `
        <div class="alert alert-warning">
          <span>⚠️</span>
          <span>Unable to load recalls. Check your connection.</span>
        </div>`;
    }
  }

  function renderRecalls(recalls, container) {
    if (!recalls?.length) {
      container.innerHTML = `<p style="color:var(--clr-text-muted);">No active recalls at this time.</p>`;
      return;
    }

    container.innerHTML = recalls.map(r => `
      <div class="recall-card" style="margin-bottom:12px;">
        <div class="recall-card__header">
          <span class="badge badge--danger">Recall</span>
          <span class="recall-card__date">${new Date(r.report_date).toLocaleDateString()}</span>
        </div>
        <h4 class="recall-card__title">${escapeHTML(r.reason_for_recall)}</h4>
        <p class="recall-card__product">${escapeHTML(r.product_description)}</p>
        <div class="recall-card__meta">
          <span>Classification: ${r.classification}</span>
          <span>Status: ${r.status}</span>
        </div>
      </div>
    `).join('');
  }
        <div class="recall-card__class">${escapeHTML(r.recall_class || '?')}</div>
        <div style="flex:1;">
          <div style="font-weight:600;color:var(--clr-text-primary);font-size:var(--fs-sm);margin-bottom:4px;">
            ${escapeHTML(r.drug_name || 'Unknown Product')}
          </div>
          <div style="font-size:var(--fs-sm);color:var(--clr-text-secondary);margin-bottom:6px;">
            ${escapeHTML(r.reason || '')}
          </div>
          <div style="font-size:var(--fs-xs);color:var(--clr-text-faint);display:flex;gap:16px;">
            <span>Initiated: ${r.date_initiated || 'N/A'}</span>
            <span>Status: ${escapeHTML(r.status || 'Active')}</span>
            <span>Source: openFDA</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  return { init };
})();

/* ══════════════════════════════════════════
   SHARED HELPERS
   ══════════════════════════════════════════ */

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function escapeAttr(str) {
  return String(str ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `<span>${escapeHTML(message)}</span>`;
  const container = document.getElementById('toast-container') || document.body;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('dismissing');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ══════════════════════════════════════════
   EXPORTS & AUTO-INIT
   ══════════════════════════════════════════ */

window.MedIntel = window.MedIntel || {};
window.MedIntel.Drug = { DrugSearch, InteractionChecker, RecallsModule };

/* Expose for inline onclick usage */
window.DrugSearch        = DrugSearch;
window.InteractionChecker = InteractionChecker;

function initDrugPage() {
  // Initialize main drug search
  initMainDrugSearch();
  // Initialize filters
  initFilters();
  // Initialize tabs
  initTabSystem();
  // Load recalls count
  loadRecallsCount();
}

function initMainDrugSearch() {
  const searchForm = document.getElementById('drug-search-form');
  const searchInput = document.getElementById('drug-main-search');
  const autocomplete = document.getElementById('drug-autocomplete');

  if (!searchForm || !searchInput) return;

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim();
    if (query.length < 2) {
      hideAutocomplete();
      return;
    }
    showAutocomplete(query);
  });

  searchInput.addEventListener('keydown', (e) => {
    handleAutocompleteKeys(e, searchInput, autocomplete);
  });

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (query) {
      drugSearch(query);
    }
  });

  // Click outside closes autocomplete
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.drug-search-wrap')) {
      hideAutocomplete();
    }
  });
}

function showAutocomplete(query) {
  // Mock autocomplete - in real app, fetch from API
  const suggestions = [
    'Metformin',
    'Warfarin',
    'Lisinopril',
    'Atorvastatin',
    'Amoxicillin',
    'Aspirin',
    'Ibuprofen',
    'Omeprazole'
  ].filter(s => s.toLowerCase().includes(query.toLowerCase()));

  const autocomplete = document.getElementById('drug-autocomplete');
  if (!autocomplete) return;

  if (suggestions.length === 0) {
    autocomplete.hidden = true;
    return;
  }

  autocomplete.innerHTML = suggestions.map(s => `
    <li role="option">
      <button class="autocomplete-item" onclick="selectAutocomplete('${s}')">
        ${escapeHTML(s)}
      </button>
    </li>
  `).join('');

  autocomplete.hidden = false;
}

function hideAutocomplete() {
  const autocomplete = document.getElementById('drug-autocomplete');
  if (autocomplete) autocomplete.hidden = true;
}

function handleAutocompleteKeys(e, input, autocomplete) {
  // Basic keyboard navigation for autocomplete
  if (e.key === 'Escape') {
    hideAutocomplete();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const query = input.value.trim();
    if (query) drugSearch(query);
  }
}

function selectAutocomplete(drug) {
  document.getElementById('drug-main-search').value = drug;
  hideAutocomplete();
  drugSearch(drug);
}

function drugSearch(query) {
  const resultsEl = document.getElementById('drug-results');
  const emptyEl = document.getElementById('search-empty');

  emptyEl.hidden = true;
  resultsEl.hidden = false;

  // Show loading
  document.getElementById('drug-list').innerHTML = `
    <div style="text-align:center;padding:2rem;color:var(--clr-text-muted);">
      <div class="spinner" style="margin:0 auto 1rem;"></div>
      Searching drugs…
    </div>`;

  // Use RxNorm API for drug search via proxy
  fetch(`http://localhost:3001/api/rxnorm/drugs?name=${encodeURIComponent(query)}`)
    .then(response => response.json())
    .then(data => {
      const drugs = data.drugGroup?.conceptGroup || [];
      const results = drugs.flatMap(group => group.conceptProperties || [])
        .slice(0, 20) // Limit results
        .map(drug => ({
          name: drug.synonym || drug.name,
          rxcui: drug.rxcui,
          generic: drug.name,
          class: 'Unknown', // Would need additional API call
          recalls: 0, // Would need FDA API
          flags: []
        }));

      showDrugResults(results);
    })
    .catch(err => {
      console.warn('Drug search failed:', err);
      // Fallback to mock data
      const mockResults = [
        {
          name: query,
          generic: `${query} (generic)`,
          class: 'Unknown',
          rxcui: 'mock',
          recalls: 0,
          flags: []
        }
      ];
      showDrugResults(mockResults);
    });
}

function showDrugResults(results) {
  const emptyEl = document.getElementById('search-empty');
  const resultsEl = document.getElementById('drug-results');
  const listEl = document.getElementById('drug-list');
  const countEl = document.getElementById('drug-results-count');

  if (!results || results.length === 0) {
    emptyEl.hidden = false;
    resultsEl.hidden = true;
    return;
  }

  emptyEl.hidden = true;
  resultsEl.hidden = false;
  countEl.textContent = `${results.length} result${results.length === 1 ? '' : 's'}`;

  listEl.innerHTML = results.map(drug => `
    <li class="drug-item">
      <button class="drug-item__btn" onclick="showDrugDetail('${drug.rxcui}')">
        <div class="drug-item__header">
          <span class="drug-item__name">${escapeHTML(drug.name)}</span>
          <span class="drug-item__generic">${escapeHTML(drug.generic)}</span>
        </div>
        <div class="drug-item__meta">
          <span class="drug-item__class">${escapeHTML(drug.class)}</span>
          ${drug.recalls > 0 ? `<span class="badge badge--danger">Recall</span>` : ''}
        </div>
      </button>
    </li>
  `).join('');
}

function showDrugDetail(rxcui) {
  const detailEl = document.getElementById('drug-detail');
  const resultsEl = document.getElementById('drug-results');

  resultsEl.hidden = true;
  detailEl.hidden = false;

  // Show loading
  document.getElementById('drug-name').textContent = 'Loading…';
  document.getElementById('drug-generic').textContent = '';
  document.getElementById('drug-flags').innerHTML = '';
  document.getElementById('drug-meta').innerHTML = '';

  // Fetch drug details from RxNorm via proxy
  fetch(`http://localhost:3001/api/rxnorm/drug/${rxcui}`)
    .then(response => response.json())
    .then(data => {
      const info = data.rxtermsProperties;
      if (info) {
        document.getElementById('drug-name').textContent = info.brandName || info.fullName;
        document.getElementById('drug-generic').textContent = info.fullGenericName || info.genericName;
        document.getElementById('drug-flags').innerHTML = info.rxtermsDoseForm ? `<span class="badge">${info.rxtermsDoseForm}</span>` : '';
        document.getElementById('drug-meta').innerHTML = `
          <span>Strength: ${info.strength || 'N/A'}</span>
          <span>Route: ${info.route || 'N/A'}</span>
        `;
      }
    })
    .catch(err => {
      console.warn('Drug detail fetch failed:', err);
      // Fallback
      document.getElementById('drug-name').textContent = 'Drug Details';
      document.getElementById('drug-generic').textContent = 'Information not available offline';
    });
}

function showDrugResults() {
  const detailEl = document.getElementById('drug-detail');
  const resultsEl = document.getElementById('drug-results');

  detailEl.hidden = true;
  resultsEl.hidden = false;
}

function explainDrugWithAI() {
  const drugName = document.getElementById('drug-name').textContent;
  if (drugName && drugName !== 'Loading…') {
    const message = `Explain the drug ${drugName} in detail`;
    window.location.href = `/?chat=${encodeURIComponent(message)}`;
  }
}

function initFilters() {
  const resetBtn = document.getElementById('reset-filters');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      document.querySelectorAll('.sidebar input').forEach(input => {
        if (input.type === 'checkbox' || input.type === 'radio') {
          input.checked = false;
        }
      });
    });
  }
}

function initTabSystem() {
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.tab-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active from all tabs and panels
      tabs.forEach(t => {
        t.classList.remove('tab--active');
        t.setAttribute('aria-selected', 'false');
      });
      panels.forEach(p => p.classList.remove('tab-panel--active'));

      // Add active to clicked tab and corresponding panel
      tab.classList.add('tab--active');
      tab.setAttribute('aria-selected', 'true');
      const panelId = tab.getAttribute('aria-controls');
      const panel = document.getElementById(panelId);
      if (panel) panel.classList.add('tab-panel--active');
    });
  });
}

function loadRecallsCount() {
  // Mock recalls count
  const count = 5;
  const badge = document.getElementById('recall-count-badge');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline' : 'none';
  }
}

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

document.addEventListener('DOMContentLoaded', () => {
  DrugSearch.init();
  InteractionChecker.init();
  RecallsModule.init();
});

/* ── Direct exports for onclick handlers ── */
window.drugSearch = drugSearch;
window.showDrugResults = showDrugResults;
window.explainDrugWithAI = explainDrugWithAI;
