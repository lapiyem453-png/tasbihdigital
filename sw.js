const CACHE_NAME = 'tasbih-pwa-v1';
const RUNTIME_CACHE = 'tasbih-runtime-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/sw.js'
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  console.log('[Tasbih PWA] Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Tasbih PWA] Caching static assets');
        return cache.addAll(STATIC_ASSETS)
          .catch((error) => {
            console.warn('[Tasbih PWA] Failed to cache some assets:', error);
            // Continue even if some assets fail to cache
            return Promise.resolve();
          });
      })
      .catch((error) => {
        console.error('[Tasbih PWA] Cache opening failed:', error);
      })
  );
  
  // Skip waiting - activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Tasbih PWA] Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
              console.log('[Tasbih PWA] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[Tasbih PWA] Service Worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - cache first strategy with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip non-http(s) requests
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // Skip external domains (optional)
  if (url.origin !== location.origin) {
    // For external resources, use network first
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clonedResponse = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, clonedResponse);
            });
          }
          return response;
        })
        .catch(() => {
          // Return cached version if available
          return caches.match(request);
        })
    );
    return;
  }

  // For same-origin requests: Cache first, network fallback
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          console.log('[Tasbih PWA] Serving from cache:', request.url);
          return cachedResponse;
        }

        return fetch(request)
          .then((response) => {
            // Only cache successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const clonedResponse = response.clone();
            caches.open(RUNTIME_CACHE)
              .then((cache) => {
                cache.put(request, clonedResponse);
              })
              .catch((error) => {
                console.warn('[Tasbih PWA] Failed to cache response:', error);
              });

            return response;
          })
          .catch(() => {
            // Network request failed, try to serve from cache
            console.warn('[Tasbih PWA] Network request failed, trying cache fallback');
            return caches.match('/index.html')
              .then((cachedPage) => {
                if (cachedPage) return cachedPage;
                // Return offline page or generic response
                return new Response(
                  JSON.stringify({ error: 'Offline - No cached data available' }),
                  { status: 503, statusText: 'Service Unavailable', headers: { 'Content-Type': 'application/json' } }
                );
              });
          });
      })
      .catch((error) => {
        console.error('[Tasbih PWA] Cache match failed:', error);
        return new Response(
          JSON.stringify({ error: 'Service Worker error' }),
          { status: 500, statusText: 'Internal Server Error', headers: { 'Content-Type': 'application/json' } }
        );
      })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  console.log('[Tasbih PWA] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(RUNTIME_CACHE)
      .then(() => {
        event.ports[0].postMessage({ success: true, message: 'Cache cleared' });
      });
  }
});

// Background sync (optional - for future features)
self.addEventListener('sync', (event) => {
  console.log('[Tasbih PWA] Background sync event:', event.tag);
  
  if (event.tag === 'sync-tasbih-data') {
    event.waitUntil(
      // Implement sync logic here
      Promise.resolve()
    );
  }
});

console.log('[Tasbih PWA] Service Worker loaded successfully');
