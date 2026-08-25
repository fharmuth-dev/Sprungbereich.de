const CACHE_NAME = 'sprungbereich-v1';
const ASSETS_TO_CACHE = [
  'index.html',
  'eintragen.html',
  'style.css',
  'app.js',
  'map.js',
  'pools.json',
  'manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS_TO_CACHE)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
