// Pace Service Worker - Offline Support
// Network first: online you always get the latest deployed version, offline the last cached copy.
// (This used to be cache-first with no refresh, so once installed, updates never reached the user.)
const CACHE_NAME = 'pace-v2';
const urlsToCache = [
  './',
  './index.html'
];

// Install event - cache files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Fetch event - network first, fall back to cache when offline
self.addEventListener('fetch', event => {
  const request = event.request;
  // Only same-origin GETs; the AI proxy (POST, other origin) and fonts go straight to the network
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then(cached =>
        cached || (request.mode === 'navigate' ? caches.match('./index.html') : undefined)
      ))
  );
});

// Activate event - cleanup old caches, take over open tabs right away
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});
