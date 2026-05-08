/* ============================================================
   MedIntel Pro — api.js
   Central API Layer · All fetch calls · Error handling · Retry
   ============================================================ */

'use strict';

/* ── Config ── */
const API_CONFIG = {
  baseURL:    window.MEDINTEL_API_URL || 'http://localhost:3001',
  timeout:    12000,
  retryMax:   2,
  retryDelay: 800,
};

/* ── API Keys (set via environment variables) ── */
const API_KEYS = {
  disease_sh: window.DISEASE_SH_API_KEY || '', // Free API, no key required usually
  openfda:    window.OPENFDA_API_KEY || '',    // Free API
  newsapi:    window.NEWSAPI_KEY || '',        // Free tier available
  // Add more as needed
};

/* ── Logger ── */
const Logger = {
  info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[WARN] ${message}`, ...args),
  error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args),
  debug: (message, ...args) => console.debug(`[DEBUG] ${message}`, ...args),
};

/* ── Request State ── */
const _pendingRequests = new Map();

/* ══════════════════════════════════════════
   CORE FETCH WRAPPER
   ══════════════════════════════════════════ */

/**
 * Base fetch with timeout, retry, abort, and error normalisation.
 * @param {string} path       — API path e.g. '/api/drugs/search'
 * @param {object} options    — fetch options
 * @param {object} meta       — { retry, cacheKey, signal }
 */
async function apiFetch(path, options = {}, meta = {}) {
  const { retry = 0, cacheKey = null, signal = null } = meta;
  const url = `${API_CONFIG.baseURL}${path}`;

  /* — Abort controller — */
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), API_CONFIG.timeout);
  if (signal) signal.addEventListener('abort', () => controller.abort());

  /* — Cancel duplicate in-flight requests — */
  if (cacheKey) {
    if (_pendingRequests.has(cacheKey)) {
      _pendingRequests.get(cacheKey).abort();
    }
    _pendingRequests.set(cacheKey, controller);
  }

  const fetchOptions = {
    ...options,
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...(options.headers || {}),
    },
  };

  try {
    const res = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);
    if (cacheKey) _pendingRequests.delete(cacheKey);

    /* — Handle HTTP errors — */
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new APIError(
        errBody.error || `HTTP ${res.status}`,
        res.status,
        errBody
      );
    }

    return await res.json();

  } catch (err) {
    clearTimeout(timeoutId);
    if (cacheKey) _pendingRequests.delete(cacheKey);

    /* — Retry on network errors (not 4xx) — */
    if (
      !(err instanceof APIError) &&
      retry < API_CONFIG.retryMax &&
      !controller.signal.aborted
    ) {
      await sleep(API_CONFIG.retryDelay * (retry + 1));
      return apiFetch(path, options, { ...meta, retry: retry + 1 });
    }

    /* — Offline fallback signal — */
    if (!navigator.onLine || err.name === 'AbortError') {
      throw new APIError('You are offline. Using cached data where available.', 0, { offline: true });
    }

    throw err;
  }
}

/* ── Convenience methods ── */
const api = {
  get:    (path, meta)         => apiFetch(path, { method: 'GET' }, meta),
  post:   (path, body, meta)   => apiFetch(path, { method: 'POST',   body: JSON.stringify(body) }, meta),
  put:    (path, body, meta)   => apiFetch(path, { method: 'PUT',    body: JSON.stringify(body) }, meta),
  delete: (path, meta)         => apiFetch(path, { method: 'DELETE' }, meta),
};

/* ══════════════════════════════════════════
   UTILITIES
   ══════════════════════════════════════════ */

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str
 * @returns {string}
 */
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ══════════════════════════════════════════
   DRUG ENDPOINTS
   ══════════════════════════════════════════ */

const DrugAPI = {
  /**
   * Search drugs by name (brand or generic)
   * GET /api/drugs/search?q=aspirin
   */
  search(query, { signal } = {}) {
    if (!query || query.trim().length < 2) return Promise.resolve([]);
    const q = encodeURIComponent(query.trim());
    return api.get(`/api/drugs/search?q=${q}`, {
      cacheKey: `drug-search-${query}`,
      signal,
    });
  },

  /**
   * Get full drug detail by ID
   * GET /api/drugs/:id
   */
  getById(id) {
    return api.get(`/api/drugs/${id}`);
  },

  /**
   * Get drug by RxCUI
   * GET /api/drugs/rxcui/:rxcui
   */
  getByRxcui(rxcui) {
    return api.get(`/api/drugs/rxcui/${rxcui}`);
  },

  /**
   * Check interactions between multiple drugs
   * POST /api/drugs/interactions
   * body: { rxcuis: ['123', '456', ...] }
   */
  checkInteractions(rxcuis) {
    if (!rxcuis || rxcuis.length < 2) {
      return Promise.resolve([]);
    }
    return api.post('/api/drugs/interactions', { rxcuis });
  },

  /**
   * Get active drug recalls
   * GET /api/recalls?limit=50
   */
  getRecalls(limit = 50) {
    return api.get(`/api/recalls?limit=${limit}`);
  },

  /**
   * Get recalls for a specific drug
   * GET /api/recalls/drug/:name
   */
  getRecallsByDrug(drugName) {
    return api.get(`/api/recalls/drug/${encodeURIComponent(drugName)}`);
  },

  /**
   * Get drug adverse events from openFDA FAERS
   * GET /api/drugs/:id/adverse-events
   */
  getAdverseEvents(rxcui, limit = 20) {
    return api.get(`/api/drugs/${rxcui}/adverse-events?limit=${limit}`);
  },
};

/* ══════════════════════════════════════════
   DISEASE ENDPOINTS
   ══════════════════════════════════════════ */

const DiseaseAPI = {
  /**
   * Get heatmap data — using disease.sh API (free)
   */
  async getHeatmap(disease = null, limit = 500) {
    try {
      // Use disease.sh for COVID-19 data via proxy
      const data = await apiFetch('/api/disease/countries');

      return data.map(country => ({
        country: country.country,
        country_code: country.countryInfo.iso2,
        latitude: country.countryInfo.lat,
        longitude: country.countryInfo.long,
        case_count: country.cases,
        active_cases: country.active,
        recovered: country.recovered,
        deaths: country.deaths,
        disease_name: 'COVID-19',
        severity: country.cases > 100000 ? 'high' : country.cases > 10000 ? 'medium' : 'low',
        last_updated: country.updated
      })).slice(0, limit);
    } catch (err) {
      console.warn('Disease heatmap API failed:', err);
      return [];
    }
  },

  /**
   * Get global aggregate stats
   */
  async getGlobalStats() {
    try {
      const data = await apiFetch('/api/disease/all');
      return {
        total_cases: data.cases,
        total_deaths: data.deaths,
        total_recovered: data.recovered,
        active_cases: data.active,
        updated: data.updated
      };
    } catch (err) {
      console.warn('Global stats API failed:', err);
      return {};
    }
  },

  /**
   * Get WHO / CDC outbreak alerts — using RSS feeds
   */
  async getAlerts() {
    try {
      // Use WHO RSS feed via proxy
      const data = await apiFetch('/api/who/news');
      const items = data.rss.channel[0].item || [];
      return items.slice(0, 5).map(item => ({
        title: item.title[0],
        description: item.description[0],
        link: item.link[0],
        date: item.pubDate[0],
        source: 'WHO'
      }));
    } catch (err) {
      console.warn('Alerts API failed:', err);
      return [];
    }
  },

  /**
   * Get country detail
   */
  async getCountry(countryCode, disease) {
    try {
      const data = await apiFetch(`/api/disease/countries/${countryCode}`);
      return {
        country: data.country,
        cases: data.cases,
        deaths: data.deaths,
        recovered: data.recovered,
        active: data.active,
        updated: data.updated
      };
    } catch (err) {
      console.warn('Country API failed:', err);
      return {};
    }
  },
};

/* ══════════════════════════════════════════
   RAG / AI CHAT ENDPOINTS
   ══════════════════════════════════════════ */

const BlogAPI = {
  /**
   * Get articles from RSS feeds
   */
  async getArticles(filters = {}) {
    try {
      // Use WHO RSS as primary source via proxy
      const data = await apiFetch('/api/who/news');
      const items = data.rss.channel[0].item || [];
      return items.map(item => ({
        title: item.title[0],
        description: item.description[0],
        link: item.link[0],
        pubDate: item.pubDate[0],
        source: 'WHO',
        specialty: 'public-health', // Default
        type: 'news'
      }));
    } catch (err) {
      console.warn('Blog API failed:', err);
      return [];
    }
  },

  /**
   * Get breaking alerts
   */
  async getBreakingAlert() {
    try {
      // Check WHO emergency RSS via proxy
      const data = await apiFetch('/api/who/emergency');
      const items = data.rss.channel[0].item || [];
      if (items.length > 0) {
        const latest = items[0];
        return {
          title: latest.title[0],
          description: latest.description[0],
          link: latest.link[0],
          urgent: true
        };
      }
    } catch (err) {
      console.warn('Breaking alert API failed:', err);
    }
    return null;
  },
};

/* ══════════════════════════════════════════
   AI CHAT ENDPOINTS
   ══════════════════════════════════════════ */

const ChatAPI = {
  /**
   * Send a question to the RAG-powered AI
   * POST /api/chat
   * body: { message, sessionId }
   */
  ask(message, sessionId = null) {
    return api.post('/api/chat', {
      message: message.trim(),
      sessionId,
    });
  },

  /**
   * Get chat history for the current session (auth required)
   * GET /api/chat/history?sessionId=...
   */
  getHistory(sessionId) {
    return api.get(`/api/chat/history?sessionId=${encodeURIComponent(sessionId)}`);
  },

  /**
   * Persist a chat message (opt-in history)
   * POST /api/chat/save
   */
  saveMessage(payload) {
    return api.post('/api/chat/save', payload);
  },

  /**
   * Submit feedback on an AI response
   * POST /api/chat/feedback
   * body: { messageId, rating }
   */
  submitFeedback(messageId, rating) {
    return api.post('/api/chat/feedback', { messageId, rating });
  },

  /**
   * Delete all chat history for current user
   * DELETE /api/chat/history
   */
  deleteHistory() {
    return api.delete('/api/chat/history');
  },
};

/* ══════════════════════════════════════════
   QUIZ ENDPOINTS
   ══════════════════════════════════════════ */

const QuizAPI = {
  /**
   * Get quiz questions
   * GET /api/quiz?category=pharmacology&difficulty=2&limit=10
   */
  getQuestions({ category = null, difficulty = null, limit = 10, mode = 'practice' } = {}) {
    const params = new URLSearchParams({ limit, mode });
    if (category)   params.set('category', category);
    if (difficulty) params.set('difficulty', difficulty);
    return api.get(`/api/quiz?${params.toString()}`);
  },

  /**
   * Check a quiz answer and get explanation
   * POST /api/quiz/answer
   */
  submitAnswer(questionId, answer) {
    return api.post('/api/quiz/answer', { questionId, answer });
  },

  /**
   * Get quiz categories with question counts
   * GET /api/quiz/categories
   */
  getCategories() {
    return api.get('/api/quiz/categories');
  },

  /**
   * Get daily challenge questions
   * GET /api/quiz/daily
   */
  getDailyChallenge() {
    return api.get('/api/quiz/daily');
  },

  /**
   * Submit a completed quiz session score
   * POST /api/quiz/session
   */
  submitSession(sessionData) {
    return api.post('/api/quiz/session', sessionData);
  },

  /**
   * Get leaderboard
   * GET /api/quiz/leaderboard?category=pharmacology
   */
  getLeaderboard(category = null, limit = 20) {
    const params = new URLSearchParams({ limit });
    if (category) params.set('category', category);
    return api.get(`/api/quiz/leaderboard?${params.toString()}`);
  },

  /**
   * Flag a question as incorrect
   * POST /api/quiz/flag
   */
  flagQuestion(questionId, reason) {
    return api.post('/api/quiz/flag', { questionId, reason });
  },
};

/* ══════════════════════════════════════════
   CALCULATORS ENDPOINT
   ══════════════════════════════════════════ */

const CalculatorAPI = {
  /**
   * Run a server-side calculator (most run client-side)
   * POST /api/calculate/:name
   */
  run(name, inputs) {
    return api.post(`/api/calculate/${name}`, inputs);
  },
};

/* ══════════════════════════════════════════
   NEWS / BLOG ENDPOINTS
   ══════════════════════════════════════════ */

const NewsAPI = {
  /**
   * Get news feed
   * GET /api/news?specialty=cardiology&limit=20&page=1
   */
  getFeed({ specialty = null, limit = 20, page = 1, source = null } = {}) {
    const params = new URLSearchParams({ limit, page });
    if (specialty) params.set('specialty', specialty);
    if (source)    params.set('source', source);
    return api.get(`/api/news?${params.toString()}`, {
      cacheKey: `news-${specialty}-${page}`,
    });
  },

  /**
   * Get single article
   * GET /api/news/:id
   */
  getArticle(id) {
    return api.get(`/api/news/${id}`);
  },

  /**
   * Get pinned outbreak alerts
   * GET /api/news/alerts
   */
  getAlerts() {
    return api.get('/api/news/alerts');
  },

  /**
   * Bookmark an article (auth required)
   * POST /api/news/:id/bookmark
   */
  bookmark(id) {
    return api.post(`/api/news/${id}/bookmark`, {});
  },

  /**
   * Remove bookmark
   * DELETE /api/news/:id/bookmark
   */
  unbookmark(id) {
    return api.delete(`/api/news/${id}/bookmark`);
  },
};

/* ══════════════════════════════════════════
   GLOSSARY ENDPOINTS
   ══════════════════════════════════════════ */

const GlossaryAPI = {
  /**
   * Search glossary terms (MeiliSearch backed)
   * GET /api/glossary/search?q=hypertension
   */
  search(query, { specialty = null, limit = 20 } = {}) {
    const params = new URLSearchParams({ q: query.trim(), limit });
    if (specialty) params.set('specialty', specialty);
    return api.get(`/api/glossary/search?${params.toString()}`, {
      cacheKey: `glossary-${query}`,
    });
  },

  /**
   * Get term detail
   */
  getTerm(termId) {
    return api.get(`/api/glossary/${termId}`);
  },
};

/* ══════════════════════════════════════════
   TRADITIONAL MEDICINE ENDPOINTS
   ══════════════════════════════════════════ */

const TradMedAPI = {
  search(query) {
    return api.get(`/api/trad-medicine/search?q=${encodeURIComponent(query)}`, {
      cacheKey: `tradmed-${query}`,
    });
  },

  getEntry(id) {
    return api.get(`/api/trad-medicine/${id}`);
  },
};

/* ══════════════════════════════════════════
   USER / HEALTH LOG ENDPOINTS (auth required)
   ══════════════════════════════════════════ */

const UserAPI = {
  getProfile() {
    return api.get('/api/user/profile');
  },

  updateProfile(data) {
    return api.put('/api/user/profile', data);
  },

  getHealthLogs({ page = 1, limit = 20 } = {}) {
    return api.get(`/api/user/health-logs?page=${page}&limit=${limit}`);
  },

  addHealthLog(encryptedContent, logDate) {
    return api.post('/api/user/health-logs', { encryptedContent, logDate });
  },

  deleteHealthLog(id) {
    return api.delete(`/api/user/health-logs/${id}`);
  },

  exportData() {
    return api.get('/api/user/export');
  },

  deleteAccount() {
    return api.delete('/api/user/account');
  },

  getBookmarks() {
    return api.get('/api/user/bookmarks');
  },

  getNotificationPrefs() {
    return api.get('/api/user/notifications');
  },

  updateNotificationPrefs(prefs) {
    return api.put('/api/user/notifications', prefs);
  },
};

/* ══════════════════════════════════════════
   FILE UPLOAD (Pro — RAG analysis)
   ══════════════════════════════════════════ */

const UploadAPI = {
  /**
   * Upload a file for AI analysis (deleted within 24h)
   * POST /api/upload
   */
  async uploadFile(file, onProgress) {
    const formData = new FormData();
    formData.append('file', file);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_CONFIG.baseURL}/api/upload`);

      /* Auth header */
      const authHeader = getAuthHeader();
      if (authHeader.Authorization) {
        xhr.setRequestHeader('Authorization', authHeader.Authorization);
      }

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && typeof onProgress === 'function') {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new APIError(`Upload failed: ${xhr.status}`, xhr.status));
        }
      });

      xhr.addEventListener('error', () => reject(new APIError('Upload network error', 0)));
      xhr.send(formData);
    });
  },
};

/* ══════════════════════════════════════════
   ERROR CLASS
   ══════════════════════════════════════════ */

class APIError extends Error {
  constructor(message, status = 0, data = {}) {
    super(message);
    this.name    = 'APIError';
    this.status  = status;
    this.data    = data;
    this.offline = data.offline || false;
  }
}

/* ══════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════ */

function getAuthHeader() {
  try {
    const token = localStorage.getItem('medintel_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ══════════════════════════════════════════
   RESPONSE CACHE (in-memory, TTL-based)
   ══════════════════════════════════════════ */

const _responseCache = new Map();

function cachedGet(path, ttlMs = 60_000) {
  const cached = _responseCache.get(path);
  if (cached && Date.now() - cached.ts < ttlMs) {
    return Promise.resolve(cached.data);
  }
  return api.get(path).then(data => {
    _responseCache.set(path, { data, ts: Date.now() });
    return data;
  });
}

/* Clear stale cache every 5 minutes */
setInterval(() => {
  const now = Date.now();
  _responseCache.forEach((val, key) => {
    if (now - val.ts > 300_000) _responseCache.delete(key);
  });
}, 300_000);

/* ══════════════════════════════════════════
   EXPORTS (Global on window for plain HTML)
   ══════════════════════════════════════════ */

window.MedIntel = window.MedIntel || {};
Object.assign(window.MedIntel, {
  api,
  DrugAPI,
  DiseaseAPI,
  BlogAPI,
  ChatAPI,
  QuizAPI,
  CalculatorAPI,
  NewsAPI,
  GlossaryAPI,
  TradMedAPI,
  UserAPI,
  UploadAPI,
  APIError,
  cachedGet,
  Logger,
  escapeHTML,
});

/* ══════════════════════════════════════════
   GLOBAL ERROR BOUNDARY
   ══════════════════════════════════════════ */

window.addEventListener('unhandledrejection', (event) => {
  Logger.error('Unhandled promise rejection:', event.reason);
  // Prevent the default browser "Uncaught (in promise)" noise in production
  if (window.location.hostname !== 'localhost') {
    event.preventDefault();
  }
});

window.addEventListener('error', (event) => {
  Logger.error('Uncaught error:', event.message, 'at', event.filename, ':', event.lineno);
});
