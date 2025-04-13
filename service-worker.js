const CACHE_NAME = 'm3u-player-v1';
const urlsToCache = [
  'player.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'static-tv.gif',
  'https://cdn.jsdelivr.net/npm/hls.js@latest'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});