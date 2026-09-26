// Replaced with a per-build hash by the Vite build (see vite.config.js), so every
// deploy ships a byte-different service worker and the browser installs it
const CACHE_VERSION = '__BUILD_HASH__';
const CACHE_NAME = `tartu-bussid-v${CACHE_VERSION}`;

// Detect base path from service worker location
const getBasePath = () => {
  const swPath = self.location.pathname;
  return swPath.substring(0, swPath.lastIndexOf('/') + 1);
};

const BASE_PATH = getBasePath();

const urlsToCache = [
  `${BASE_PATH}`,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}manifest.json`,
  `${BASE_PATH}icon-192.png`,
  `${BASE_PATH}icon-512.png`,
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  console.log('Service Worker installing with base path:', BASE_PATH);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache, caching:', urlsToCache);
        // Cache files individually to see which one fails
        return Promise.all(
          urlsToCache.map(url =>
            cache.add(new Request(url, { cache: 'reload' })).catch(err => {
              console.warn(`Failed to cache ${url}:`, err);
              // Don't fail the entire install if one file fails
              return Promise.resolve();
            })
          )
        );
      })
  );
  self.skipWaiting();
});

const isCacheableResponse = (response) =>
  response && response.status === 200 && response.type === 'basic';

// Network first, falling back to cache when offline.
// Used for the HTML shell so a new deploy is picked up on the next load.
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (isCacheableResponse(response)) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request) ||
      (request.mode === 'navigate' ? await cache.match(`${BASE_PATH}index.html`) : null);
    if (cached) return cached;
    throw error;
  }
}

// Cache first. Used for content-hashed build assets, which never change.
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (isCacheableResponse(response)) {
    cache.put(request, response.clone());
  }
  return response;
}

// Serve from cache immediately and refresh the cache in the background.
// The refresh is a conditional request (ETag / Last-Modified), so an unchanged
// file (routes.min.json is ~86 MB) costs a 304 instead of a full download.
async function staleWhileRevalidate(event) {
  const { request } = event;
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const revalidate = (async () => {
    const headers = new Headers();
    const etag = cached?.headers.get('ETag');
    const lastModified = cached?.headers.get('Last-Modified');
    if (etag) headers.set('If-None-Match', etag);
    if (lastModified) headers.set('If-Modified-Since', lastModified);

    const response = await fetch(request.url, { headers, cache: 'no-store' });
    if (isCacheableResponse(response)) {
      await cache.put(request, response.clone());
    }
    return response;
  })();

  if (cached) {
    event.waitUntil(revalidate.catch(err => console.warn('Background refresh failed:', request.url, err)));
    return cached;
  }
  return revalidate;
}

// Fetch event - pick a caching strategy per request type
self.addEventListener('fetch', (event) => {
  // Skip caching for:
  // - API requests (always fetch fresh data)
  // - POST requests (can't be cached)
  // - Chrome extension requests
  if (event.request.method !== 'GET' ||
      event.request.url.startsWith('chrome-extension://') ||
      event.request.url.includes('digitransit.fi') ||
      event.request.url.includes('openstreetmap.org') ||
      event.request.url.includes('nominatim.openstreetmap.org')) {
    return; // Let it go through to network
  }

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return; // Let cross-origin requests go through to network
  }

  const path = url.pathname;

  if (event.request.mode === 'navigate' || path === BASE_PATH || path.endsWith('/index.html')) {
    event.respondWith(networkFirst(event.request));
  } else if (path.startsWith(`${BASE_PATH}assets/`)) {
    event.respondWith(cacheFirst(event.request));
  } else {
    // Data files (stops.json, routes.min.json), icons, manifest
    event.respondWith(staleWhileRevalidate(event));
  }
});

// Activate event - clean up old caches and tell open pages an update is ready
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      const deletedOldCache = cacheNames.some(name => name !== CACHE_NAME);

      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      ).then(() => {
        // If this replaced an older version, let open pages reload when convenient
        if (deletedOldCache) {
          return self.clients.matchAll().then((clients) => {
            clients.forEach(client => {
              console.log('Sending update message to client');
              client.postMessage({
                type: 'UPDATE_READY',
                version: CACHE_VERSION
              });
            });
          });
        }
      });
    })
  );
  self.clients.claim();
});
