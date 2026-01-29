/**
 * Service Worker for 9x12 Pro PWA
 * Provides offline support and caching
 * Version: 2025-12-11-v77
 */

// Update this version when you want to force a cache refresh
const CACHE_VERSION = 'v244';
const CACHE_NAME = `9x12-pro-${CACHE_VERSION}`;

// Core app files to cache on install
const urlsToCache = [
  '/app.html',
  '/app-main.js',
  '/index.html',
  '/login.html',
  '/auth-root.js',
  '/config.js',
  '/facing-slip.html',
  '/outreach-ipad.html'
];

// External CDN resources - cache with network-first strategy
const CDN_CACHE_NAME = `9x12-cdn-${CACHE_VERSION}`;
const CDN_RESOURCES = [
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// External resources that should never be cached (maps, API endpoints)
const NEVER_CACHE_RESOURCES = [
  'https://maps.googleapis.com/maps/api/js'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .catch((err) => {
        console.log('Service Worker: Cache failed', err);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activated');
  const currentCaches = [CACHE_NAME, CDN_CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!currentCaches.includes(cacheName)) {
            console.log('Service Worker: Clearing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip chrome extensions and non-http(s) requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // Never cache certain resources (always fetch fresh)
  const shouldNeverCache = NEVER_CACHE_RESOURCES.some(url => event.request.url.startsWith(url));
  if (shouldNeverCache) {
    event.respondWith(fetch(event.request));
    return;
  }

  // CDN resources - network-first with cache fallback (for offline)
  const isCDN = CDN_RESOURCES.some(url => event.request.url.startsWith(url));
  if (isCDN) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache the fresh CDN response
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CDN_CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed - try cache
          return caches.match(event.request);
        })
    );
    return;
  }

  // Skip API calls - always fetch fresh
  if (event.request.url.includes('/api/') ||
      event.request.url.includes('supabase.co') ||
      event.request.url.includes('maps.googleapis.com')) {
    event.respondWith(fetch(event.request));
    return;
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

          // Only cache GET requests to same origin
          if (event.request.url.startsWith(self.location.origin)) {
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
          }

          return response;
        }).catch(() => {
          // Network failed, check if we have a cached version
          return caches.match('/app.html');
        });
      })
  );
});

// Listen for messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
