/* ============================================================
   MedIntel Pro — glossary.js
   Medical Glossary · Search · Pronunciation · AI Context
   ============================================================ */

'use strict';

/* ══════════════════════════════════════════
   GLOSSARY MODULE
   ══════════════════════════════════════════ */

const Glossary = (() => {
  let currentFilters = { letter: 'all', specialty: 'all' };
  let currentSearchQuery = '';
  let currentPage = 1;
  const ITEMS_PER_PAGE = 50;

  /* ── Initialize glossary page ── */
  function initGlossary() {
    // Alpha navigation
    document.querySelectorAll('.alpha-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.alpha-btn').forEach(b => b.classList.remove('alpha-btn--active'));
        btn.classList.add('alpha-btn--active');
        currentFilters.letter = btn.dataset.letter;
        currentSearchQuery = '';
        loadGlossaryPage();
      });
    });

    // Specialty filters
    document.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('filter-pill--active'));
        pill.classList.add('filter-pill--active');
        currentFilters.specialty = pill.dataset.specialty;
        currentSearchQuery = '';
        loadGlossaryPage();
      });
    });

    // Search form
    const searchForm = document.getElementById('glossary-search-form');
    const searchInput = document.getElementById('glossary-input');

    if (searchForm && searchInput) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query) glossarySearch(query);
      });

      // Live search with debounce
      let debounceTimer;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const query = searchInput.value.trim();
        if (query.length >= 2) {
          debounceTimer = setTimeout(() => glossarySearch(query), 300);
        } else if (query.length === 0) {
          // Reset to browse view
          currentSearchQuery = '';
          loadGlossaryPage();
        }
      });
    }

    // Load more button
    const loadMoreBtn = document.getElementById('glossary-load-more');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        currentPage++;
        loadMoreTerms();
      });
    }

    // Back button in term detail
    const backBtn = document.getElementById('term-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', showGlossaryResults);
    }

    // Initial load
    loadGlossaryPage();
  }

  /* ── Load glossary browse page ── */
  async function loadGlossaryPage() {
    const resultsEl = document.getElementById('glossary-results');
    const alphaBrowseEl = document.getElementById('alpha-browse');
    const termDetailEl = document.getElementById('term-detail');

    // Hide detail and show results
    termDetailEl.hidden = true;
    resultsEl.hidden = true;
    alphaBrowseEl.hidden = false;

    // Update heading
    const headingEl = document.getElementById('alpha-browse-heading');
    if (headingEl) {
      headingEl.textContent = currentFilters.letter === 'all'
        ? 'All Terms'
        : `Terms starting with ${currentFilters.letter.toUpperCase()}`;
    }

    // Show loading
    const termListEl = document.getElementById('alpha-term-list');
    termListEl.innerHTML = '<div style="text-align:center;padding:2rem;"><div class="spinner"></div>Loading terms…</div>';

    try {
      const terms = await window.MedIntel.GlossaryAPI.getTerms({
        letter: currentFilters.letter,
        specialty: currentFilters.specialty,
        limit: ITEMS_PER_PAGE,
        page: 1
      });

      renderTermList(terms, termListEl, false);
    } catch (err) {
      console.warn('Glossary load failed:', err);
      termListEl.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--clr-text-muted);">Failed to load terms. Please try again.</div>';
    }
  }

  /* ── Search glossary ── */
  async function glossarySearch(query) {
    currentSearchQuery = query;
    currentPage = 1;

    const resultsEl = document.getElementById('glossary-results');
    const alphaBrowseEl = document.getElementById('alpha-browse');
    const termDetailEl = document.getElementById('term-detail');

    // Hide others and show results
    termDetailEl.hidden = true;
    alphaBrowseEl.hidden = true;
    resultsEl.hidden = false;

    // Show loading
    const termListEl = document.getElementById('term-list');
    const resultsCountEl = document.getElementById('glossary-results-count');
    const loadMoreBtn = document.getElementById('glossary-load-more');

    termListEl.innerHTML = '<div style="text-align:center;padding:2rem;"><div class="spinner"></div>Searching…</div>';
    resultsCountEl.textContent = '';
    loadMoreBtn.hidden = true;

    try {
      const results = await window.MedIntel.GlossaryAPI.search(query, {
        limit: ITEMS_PER_PAGE,
        page: currentPage
      });

      resultsCountEl.textContent = `${results.total || results.length} results for "${query}"`;
      renderTermList(results.terms || results, termListEl, true);

      if ((results.terms || results).length >= ITEMS_PER_PAGE) {
        loadMoreBtn.hidden = false;
      }
    } catch (err) {
      console.warn('Glossary search failed:', err);
      termListEl.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--clr-text-muted);">Search failed. Please try again.</div>';
    }
  }

  /* ── Load more terms ── */
  async function loadMoreTerms() {
    const loadMoreBtn = document.getElementById('glossary-load-more');
    loadMoreBtn.textContent = 'Loading…';
    loadMoreBtn.disabled = true;

    try {
      const results = currentSearchQuery
        ? await window.MedIntel.GlossaryAPI.search(currentSearchQuery, {
            limit: ITEMS_PER_PAGE,
            page: currentPage
          })
        : await window.MedIntel.GlossaryAPI.getTerms({
            letter: currentFilters.letter,
            specialty: currentFilters.specialty,
            limit: ITEMS_PER_PAGE,
            page: currentPage
          });

      const termListEl = document.getElementById('term-list');
      const newTerms = results.terms || results;
      renderTermList(newTerms, termListEl, true, true); // append

      if (newTerms.length < ITEMS_PER_PAGE) {
        loadMoreBtn.hidden = true;
      }
    } catch (err) {
      console.warn('Load more failed:', err);
    } finally {
      loadMoreBtn.textContent = 'Load more terms';
      loadMoreBtn.disabled = false;
    }
  }

  /* ── Render term list ── */
  function renderTermList(terms, container, isSearch = false, append = false) {
    if (!append) container.innerHTML = '';

    if (terms.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--clr-text-muted);">No terms found.</div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    terms.forEach(term => {
      const li = document.createElement('li');
      li.className = 'term-item';
      li.innerHTML = `
        <button class="term-item__btn" onclick="showTermDetail('${term.id || term.term}')">
          <div class="term-item__header">
            <span class="term-item__name">${escapeHTML(term.term || term.name)}</span>
            ${term.pronunciation ? `<span class="term-item__phonetic">${term.pronunciation}</span>` : ''}
          </div>
          <p class="term-item__definition">${escapeHTML(term.definition || term.description || '').substring(0, 120)}${term.definition?.length > 120 ? '…' : ''}</p>
          ${term.specialty ? `<span class="term-item__specialty">${escapeHTML(term.specialty)}</span>` : ''}
        </button>
      `;
      fragment.appendChild(li);
    });

    container.appendChild(fragment);
  }

  /* ── Show term detail ── */
  async function showTermDetail(termId) {
    const resultsEl = document.getElementById('glossary-results');
    const alphaBrowseEl = document.getElementById('alpha-browse');
    const termDetailEl = document.getElementById('term-detail');

    resultsEl.hidden = true;
    alphaBrowseEl.hidden = true;
    termDetailEl.hidden = false;

    // Show loading
    document.getElementById('term-name').textContent = 'Loading…';
    document.getElementById('term-phonetic').textContent = '';
    document.getElementById('term-definition').textContent = '';
    document.getElementById('term-flags').innerHTML = '';
    document.getElementById('term-synonyms').innerHTML = '';
    document.getElementById('term-crossrefs').innerHTML = '';
    document.getElementById('term-codes').innerHTML = '';
    document.getElementById('term-source').textContent = '';

    try {
      const term = await window.MedIntel.GlossaryAPI.getTerm(termId);

      document.getElementById('term-name').textContent = term.term || term.name;
      document.getElementById('term-phonetic').textContent = term.pronunciation || '';
      document.getElementById('term-definition').textContent = term.definition || term.description;
      document.getElementById('term-source').textContent = term.source || 'MeSH/DailyMed';

      if (term.synonyms && term.synonyms.length > 0) {
        document.getElementById('term-synonyms').innerHTML = term.synonyms.map(s => `<span class="chip">${escapeHTML(s)}</span>`).join('');
        document.getElementById('term-synonyms-section').hidden = false;
      } else {
        document.getElementById('term-synonyms-section').hidden = true;
      }

      if (term.related && term.related.length > 0) {
        document.getElementById('term-crossrefs').innerHTML = term.related.map(r => `<button class="chip" onclick="showTermDetail('${r.id || r}')">${escapeHTML(r.term || r)}</button>`).join('');
        document.getElementById('term-crossref-section').hidden = false;
      } else {
        document.getElementById('term-crossref-section').hidden = true;
      }

      if (term.codes) {
        document.getElementById('term-codes').innerHTML = Object.entries(term.codes).map(([type, code]) => `<span class="badge">${type}: ${code}</span>`).join('');
        document.getElementById('term-codes-section').hidden = false;
      } else {
        document.getElementById('term-codes-section').hidden = true;
      }

    } catch (err) {
      console.warn('Term detail load failed:', err);
      document.getElementById('term-name').textContent = 'Term not found';
      document.getElementById('term-definition').textContent = 'This term could not be loaded.';
    }
  }

  /* ── Show results view ── */
  function showGlossaryResults() {
    const resultsEl = document.getElementById('glossary-results');
    const alphaBrowseEl = document.getElementById('alpha-browse');
    const termDetailEl = document.getElementById('term-detail');

    termDetailEl.hidden = true;

    if (currentSearchQuery) {
      alphaBrowseEl.hidden = true;
      resultsEl.hidden = false;
    } else {
      resultsEl.hidden = true;
      alphaBrowseEl.hidden = false;
    }
  }

  /* ── Pronounce term ── */
  async function pronounceTerm() {
    const termName = document.getElementById('term-name').textContent;
    if (!termName || termName === 'Loading…') return;

    try {
      // Use Web Speech API for pronunciation
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(termName);
        utterance.rate = 0.8;
        utterance.pitch = 1;
        window.speechSynthesis.speak(utterance);
      } else {
        // Fallback: try to get audio from API
        const audio = await window.MedIntel.GlossaryAPI.getPronunciation(termName);
        if (audio) {
          const audioEl = new Audio(audio.url);
          audioEl.play();
        }
      }
    } catch (err) {
      console.warn('Pronunciation failed:', err);
      // Could show toast
    }
  }

  /* ── Ask AI about term ── */
  async function askAIAboutTerm() {
    const termName = document.getElementById('term-name').textContent;
    if (!termName || termName === 'Loading…') return;

    // Open chat with context about this term
    const message = `Tell me more about the medical term "${termName}"`;
    window.location.href = `/?chat=${encodeURIComponent(message)}`;
  }

  /* ── Utility: escape HTML ── */
  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    initGlossary,
    glossarySearch,
    pronounceTerm,
    askAIAboutTerm,
    showTermDetail,
    showGlossaryResults
  };
})();

/* ── Export to window ── */
window.initGlossary = Glossary.initGlossary;
window.glossarySearch = Glossary.glossarySearch;
window.pronounceTerm = Glossary.pronounceTerm;
window.askAIAboutTerm = Glossary.askAIAboutTerm;
window.showTermDetail = Glossary.showTermDetail;
window.showGlossaryResults = Glossary.showGlossaryResults;