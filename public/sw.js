// Service Worker for Key Hunt Offline Support
//
// Cache versioning (L-FE20): bump CACHE_VERSION on each meaningful SW change so
// the activate handler prunes stale caches (including outdated Next.js static
// chunks) instead of letting them accumulate. The version is embedded in every
// cache name; activate deletes any of our caches whose name doesn't match the
// current version.
const CACHE_VERSION = 'v2';
const CACHE_NAME = `key-hunt-cache-${CACHE_VERSION}`;
const OFFLINE_CACHE_NAME = `key-hunt-offline-${CACHE_VERSION}`;
const CURRENT_CACHES = [CACHE_NAME, OFFLINE_CACHE_NAME];

const OFFLINE_URL = '/offline.html';

// Static assets to cache for Key Hunt
const STATIC_ASSETS = [
  '/key-hunt',
  OFFLINE_URL,
];

// Install event - cache static assets (including the offline fallback)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      // Cache each asset independently so one failure (e.g. a not-yet-built
      // route) doesn't abort the whole install.
      return Promise.allSettled(STATIC_ASSETS.map((url) => cache.add(url)));
    })
  );
  // Note: we no longer skipWaiting() here. The new worker stays in "waiting"
  // until the page tells it to activate via the SKIP_WAITING message, giving
  // the client a controlled update flow (L-FE19).
});

// Activate event - clean up old caches (any of ours not on the current version)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(
            (name) =>
              (name.startsWith('key-hunt-') || name.startsWith('con-mode-')) &&
              !CURRENT_CACHES.includes(name)
          )
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all clients immediately so the controlled-update reload
  // lands on the new worker.
  self.clients.claim();
});

// Fetch event - network first for API, cache first for static
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Handle Key Hunt page navigation
  if (url.pathname === '/key-hunt') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache the successful response
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Return cached version if offline, falling back to offline.html.
          return caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || caches.match(OFFLINE_URL);
          });
        })
    );
    return;
  }

  // Offline fallback for any other navigation request.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(OFFLINE_URL).then(
          (cached) =>
            cached ||
            new Response('Offline', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            })
        )
      )
    );
    return;
  }

  // Handle Next.js static assets (_next/static)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        });
      })
    );
    return;
  }
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_LOOKUP_RESULT') {
    // Cache a lookup result sent from the main thread
    const { key, data } = event.data;
    caches.open(OFFLINE_CACHE_NAME).then((cache) => {
      const response = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      });
      cache.put(`/api/cached-lookup/${key}`, response);
    });
  }

  if (event.data && event.data.type === 'GET_CACHED_LOOKUP') {
    const { key } = event.data;
    caches.open(OFFLINE_CACHE_NAME).then((cache) => {
      cache.match(`/api/cached-lookup/${key}`).then((response) => {
        if (response) {
          response.json().then((data) => {
            event.ports[0].postMessage({ found: true, data });
          });
        } else {
          event.ports[0].postMessage({ found: false });
        }
      });
    });
  }
});

// Sync event for background sync (when back online)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-actions') {
    event.waitUntil(syncOfflineActions());
  }
});

async function syncOfflineActions() {
  // Notify clients to sync
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_OFFLINE_ACTIONS' });
  });
}
