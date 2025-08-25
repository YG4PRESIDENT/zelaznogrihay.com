// Service worker to ensure content is always fresh
const CACHE_VERSION = 'v1';
const CACHE_NAME = `zelaznogrihay-${CACHE_VERSION}`;

// Skip waiting forces the waiting service worker to become the active service worker
self.addEventListener('install', event => {
  self.skipWaiting();
});

// Clear old caches when a new service worker activates
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Network-first strategy for HTML and data files
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  // For HTML and data files, always go to network first
  if (url.pathname.endsWith('.html') || 
      url.pathname.endsWith('.json') || 
      url.pathname === '/' || 
      url.pathname.includes('/blog/')) {
    
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the latest version
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(event.request);
        })
    );
  }
});
