/* ============================================================
   MedIntel Pro — trad.js
   Traditional Medicine · Remedies · Cultural Practices
   ============================================================ */

'use strict';

/* ══════════════════════════════════════════
   TRADITIONAL MEDICINE MODULE
   ══════════════════════════════════════════ */

const TradMedicine = (() => {
  let currentFilters = { region: 'all', type: 'all' };
  const REMEDIES_PER_PAGE = 20;

  /* ── Initialize traditional medicine page ── */
  function initTradMedicine() {
    // Search form
    const searchForm = document.getElementById('trad-search-form');
    const searchInput = document.getElementById('trad-main-input');

    if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query) tradSearch(query);
      });
    }

    // Region filters
    document.querySelectorAll('.region-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.region-filter').forEach(b => b.classList.remove('filter-pill--active'));
        btn.classList.add('filter-pill--active');
        currentFilters.region = btn.dataset.region;
        loadTradPage();
      });
    });

    // Type filters
    document.querySelectorAll('.type-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.type-filter').forEach(b => b.classList.remove('filter-pill--active'));
        btn.classList.add('filter-pill--active');
        currentFilters.type = btn.dataset.type;
        loadTradPage();
      });
    });

    // Load more button
    const loadMoreBtn = document.getElementById('trad-load-more');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        loadMoreRemedies();
      });
    }

    // Initial load
    loadTradPage();
  }

  /* ── Load traditional medicine page ── */
  async function loadTradPage() {
    const resultsEl = document.getElementById('trad-results');
    const browseEl = document.getElementById('trad-browse');

    // Show browse view
    resultsEl.hidden = true;
    browseEl.hidden = false;

    // Show loading
    const remedyListEl = document.getElementById('trad-remedy-list');
    remedyListEl.innerHTML = '<div style="text-align:center;padding:2rem;"><div class="spinner"></div>Loading remedies…</div>';

    try {
      const remedies = await window.MedIntel.TradMedAPI.getRemedies({
        region: currentFilters.region,
        type: currentFilters.type,
        limit: REMEDIES_PER_PAGE
      });

      renderRemedies(remedies, remedyListEl);
    } catch (err) {
      console.warn('Load traditional remedies failed:', err);
      // Use mock data
      const mockRemedies = getMockRemedies(currentFilters);
      renderRemedies(mockRemedies, remedyListEl);
    }
  }

  /* ── Search traditional remedies ── */
  async function tradSearch(query) {
    const resultsEl = document.getElementById('trad-results');
    const browseEl = document.getElementById('trad-browse');

    // Show results view
    browseEl.hidden = true;
    resultsEl.hidden = false;

    // Show loading
    const remedyListEl = document.getElementById('trad-search-results');
    const resultsCountEl = document.getElementById('trad-results-count');
    const loadMoreBtn = document.getElementById('trad-load-more');

    remedyListEl.innerHTML = '<div style="text-align:center;padding:2rem;"><div class="spinner"></div>Searching…</div>';
    resultsCountEl.textContent = '';
    loadMoreBtn.hidden = true;

    try {
      const results = await window.MedIntel.TradMedAPI.search(query, {
        limit: REMEDIES_PER_PAGE
      });

      resultsCountEl.textContent = `${results.total || results.length} remedies found`;
      renderRemedies(results.remedies || results, remedyListEl);

      if ((results.remedies || results).length >= REMEDIES_PER_PAGE) {
        loadMoreBtn.hidden = false;
      }
    } catch (err) {
      console.warn('Traditional medicine search failed:', err);
      remedyListEl.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--clr-text-muted);">Search failed. Please try again.</div>';
    }
  }

  /* ── Load more remedies ── */
  async function loadMoreRemedies() {
    const loadMoreBtn = document.getElementById('trad-load-more');
    loadMoreBtn.textContent = 'Loading…';
    loadMoreBtn.disabled = true;

    try {
      const results = await window.MedIntel.TradMedAPI.getRemedies({
        ...currentFilters,
        offset: document.querySelectorAll('.remedy-card').length
      });

      const container = document.getElementById('trad-search-results') || document.getElementById('trad-remedy-list');
      renderRemedies(results, container, true); // append

      if (results.length < REMEDIES_PER_PAGE) {
        loadMoreBtn.hidden = true;
      }
    } catch (err) {
      console.warn('Load more remedies failed:', err);
    } finally {
      loadMoreBtn.textContent = 'Load more remedies';
      loadMoreBtn.disabled = false;
    }
  }

  /* ── Render remedies ── */
  function renderRemedies(remedies, container, append = false) {
    if (!append) container.innerHTML = '';

    if (remedies.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--clr-text-muted);">No remedies found.</div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    remedies.forEach(remedy => {
      const remedyEl = document.createElement('div');
      remedyEl.className = 'remedy-card';
      remedyEl.innerHTML = `
        <div class="remedy-card__header">
          <h3 class="remedy-card__name">${escapeHTML(remedy.name)}</h3>
          <div class="remedy-card__meta">
            <span class="badge">${escapeHTML(remedy.region || 'Global')}</span>
            <span class="badge badge--secondary">${escapeHTML(remedy.type || 'Remedy')}</span>
          </div>
        </div>
        <p class="remedy-card__description">${escapeHTML(remedy.description || '').substring(0, 200)}${remedy.description?.length > 200 ? '…' : ''}</p>
        <div class="remedy-card__details">
          ${remedy.ingredients ? `<div class="remedy-card__section"><strong>Ingredients:</strong> ${escapeHTML(remedy.ingredients.join(', '))}</div>` : ''}
          ${remedy.preparation ? `<div class="remedy-card__section"><strong>Preparation:</strong> ${escapeHTML(remedy.preparation)}</div>` : ''}
          ${remedy.usage ? `<div class="remedy-card__section"><strong>Usage:</strong> ${escapeHTML(remedy.usage)}</div>` : ''}
        </div>
        <div class="remedy-card__actions">
          <button class="btn btn--ghost btn--sm" onclick="askAIAboutRemedy('${remedy.id || remedy.name}')">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <rect width="20" height="20" rx="5" fill="var(--accent)"/>
              <path d="M10 4v12M4 10h12" stroke="var(--bg-primary)" stroke-width="2" stroke-linecap="round"/>
            </svg>
            Ask AI
          </button>
        </div>
      `;
      fragment.appendChild(remedyEl);
    });

    container.appendChild(fragment);
  }

  /* ── Ask AI about remedy ── */
  function askAIAboutRemedy(remedyName) {
    const message = `Tell me more about this traditional remedy: "${remedyName}"`;
    window.location.href = `/?chat=${encodeURIComponent(message)}`;
  }

  /* ── Mock data for offline/demo ── */
  function getMockRemedies(filters) {
    const allRemedies = [
      {
        name: 'Ginger Tea for Nausea',
        region: 'Asia',
        type: 'Digestive',
        description: 'Traditional ginger tea has been used for centuries to alleviate nausea and digestive discomfort.',
        ingredients: ['Fresh ginger root', 'Water', 'Honey (optional)'],
        preparation: 'Slice ginger root and boil in water for 10-15 minutes.',
        usage: 'Drink warm, 1-2 cups per day.'
      },
      {
        name: 'Echinacea for Immune Support',
        region: 'North America',
        type: 'Immune',
        description: 'Native American tribes used echinacea for immune system support and wound healing.',
        ingredients: ['Echinacea purpurea root', 'Water'],
        preparation: 'Make a decoction by simmering root in water.',
        usage: 'Take as tea or tincture at first signs of illness.'
      },
      {
        name: 'Turmeric Golden Milk',
        region: 'India',
        type: 'Anti-inflammatory',
        description: 'Ayurvedic golden milk combines turmeric with warming spices for joint and digestive health.',
        ingredients: ['Turmeric powder', 'Milk or plant milk', 'Black pepper', 'Ginger', 'Cinnamon'],
        preparation: 'Heat milk with spices, simmer for 10 minutes.',
        usage: 'Drink warm before bed for best results.'
      }
    ];

    // Simple filtering
    return allRemedies.filter(remedy => {
      if (filters.region && filters.region !== 'all' && remedy.region.toLowerCase() !== filters.region) return false;
      if (filters.type && filters.type !== 'all' && remedy.type.toLowerCase() !== filters.type) return false;
      return true;
    });
  }

  /* ── Utility: escape HTML ── */
  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    initTradMedicine,
    tradSearch,
    askAIAboutRemedy
  };
})();

/* ── Export to window ── */
window.initTradMedicine = TradMedicine.initTradMedicine;
window.tradSearch = TradMedicine.tradSearch;
window.askAIAboutRemedy = TradMedicine.askAIAboutRemedy;