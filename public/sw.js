/* ============================================================
   MedIntel Pro — origin-aware service worker
   Next.js PWA cache isolation by runtime origin
   ============================================================ */

'use strict';

const ORIGIN = self.location.origin;
const CACHE_PREFIX = `medintel-${ORIGIN}`;
const CACHE_VERSION = 'v1';
const STATIC_CACHE = `${CACHE_PREFIX}-${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_PREFIX}-${CACHE_VERSION}-runtime`;
const MAX_RUNTIME_ENTRIES = 80;

const PRECACHE_URLS = ['/', '/manifest.json', '/icons/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(new Request(url, { cache: 'reload' }))));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const staleKeys = keys.filter((key) => key.startsWith('medintel-') && !key.startsWith(CACHE_PREFIX));
      const oldVersionKeys = keys.filter(
        (key) => key.startsWith(CACHE_PREFIX) && key !== STATIC_CACHE && key !== RUNTIME_CACHE,
      );

      await Promise.all([...staleKeys, ...oldVersionKeys].map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== ORIGIN) return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkOnly(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  event.respondWith(networkFirst(request));
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json' ||
    /\.(?:css|js|svg|png|jpg|jpeg|gif|webp|ico|json|woff2?)$/i.test(url.pathname)
  );
}

async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch {
    return Response.json({ error: 'You are offline. Please reconnect and try again.' }, { status: 503 });
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
      await trimCache(RUNTIME_CACHE, MAX_RUNTIME_ENTRIES);
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    if (request.headers.get('accept')?.includes('text/html')) {
      return new Response('<h1>Offline</h1><p>MedIntel Pro is unavailable until your connection returns.</p>', {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return new Response('', { status: 503 });
  }
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;

  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}
