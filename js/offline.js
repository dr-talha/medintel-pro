/* ============================================================
   MedIntel Pro — offline.js
   Service Worker registration · Offline detection · Cache sync
   IndexedDB helpers · Offline banner management
   ============================================================ */

'use strict';

/* ══════════════════════════════════════════
   OFFLINE STATE
   ══════════════════════════════════════════ */

const OfflineState = {
  isOnline:       navigator.onLine,
  swRegistered:   false,
  syncInProgress: false,
};

/* ══════════════════════════════════════════
   SERVICE WORKER REGISTRATION
   ══════════════════════════════════════════ */

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.info('Offline: Service Workers not supported in this browser.');
    return;
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    OfflineState.swRegistered = true;

    /* Check for updates */
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          _showUpdateBanner();
        }
      });
    });

    console.info('Offline: Service Worker registered successfully.');
  } catch (err) {
    console.warn('Offline: Service Worker registration failed:', err);
  }
}

/* ══════════════════════════════════════════
   ONLINE / OFFLINE EVENT LISTENERS
   ══════════════════════════════════════════ */

window.addEventListener('online', () => {
  OfflineState.isOnline = true;
  _hideOfflineBanner();
  _triggerBackgroundSync();
  console.info('Offline: Connection restored.');
});

window.addEventListener('offline', () => {
  OfflineState.isOnline = false;
  _showOfflineBanner();
  console.info('Offline: Connection lost. Switching to offline mode.');
});

/* ══════════════════════════════════════════
   OFFLINE BANNER
   ══════════════════════════════════════════ */

function _showOfflineBanner() {
  let banner = document.getElementById('offline-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.setAttribute('role', 'alert');
    banner.setAttribute('aria-live', 'polite');
    banner.innerHTML = `
      <span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        You're offline — First Aid, Calculators &amp; cached content still available
      </span>
      <button onclick="document.getElementById('offline-banner').hidden=true" aria-label="Dismiss">✕</button>
    `;
    Object.assign(banner.style, {
      position: 'fixed',
      bottom: '1rem',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'var(--warning, #f59e0b)',
      color: '#000',
      padding: '0.6rem 1.2rem',
      borderRadius: '999px',
      fontSize: '0.85rem',
      fontWeight: '600',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      zIndex: '9999',
      boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
      maxWidth: 'calc(100vw - 2rem)',
    });
    document.body.appendChild(banner);
  }
  banner.hidden = false;
}

function _hideOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (banner) banner.hidden = true;
}

function _showUpdateBanner() {
  let banner = document.getElementById('update-banner');
  if (banner) return;
  banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.innerHTML = `
    MedIntel Pro has been updated.
    <button onclick="window.location.reload()" style="margin-left:0.75rem;text-decoration:underline;background:none;border:none;color:inherit;cursor:pointer;font-weight:700;">
      Reload to update
    </button>
  `;
  Object.assign(banner.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    background: 'var(--accent, #06b6d4)',
    color: '#fff',
    padding: '0.75rem 1.5rem',
    textAlign: 'center',
    fontSize: '0.9rem',
    fontWeight: '500',
    zIndex: '9999',
  });
  document.body.prepend(banner);
}

/* ══════════════════════════════════════════
   INDEXEDDB — OFFLINE DRUG/GLOSSARY CACHE
   ══════════════════════════════════════════ */

const IDB_NAME    = 'medintel-offline';
const IDB_VERSION = 1;
let _idb = null;

async function idbOpen() {
  if (_idb) return _idb;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('drugs')) {
        db.createObjectStore('drugs', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('glossary')) {
        db.createObjectStore('glossary', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('first-aid')) {
        db.createObjectStore('first-aid', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    req.onsuccess = (e) => { _idb = e.target.result; resolve(_idb); };
    req.onerror   = (e) => reject(e.target.error);
  });
}

async function idbGet(storeName, key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function idbPut(storeName, value) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function idbGetAll(storeName) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/* ══════════════════════════════════════════
   BACKGROUND SYNC — seed offline data on WiFi
   ══════════════════════════════════════════ */

async function _triggerBackgroundSync() {
  if (OfflineState.syncInProgress || !OfflineState.isOnline) return;
  OfflineState.syncInProgress = true;

  try {
    /* Only sync if last sync was > 24h ago */
    const meta = await idbGet('meta', 'last-sync');
    const lastSync = meta ? meta.value : 0;
    if (Date.now() - lastSync < 24 * 60 * 60 * 1000) return;

    console.info('Offline: Background sync started...');

    /* Fetch first-aid protocols JSON */
    const faRes = await fetch('/static/json/first-aid-protocols.json').catch(() => null);
    if (faRes && faRes.ok) {
      const protocols = await faRes.json();
      for (const p of protocols) await idbPut('first-aid', p);
    }

    /* Mark sync complete */
    await idbPut('meta', { key: 'last-sync', value: Date.now() });
    console.info('Offline: Background sync complete.');
  } catch (err) {
    console.warn('Offline: Background sync failed:', err);
  } finally {
    OfflineState.syncInProgress = false;
  }
}

/* ══════════════════════════════════════════
   PUBLIC API
   ══════════════════════════════════════════ */

const Offline = {
  isOnline:    () => OfflineState.isOnline,
  register:    registerServiceWorker,
  idbGet,
  idbPut,
  idbGetAll,
  syncNow:     _triggerBackgroundSync,
};

/* ══════════════════════════════════════════
   EXPORTS
   ══════════════════════════════════════════ */

window.MedIntel = window.MedIntel || {};
window.MedIntel.offline = Offline;

/* ── First-aid specific functions ── */
function callEmergency() {
  // Detect user's location and show emergency numbers
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords;
      // In a real app, use reverse geocoding to get country
      // For now, show generic emergency
      alert('Emergency: Call 911 (US) or your local emergency number immediately!');
    }, () => {
      alert('Emergency: Call 911 (US) or your local emergency number immediately!');
    });
  } else {
    alert('Emergency: Call 911 (US) or your local emergency number immediately!');
  }
}

function toggleAudio() {
  const audioBtn = document.getElementById('protocol-audio-btn');
  if (audioBtn) {
    // Toggle audio playback for first-aid instructions
    console.log('Toggle audio');
  }
}

window.callEmergency = callEmergency;
window.toggleAudio = toggleAudio;

/* ── Auto-init ── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    registerServiceWorker();
    if (!navigator.onLine) _showOfflineBanner();
  });
} else {
  registerServiceWorker();
  if (!navigator.onLine) _showOfflineBanner();
}
