/* ============================================================
   MedIntel Pro — sw.js
   Service Worker · Offline cache · Background sync
   Version: 2.0
   ============================================================ */

'use strict';

const CACHE_VERSION  = 'medintel-v2.1';
const STATIC_CACHE   = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE  = `${CACHE_VERSION}-dynamic`;
const MAX_DYNAMIC    = 60; /* Max entries in dynamic cache */

/* ── Assets to pre-cache on install ── */
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/drugs.html',
  '/calculators.html',
  '/first-aid.html',
  '/quiz.html',
  '/disease-map.html',
  '/blog.html',
  '/blog-post.html',
  '/glossary.html',
  '/trad-medicine.html',
  '/profile.html',
  '/privacy.html',
  '/404.html',
  '/css/base.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/animations.css',
  '/css/chat.css',
  '/css/quiz.css',
  '/css/map.css',
  '/js/api.js',
  '/js/auth.js',
  '/js/offline.js',
  '/js/calculators.js',
  '/js/drug.js',
  '/js/quiz.js',
  '/js/chat.js',
  '/js/map.js',
  '/js/glossary.js',
  '/js/blog.js',
  '/js/trad.js',
  '/manifest.json',
  '/icons/favicon.svg',
];

/* ── JSON data to cache for offline use ── */
const DATA_ASSETS = [
  '/static/json/first-aid-protocols.json',
  '/static/json/calculators-config.json',
  '/static/json/glossary-top10k.json',
];

/* ══════════════════════════════════════════
   INSTALL — pre-cache static assets
   ══════════════════════════════════════════ */

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);

      /* Cache static HTML/CSS/JS */
      await cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Some static assets failed to cache:', err);
      });

      /* Cache data files (non-fatal if missing) */
      await Promise.allSettled(
        DATA_ASSETS.map(url =>
          fetch(url).then(res => res.ok ? cache.put(url, res) : null).catch(() => null)
        )
      );

      console.info('[SW] Install complete. Static assets cached.');
      /* Skip waiting so new SW activates immediately */
      self.skipWaiting();
    })()
  );
});

/* ══════════════════════════════════════════
   ACTIVATE — clean up old caches
   ══════════════════════════════════════════ */

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const staleKeys = keys.filter(k =>
        k.startsWith('medintel-') &&
        k !== STATIC_CACHE &&
        k !== DYNAMIC_CACHE
      );
      await Promise.all(staleKeys.map(k => caches.delete(k)));
      console.info('[SW] Activate: stale caches removed:', staleKeys);
      /* Claim all clients so new SW takes effect immediately */
      await self.clients.claim();
    })()
  );
});

/* ══════════════════════════════════════════
   FETCH — cache strategy per resource type
   ══════════════════════════════════════════ */

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  /* Only handle GET requests from our own origin */
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin && !url.hostname.includes('leaflet')) return;

  /* ── Strategy: API calls — network first, no cache ── */
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkOnly(request));
    return;
  }

  /* ── Strategy: Static assets — cache first ── */
  if (
    url.pathname.startsWith('/css/') ||
    url.pathname.startsWith('/js/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.svg') ||
    url.pathname === '/manifest.json'
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  /* ── Strategy: JSON data files — stale-while-revalidate ── */
  if (url.pathname.startsWith('/static/json/')) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  /* ── Strategy: HTML pages — network first with offline fallback ── */
  event.respondWith(networkFirstWithFallback(request));
});

/* ══════════════════════════════════════════
   CACHE STRATEGIES
   ══════════════════════════════════════════ */

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return offlineFallback(request);
  }
}

async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response(
      JSON.stringify({ error: 'Offline', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkFetch = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  return cached || await networkFetch || offlineFallback(request);
}

async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request, { signal: AbortSignal.timeout(8000) });
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
      await _trimCache(DYNAMIC_CACHE, MAX_DYNAMIC);
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || offlineFallback(request);
  }
}

async function offlineFallback(request) {
  const url = new URL(request.url);

  /* Return cached 404 page for HTML requests */
  if (request.headers.get('Accept')?.includes('text/html')) {
    const fallback = await caches.match('/404.html');
    return fallback || new Response('<h1>Offline</h1><p>You are offline. Please reconnect.</p>', {
      status: 503,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  return new Response('', { status: 503 });
}

/* ── Trim cache to max entries ── */
async function _trimCache(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys  = await cache.keys();
  if (keys.length > max) {
    const toDelete = keys.slice(0, keys.length - max);
    await Promise.all(toDelete.map(k => cache.delete(k)));
  }
}

/* ══════════════════════════════════════════
   BACKGROUND SYNC
   ══════════════════════════════════════════ */

self.addEventListener('sync', (event) => {
  if (event.tag === 'medintel-data-sync') {
    event.waitUntil(_backgroundDataSync());
  }
});

async function _backgroundDataSync() {
  console.info('[SW] Background sync triggered.');
  /* Revalidate key data files on reconnect */
  const cache = await caches.open(STATIC_CACHE);
  await Promise.allSettled(
    DATA_ASSETS.map(url =>
      fetch(url).then(res => res.ok ? cache.put(url, res) : null).catch(() => null)
    )
  );
  console.info('[SW] Background sync complete.');
}

/* ══════════════════════════════════════════
   PUSH NOTIFICATIONS
   ══════════════════════════════════════════ */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'MedIntel Pro', body: event.data.text() };
  }

  const options = {
    body:    payload.body  || 'New update from MedIntel Pro',
    icon:    payload.icon  || '/icons/icon-192.png',
    badge:   '/icons/icon-96.png',
    tag:     payload.tag   || 'medintel-notification',
    data:    { url: payload.url || '/' },
    actions: payload.actions || [],
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'MedIntel Pro', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      const existingWindow = windowClients.find(c => c.url.includes(self.location.origin));
      if (existingWindow) {
        existingWindow.focus();
        existingWindow.navigate(url);
      } else {
        clients.openWindow(url);
      }
    })
  );
});

console.info('[SW] MedIntel Pro Service Worker v2.0 loaded.');
