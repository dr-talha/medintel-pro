/* ============================================================
   MedIntel Pro — blog.js
   Medical Blog & News · Articles · Breaking Alerts
   ============================================================ */

'use strict';

/* ══════════════════════════════════════════
   BLOG MODULE
   ══════════════════════════════════════════ */

const Blog = (() => {
  let currentFilters = { specialty: 'all', sources: [], page: 1 };
  const ARTICLES_PER_PAGE = 20;

  /* ── Initialize blog page ── */
  function initBlogPage() {
    // Search form
    const searchForm = document.getElementById('blog-search-form');
    const searchInput = document.getElementById('blog-search-input');

    if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query) {
          // Redirect to search results or filter articles
          loadArticles({ ...currentFilters, query, page: 1 });
        }
      });
    }

    // Load more button
    const loadMoreBtn = document.getElementById('load-more-articles');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        currentFilters.page++;
        loadMoreArticles();
      });
    }

    // Initial load
    loadArticles(currentFilters);
    loadBreakingAlert();
    initFilters();
    initViewToggle();
  }

  /* ── Load articles ── */
  async function loadArticles(filters) {
    currentFilters = { ...currentFilters, ...filters };

    const grid = document.getElementById('article-grid');
    const countEl = document.getElementById('article-count');
    const loadMoreBtn = document.getElementById('load-more-articles');

    if (!grid) return;

    // Show loading
    grid.innerHTML = '<div style="text-align:center;padding:2rem;"><div class="spinner"></div>Loading articles…</div>';
    if (countEl) countEl.textContent = '';
    if (loadMoreBtn) loadMoreBtn.hidden = true;

    try {
      const response = await window.MedIntel.BlogAPI.getArticles(currentFilters);
      const articles = response.articles || response;

      renderArticles(articles);

      if (countEl) {
        countEl.textContent = `${response.total || articles.length} articles`;
      }

      if (articles.length >= ARTICLES_PER_PAGE && loadMoreBtn) {
        loadMoreBtn.hidden = false;
      }
    } catch (err) {
      console.warn('Load articles failed:', err);
      // Use mock data for offline/demo
      const mockArticles = getMockArticles(currentFilters);
      renderArticles(mockArticles);
      if (countEl) countEl.textContent = `${mockArticles.length} articles`;
    }
  }

  /* ── Load more articles ── */
  async function loadMoreArticles() {
    const loadMoreBtn = document.getElementById('load-more-articles');
    if (loadMoreBtn) {
      loadMoreBtn.textContent = 'Loading…';
      loadMoreBtn.disabled = true;
    }

    try {
      const response = await window.MedIntel.BlogAPI.getArticles(currentFilters);
      const newArticles = response.articles || response;

      const grid = document.getElementById('article-grid');
      renderArticles(newArticles, true); // append

      if (newArticles.length < ARTICLES_PER_PAGE && loadMoreBtn) {
        loadMoreBtn.hidden = true;
      }
    } catch (err) {
      console.warn('Load more articles failed:', err);
    } finally {
      if (loadMoreBtn) {
        loadMoreBtn.textContent = 'Load more articles';
        loadMoreBtn.disabled = false;
      }
    }
  }

  /* ── Render articles ── */
  function renderArticles(articles, append = false) {
    const grid = document.getElementById('article-grid');
    if (!grid) return;

    if (!append) grid.innerHTML = '';

    if (articles.length === 0) {
      grid.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--clr-text-muted);">No articles found.</div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    articles.forEach(article => {
      const articleEl = document.createElement('article');
      articleEl.className = 'post-card';
      articleEl.innerHTML = `
        <div class="post-card__meta">
          <span class="badge">${escapeHTML(article.source || 'Unknown')}</span>
          <span class="post-card__time">${formatDate(article.pubDate || article.date)}</span>
          ${article.specialty ? `<span class="chip chip--sm">${escapeHTML(article.specialty)}</span>` : ''}
        </div>
        <h3 class="post-card__title">
          <a href="${article.link || '#'}" ${article.link ? 'target="_blank" rel="noopener"' : ''}>${escapeHTML(article.title)}</a>
        </h3>
        <p class="post-card__excerpt">${escapeHTML((article.description || article.excerpt || '').substring(0, 150))}${article.description?.length > 150 ? '…' : ''}</p>
        <div class="post-card__actions">
          <a class="post-card__link" href="${article.link || '#'}" ${article.link ? 'target="_blank" rel="noopener"' : ''}>Read more →</a>
          <button class="btn btn--ghost btn--sm" onclick="toggleBookmark('${article.id || article.title}')">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path d="M15 7v8l-5-3-5 3V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="1.5"/>
            </svg>
            Bookmark
          </button>
        </div>
      `;
      fragment.appendChild(articleEl);
    });

    grid.appendChild(fragment);
  }

  /* ── Load breaking alert ── */
  async function loadBreakingAlert() {
    const banner = document.getElementById('breaking-banner');
    if (!banner) return;

    try {
      const alert = await window.MedIntel.BlogAPI.getBreakingAlert();
      if (alert) {
        document.getElementById('breaking-banner-text').textContent = alert.title;
        document.getElementById('breaking-banner-link').href = alert.link || '#';
        banner.hidden = false;
      }
    } catch (err) {
      console.warn('Breaking alert failed:', err);
      // Mock breaking alert
      const mockAlert = getMockBreakingAlert();
      if (mockAlert) {
        document.getElementById('breaking-banner-text').textContent = mockAlert.title;
        document.getElementById('breaking-banner-link').href = mockAlert.link;
        banner.hidden = false;
      }
    }
  }

  /* ── Load single article ── */
  async function loadArticle(id) {
    const titleEl = document.getElementById('article-title');
    const contentEl = document.getElementById('article-content');
    const metaEl = document.getElementById('article-meta');

    // Show loading
    if (titleEl) titleEl.textContent = 'Loading…';
    if (contentEl) contentEl.innerHTML = '<div style="text-align:center;padding:2rem;"><div class="spinner"></div></div>';
    if (metaEl) metaEl.innerHTML = '';

    try {
      const article = await window.MedIntel.api.get(`/api/blog/${id}`);

      if (titleEl) titleEl.textContent = article.title;
      if (contentEl) contentEl.innerHTML = article.content || article.description;
      if (metaEl) {
        metaEl.innerHTML = `
          <span class="badge">${article.source}</span>
          <span>${formatDate(article.pubDate)}</span>
          ${article.author ? `<span>By ${article.author}</span>` : ''}
        `;
      }

      // Update page title
      document.title = `${article.title} — MedIntel Pro`;

    } catch (err) {
      console.warn('Load article failed:', err);
      if (titleEl) titleEl.textContent = 'Article not found';
      if (contentEl) contentEl.innerHTML = '<p>This article could not be loaded.</p>';
    }
  }

  /* ── Toggle bookmark ── */
  function toggleBookmark(articleId) {
    // Simple localStorage bookmarking
    const bookmarks = JSON.parse(localStorage.getItem('medintel-bookmarks') || '[]');
    const index = bookmarks.indexOf(articleId);

    if (index > -1) {
      bookmarks.splice(index, 1);
    } else {
      bookmarks.push(articleId);
    }

    localStorage.setItem('medintel-bookmarks', JSON.stringify(bookmarks));

    // Could show toast notification
    console.log('Bookmark toggled:', articleId);
  }

  /* ── Ask AI about article ── */
  function askAIAboutArticle() {
    const title = document.getElementById('article-title').textContent;
    if (!title || title === 'Loading…') return;

    const message = `Tell me more about this medical article: "${title}"`;
    window.location.href = `/?chat=${encodeURIComponent(message)}`;
  }

  /* ── Share article ── */
  function shareArticle() {
    const title = document.getElementById('article-title').textContent;
    const url = window.location.href;

    if (navigator.share) {
      navigator.share({
        title: title,
        url: url
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(`${title} ${url}`);
      // Could show toast
    }
  }

  /* ── Report error ── */
  function reportError() {
    const title = document.getElementById('article-title').textContent;
    const message = `Error reported for article: ${title}`;
    window.location.href = `/?chat=${encodeURIComponent(message)}`;
  }

  /* ── Initialize filters ── */
  function initFilters() {
    // Specialty filters
    document.querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('filter-pill--active'));
        btn.classList.add('filter-pill--active');
        const specialty = btn.dataset.specialty;
        loadArticles({ specialty, page: 1 });
      });
    });

    // Source filters
    document.querySelectorAll('input[name="source"]').forEach(input => {
      input.addEventListener('change', () => {
        const sources = Array.from(document.querySelectorAll('input[name="source"]:checked')).map(cb => cb.value);
        loadArticles({ sources, page: 1 });
      });
    });
  }

  /* ── Initialize view toggle ── */
  function initViewToggle() {
    const toggleBtn = document.getElementById('view-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const grid = document.getElementById('article-grid');
        grid.classList.toggle('article-grid--list');
        toggleBtn.textContent = grid.classList.contains('article-grid--list') ? 'Grid view' : 'List view';
      });
    }
  }

  /* ── Mock data for offline/demo ── */
  function getMockArticles(filters) {
    const allArticles = [
      {
        title: 'WHO Updates COVID-19 Guidelines',
        description: 'The World Health Organization has released updated guidelines for COVID-19 prevention and treatment based on the latest scientific evidence.',
        source: 'WHO',
        pubDate: '2024-05-06T10:00:00Z',
        specialty: 'infectious',
        link: '#'
      },
      {
        title: 'Breakthrough in Alzheimer\'s Treatment',
        description: 'NIH-funded study shows promising results for new monoclonal antibody therapy targeting amyloid plaques in early-stage Alzheimer\'s disease.',
        source: 'NIH',
        pubDate: '2024-05-05T14:30:00Z',
        specialty: 'neurology',
        link: '#'
      },
      {
        title: 'Cardiovascular Risk in Young Adults',
        description: 'CDC analysis reveals rising rates of hypertension and dyslipidemia among adults aged 18-35, linked to sedentary lifestyles and poor diet.',
        source: 'CDC',
        pubDate: '2024-05-04T09:15:00Z',
        specialty: 'cardiology',
        link: '#'
      }
    ];

    // Simple filtering
    return allArticles.filter(article => {
      if (filters.specialty && filters.specialty !== 'all' && article.specialty !== filters.specialty) return false;
      if (filters.sources && filters.sources.length > 0 && !filters.sources.includes(article.source.toLowerCase())) return false;
      return true;
    });
  }

  function getMockBreakingAlert() {
    return {
      title: 'BREAKING: New COVID-19 Variant Detected',
      link: '#'
    };
  }

  /* ── Utility functions ── */
  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  }

  return {
    initBlogPage,
    loadArticles,
    loadMoreArticles,
    loadBreakingAlert,
    loadArticle,
    toggleBookmark,
    askAIAboutArticle,
    shareArticle,
    reportError
  };
})();

/* ── Export to window ── */
window.initBlogPage = Blog.initBlogPage;
window.loadArticles = Blog.loadArticles;
window.loadMoreArticles = Blog.loadMoreArticles;
window.loadBreakingAlert = Blog.loadBreakingAlert;
window.loadArticle = Blog.loadArticle;
window.toggleBookmark = Blog.toggleBookmark;
window.askAIAboutArticle = Blog.askAIAboutArticle;
window.shareArticle = Blog.shareArticle;
window.reportError = Blog.reportError;