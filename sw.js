const CACHE_NAME = 'sprungbereich-v2';
const ASSETS_TO_CACHE = [
  'index.html',
  'style.css',
  'app.js',
  'map.js',
  'manifest.json',
  'images/icon-192.png',
  'images/icon-512.png',
  'images/favicon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Alte Caches beim Aktivieren aufräumen, damit Nutzer nach einem Update
// nicht dauerhaft auf veralteten Dateien hängen bleiben.
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Nur GET-Requests behandeln (POST/PUT an Supabase etc. unangetastet lassen)
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).catch(() => cached);
    })
  );
});
