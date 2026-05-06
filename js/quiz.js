/* ============================================================
   MedIntel Pro — offline.js
   Service Worker Registration · IndexedDB · Offline Detection
   Background Sync · Cache Management · Offline UI
   ============================================================ */

'use strict';

/* ══════════════════════════════════════════
   CONFIG
   ══════════════════════════════════════════ */

const OFFLINE_CONFIG = {
  swPath:        '/service-worker.js',
  dbName:        'MedIntelDB',
  dbVersion:     3,
  syncQueueName: 'sync-queue',
};

/* IndexedDB store definitions */
const IDB_STORES = [
  { name: 'drugs',        keyPath: 'id',  indexes: [{ name: 'brand_name', unique: false }, { name: 'generic_name', unique: false }] },
  { name: 'glossary',     keyPath: 'id',  indexes: [{ name: 'term', unique: false }] },
  { name: 'firstaid',     keyPath: 'id' },
  { name: 'calculators',  keyPath: 'id' },
  { name: 'quiz',         keyPath: 'id',  indexes: [{ name: 'category', unique: false }] },
  { name: 'sync_queue',   keyPath: 'id',  autoIncrement: true },
  { name: 'settings',     keyPath: 'key' },
];

/* ══════════════════════════════════════════
   SERVICE WORKER REGISTRATION
   ══════════════════════════════════════════ */

let _swRegistration = null;

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('[Offline] Service Workers not supported');
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register(OFFLINE_CONFIG.swPath, {
      scope: '/',
    });

    _swRegistration = reg;

    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      newWorker?.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateBanner();
        }
      });
    });

    /* Listen for messages from SW */
    navigator.serviceWorker.addEventListener('message', handleSWMessage);

    console.log('[Offline] Service Worker registered:', reg.scope);
    return reg;

  } catch (err) {
    console.warn('[Offline] SW registration failed:', err.message);
    return null;
  }
}

function handleSWMessage(event) {
  const { type, payload } = event.data || {};
  switch (type) {
    case 'CACHE_UPDATED':
      console.log('[Offline] Cache updated:', payload);
      break;
    case 'OFFLINE_FALLBACK':
      showOfflineBanner();
      break;
    case 'SYNC_COMPLETE':
      processQueuedRequests();
      break;
  }
}

/* ══════════════════════════════════════════
   INDEXEDDB WRAPPER
   ══════════════════════════════════════════ */

let _db = null;

async function openDB() {
  if (_db) return _db;

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_CONFIG.dbName, OFFLINE_CONFIG.dbVersion);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      IDB_STORES.forEach(storeDef => {
        if (!db.objectStoreNames.contains(storeDef.name)) {
          const store = db.createObjectStore(storeDef.name, {
            keyPath:       storeDef.keyPath,
            autoIncrement: storeDef.autoIncrement || false,
          });
          storeDef.indexes?.forEach(idx => {
            store.createIndex(idx.name, idx.name, { unique: idx.unique });
          });
        }
      });
    };

    req.onsuccess = (e) => {
      _db = e.target.result;
      resolve(_db);
    };

    req.onerror = () => reject(req.error);
  });
}

/* ── Generic IDB operations ── */
async function idbGet(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function idbGetAll(storeName, indexName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const source = indexName ? store.index(indexName) : store;
    const req   = value !== undefined
      ? source.getAll(IDBKeyRange.only(value))
      : source.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function idbPut(storeName, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function idbBulkPut(storeName, items) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    items.forEach(item => store.put(item));
    tx.oncomplete = () => resolve(items.length);
    tx.onerror    = () => reject(tx.error);
  });
}

async function idbDelete(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

async function idbClear(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).clear();
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

/* ── Drug offline search ── */
async function offlineDrugSearch(query) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx      = db.transaction('drugs', 'readonly');
    const store   = tx.objectStore('drugs');
    const results = [];
    const lower   = query.toLowerCase();

    store.openCursor().onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) { resolve(results); return; }

      const drug = cursor.value;
      if (
        (drug.brand_name || '').toLowerCase().includes(lower) ||
        (drug.generic_name || '').toLowerCase().includes(lower)
      ) {
        results.push(drug);
      }

      if (results.length >= 20) { resolve(results); return; }
      cursor.continue();
    };
    tx.onerror = () => reject(tx.error);
  });
}

/* ── Glossary offline search ── */
async function offlineGlossarySearch(query) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx      = db.transaction('glossary', 'readonly');
    const store   = tx.objectStore('glossary');
    const results = [];
    const lower   = query.toLowerCase();

    store.openCursor().onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) { resolve(results); return; }

      const term = cursor.value;
      if ((term.term || '').toLowerCase().includes(lower) ||
          (term.definition || '').toLowerCase().includes(lower)) {
        results.push(term);
      }
      if (results.length >= 15) { resolve(results); return; }
      cursor.continue();
    };
    tx.onerror = () => reject(tx.error);
  });
}

/* ══════════════════════════════════════════
   OFFLINE SYNC — download data for offline use
   ══════════════════════════════════════════ */

let syncProgress = 0;

async function startOfflineSync(onProgress) {
  if (!navigator.onLine) {
    showToast('Cannot sync while offline.', 'warning');
    return;
  }

  const steps = [
    { label: 'Downloading top drugs…',    fn: syncDrugs },
    { label: 'Downloading glossary…',     fn: syncGlossary },
    { label: 'Downloading first aid…',    fn: syncFirstAid },
    { label: 'Caching quiz questions…',   fn: syncQuizQuestions },
  ];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    syncProgress = Math.round(((i) / steps.length) * 100);
    onProgress?.(syncProgress, step.label);

    try {
      await step.fn();
    } catch (err) {
      console.warn('[Offline] Sync step failed:', step.label, err.message);
    }
  }

  syncProgress = 100;
  onProgress?.(100, 'Sync complete!');

  await idbPut('settings', { key: 'last_sync', value: new Date().toISOString() });
  showToast('Offline sync complete. App works without internet.', 'success');
}

async function syncDrugs() {
  const { DrugAPI } = window.MedIntel || {};
  if (!DrugAPI) return;

  /* Top 5,000 drugs by common names */
  const drugs = await window.MedIntel.api.get('/api/drugs/top?limit=5000');
  await idbBulkPut('drugs', drugs);
  console.log('[Offline] Synced', drugs.length, 'drugs');
}

async function syncGlossary() {
  const terms = await window.MedIntel.api.get('/api/glossary/offline?limit=10000');
  await idbBulkPut('glossary', terms);
  console.log('[Offline] Synced', terms.length, 'glossary terms');
}

async function syncFirstAid() {
  const protocols = await fetch('/data/first-aid-protocols.json').then(r => r.json());
  await idbBulkPut('firstaid', protocols);
  console.log('[Offline] Synced', protocols.length, 'first aid protocols');
}

async function syncQuizQuestions() {
  const questions = await window.MedIntel.api.get('/api/quiz/offline?limit=500');
  await idbBulkPut('quiz', questions);
  console.log('[Offline] Synced', questions.length, 'quiz questions');
}

/* ── Check last sync time ── */
async function getLastSyncTime() {
  try {
    const entry = await idbGet('settings', 'last_sync');
    return entry?.value ? new Date(entry.value) : null;
  } catch {
    return null;
  }
}

async function isFullySynced() {
  const lastSync = await getLastSyncTime();
  if (!lastSync) return false;
  const daysSince = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60 * 24);
  return daysSince < 7;   /* re-sync after 7 days */
}

/* ══════════════════════════════════════════
   BACKGROUND SYNC QUEUE
   Queue requests made while offline
   ══════════════════════════════════════════ */

async function queueRequest(request) {
  await idbPut('sync_queue', {
    url:       request.url,
    method:    request.method || 'POST',
    body:      request.body,
    timestamp: Date.now(),
  });
}

async function processQueuedRequests() {
  const db = await openDB();
  const allQueued = await idbGetAll('sync_queue');

  for (const item of allQueued) {
    try {
      await fetch(item.url, {
        method:  item.method,
        headers: { 'Content-Type': 'application/json' },
        body:    item.body,
      });
      await idbDelete('sync_queue', item.id);
    } catch {
      break;   /* still offline */
    }
  }
}

/* ══════════════════════════════════════════
   ONLINE / OFFLINE DETECTION
   ══════════════════════════════════════════ */

let _isOnline = navigator.onLine;

function initOnlineDetection() {
  window.addEventListener('online',  handleOnline);
  window.addEventListener('offline', handleOffline);

  /* Initial state */
  if (!navigator.onLine) showOfflineBanner();
}

function handleOnline() {
  _isOnline = true;
  hideOfflineBanner();
  processQueuedRequests();
  showToast('Back online — syncing…', 'success');
}

function handleOffline() {
  _isOnline = false;
  showOfflineBanner();
  showToast('You\'re offline. Cached data is available.', 'warning');
}

function isOnline() { return _isOnline; }

/* ══════════════════════════════════════════
   OFFLINE UI
   ══════════════════════════════════════════ */

function showOfflineBanner() {
  let banner = document.getElementById('offline-banner');
  if (banner) return;

  banner = document.createElement('div');
  banner.id        = 'offline-banner';
  banner.className = 'offline-banner';
  banner.innerHTML = `
    <span style="font-size:16px;">📡</span>
    <span>Offline mode — showing cached data</span>
  `;
  document.body.appendChild(banner);
}

function hideOfflineBanner() {
  document.getElementById('offline-banner')?.remove();
}

function showUpdateBanner() {
  let banner = document.getElementById('update-banner');
  if (banner) return;

  banner = document.createElement('div');
  banner.id        = 'update-banner';
  banner.className = 'offline-banner';
  banner.style.borderColor = 'var(--clr-primary)';
  banner.style.color       = 'var(--clr-primary)';
  banner.innerHTML = `
    <span>🔄 New version available</span>
    <button class="btn btn-primary btn-xs" onclick="OfflineModule.applyUpdate()">
      Update Now
    </button>
  `;
  document.body.appendChild(banner);
}

async function applyUpdate() {
  if (_swRegistration?.waiting) {
    _swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
  window.location.reload();
}

/* ══════════════════════════════════════════
   SYNC SETTINGS UI
   ══════════════════════════════════════════ */

async function initSyncSettingsUI() {
  const syncBtn     = document.getElementById('offline-sync-btn');
  const syncStatus  = document.getElementById('offline-sync-status');
  const progressBar = document.getElementById('offline-sync-progress');

  if (!syncBtn) return;

  const lastSync = await getLastSyncTime();
  const synced   = await isFullySynced();

  if (syncStatus) {
    syncStatus.textContent = lastSync
      ? `Last synced: ${lastSync.toLocaleDateString()} — ${synced ? '✅ Up to date' : '⚠ Sync recommended'}`
      : 'Not yet synced — tap to download offline data';
  }

  syncBtn.addEventListener('click', async () => {
    syncBtn.disabled     = true;
    syncBtn.textContent  = 'Syncing…';

    await startOfflineSync((pct, label) => {
      if (progressBar) progressBar.style.width = `${pct}%`;
      if (syncStatus)  syncStatus.textContent  = label;
    });

    syncBtn.disabled    = false;
    syncBtn.textContent = 'Sync Complete ✅';
    setTimeout(() => { syncBtn.textContent = 'Re-sync'; syncBtn.disabled = false; }, 3000);
  });
}

/* ══════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════ */

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  (document.getElementById('toast-container') || document.body).appendChild(toast);
  setTimeout(() => { toast.classList.add('dismissing'); setTimeout(() => toast.remove(), 300); }, 3500);
}

/* ══════════════════════════════════════════
   INIT
   ══════════════════════════════════════════ */

async function initOffline() {
  initOnlineDetection();
  await registerServiceWorker();
  await initSyncSettingsUI();

  /* Auto-process any queued requests on load */
  if (navigator.onLine) {
    processQueuedRequests();
  }
}

/* ══════════════════════════════════════════
   EXPORTS
   ══════════════════════════════════════════ */

const OfflineModule = {
  init:                 initOffline,
  startOfflineSync,
  applyUpdate,
  isOnline,
  isFullySynced,
  getLastSyncTime,
  queueRequest,
  /* IDB helpers exposed for other modules */
  idb: { get: idbGet, getAll: idbGetAll, put: idbPut, bulkPut: idbBulkPut, delete: idbDelete, clear: idbClear },
  offlineDrugSearch,
  offlineGlossarySearch,
};

window.MedIntel         = window.MedIntel || {};
window.MedIntel.Offline = OfflineModule;
window.OfflineModule    = OfflineModule;

document.addEventListener('DOMContentLoaded', initOffline);
