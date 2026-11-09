/* global clients */
// =============================================================================
// sw.js — Dharul Uloom Kashiful Hudha Service Worker
// Strategy:
//   - Hashed /assets/* (JS/CSS): Network-First (never serve stale hashes)
//   - Navigation (HTML): Network-First with offline fallback
//   - Images / fonts / manifest: Cache-First
//   - Supabase API calls: Network-Only
// =============================================================================

const CACHE_VERSION = 'v1.1.0';
const STATIC_CACHE = `kashiful-hudha-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `kashiful-hudha-runtime-${CACHE_VERSION}`;

const PRECACHE_ASSETS = ['/', '/index.html', '/manifest.json', '/offline.html', '/images/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== STATIC_CACHE && name !== RUNTIME_CACHE)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isHashedAsset(url) {
  return url.origin === self.location.origin && url.pathname.startsWith('/assets/');
}

function isCacheableStatic(url, response) {
  if (!response.ok || url.origin !== self.location.origin) return false;
  const type = (response.headers.get('content-type') || '').toLowerCase();
  // Never cache HTML responses for asset URLs (SPA fallback / missing chunk).
  if (isHashedAsset(url) && type.includes('text/html')) return false;
  return true;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('googleapis.com') ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  // Hashed Vite chunks must always hit the network so deploys don't break.
  if (isHashedAsset(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (isCacheableStatic(url, response)) {
            const cloned = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, cloned));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          throw new TypeError('Failed to fetch hashed asset');
        })
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, cloned));
          return response;
        })
        .catch(async () => (await caches.match('/index.html')) || (await caches.match('/offline.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (isCacheableStatic(url, response)) {
          const cloned = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, cloned));
        }
        return response;
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Kashiful Hudha', body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Kashiful Hudha', {
      body: payload.body || '',
      icon: '/images/icon.svg',
      badge: '/images/icon.svg',
      tag: payload.tag || 'default',
      data: { url: payload.url || '/' },
      actions: [
        { action: 'open', title: 'Open' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
