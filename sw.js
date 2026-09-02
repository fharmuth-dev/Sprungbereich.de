// ==========================================
// SPRUNGBEREICH.DE — SERVICE WORKER
// Cached den App-Shell (HTML/CSS/JS/Icons) fest vor und lädt alles
// andere (Leaflet, Google Fonts, Supabase-JS, Kartenkacheln) beim
// ersten Kontakt automatisch mit ins Cache, damit die App auch bei
// erneuten (auch offline) Besuchen sofort startet.
// ==========================================

const CACHE_VERSION = 'v4';
const CACHE_NAME = `sprungbereich-${CACHE_VERSION}`;

// App-Shell: wird beim Installieren des Service Workers fest vorgeladen
const APP_SHELL = [
  'index.html',
  'style.css',
  'app.js',
  'map.js',
  'manifest.json',
  'images/icon-192.png',
  'images/icon-512.png',
  'images/icon-192-maskable.png',
  'images/icon-512-maskable.png',
  'images/favicon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Alte Cache-Versionen beim Aktivieren aufräumen, damit Nutzer nach
// einem Update nicht dauerhaft auf veralteten Dateien hängen bleiben.
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const request = e.request;

  // Nur GET-Requests cachen (POST/PUT z. B. an Supabase unangetastet lassen)
  if (request.method !== 'GET') return;

  // Live-Daten (Supabase REST/Auth-Aufrufe) immer frisch aus dem Netz holen,
  // niemals veraltete Spot-Daten aus dem Cache servieren
  if (request.url.includes('supabase.co/rest') || request.url.includes('supabase.co/auth')) {
    return;
  }

  e.respondWith(
    caches.match(request).then(cached => {
      // Cache-First für bekannte Assets, im Hintergrund aber aktualisieren
      // (stale-while-revalidate), damit spätere Updates automatisch ankommen
      const networkFetch = fetch(request)
        .then(response => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
