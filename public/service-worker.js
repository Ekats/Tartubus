const CACHE_VERSION = '1.2.3'; // Update this to force cache clear on all clients
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
            cache.add(url).catch(err => {
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

// Fetch event - serve from cache, fallback to network
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

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then((response) => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
  );
});

// Activate event - clean up old caches and force reload
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
        // If we deleted an old cache, clear localStorage and force reload all clients
        if (deletedOldCache) {
          return self.clients.matchAll().then((clients) => {
            clients.forEach(client => {
              console.log('Sending reload message to client');
              client.postMessage({
                type: 'FORCE_RELOAD',
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
