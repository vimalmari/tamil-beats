// ── TAMIL BEATS SERVICE WORKER ──
// Caches all app files so it works offline

const CACHE_NAME   = 'tamilbeats-v1';
const RUNTIME_CACHE = 'tamilbeats-runtime-v1';

// Files to cache immediately on install (app shell)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  // Google Fonts (cached at runtime, fallback here)
];

// ── INSTALL: pre-cache all shell files ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Pre-caching app shell...');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())  // activate immediately
  );
});

// ── ACTIVATE: clean up old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ── FETCH: serve from cache, fallback to network ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET and chrome-extension requests
  if (event.request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // For Google Fonts — network first, cache fallback
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(cache =>
        fetch(event.request)
          .then(response => {
            cache.put(event.request, response.clone());
            return response;
          })
          .catch(() => caches.match(event.request))
      )
    );
    return;
  }

  // For MP3/audio files — network only (too large to cache)
  if (url.pathname.match(/\.(mp3|wav|ogg|flac|m4a)$/i)) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For everything else — cache first, network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Don't cache bad responses
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        // Cache a copy of the new response
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
        return response;
      }).catch(() => {
        // Offline fallback — return index.html for navigation requests
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// ── MESSAGE: force update ──
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
