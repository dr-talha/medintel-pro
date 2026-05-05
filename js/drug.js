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
      const recalls = await window.MedIntel.DrugAPI.getRecalls(50);
      renderRecalls(recalls, container);
    } catch (err) {
      container.innerHTML = `
        <div class="alert alert-warning">
          <span>⚠️</span>
          <span>${escapeHTML(err.message)}</span>
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

document.addEventListener('DOMContentLoaded', () => {
  DrugSearch.init();
  InteractionChecker.init();
  RecallsModule.init();
});
