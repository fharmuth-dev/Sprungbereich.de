// ==========================================
// SPRUNGBEREICH.DE — SERVICE WORKER  (v5)
// ==========================================
// Strategie:
//  - Navigationen (Seitenaufrufe)  -> Network-First mit Offline-Fallback auf
//    den gecachten App-Shell. Verhindert "Webseite nicht erreichbar" auch bei
//    geteilten Links wie /?spot=123 und bei wackeligem Mobilfunk.
//  - Eigene Assets (CSS/JS/Icons)  -> Stale-While-Revalidate.
//  - Kartenkacheln                 -> eigener, GEDECKELTER Cache (verhindert,
//    dass der Speicher volläuft und iOS den kompletten Cache löscht).
//  - Turnstile / API / Supabase    -> NIE anfassen (Captcha + Live-Daten).
// ==========================================

const CACHE_VERSION = 'v6';
const SHELL_CACHE = `sprungbereich-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `sprungbereich-assets-${CACHE_VERSION}`;
const TILE_CACHE  = `sprungbereich-tiles-${CACHE_VERSION}`;

const MAX_TILES = 300; // Deckel: ca. 5-10 MB statt unbegrenzt

// App-Shell: wird beim Installieren fest vorgeladen.
// './' ist wichtig, damit auch der Aufruf der nackten Domain offline klappt.
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './map.js',
  './manifest.json',
  './images/icon-192.png',
  './images/icon-512.png',
  './images/icon-192-maskable.png',
  './images/icon-512-maskable.png',
  './images/favicon.png'
];

// Diese Hosts/Pfade dürfen NIEMALS vom Service Worker abgefangen werden.
function isBypassed(url) {
  return (
    url.hostname === 'challenges.cloudflare.com' ||   // Turnstile-Captcha
    url.hostname.endsWith('supabase.co') ||           // Live-Spotdaten
    url.pathname.startsWith('/api/') ||               // eigene Pages Functions
    url.hostname === 'nominatim.openstreetmap.org'    // Ortssuche
  );
}

function isTile(url) {
  return url.hostname === 'server.arcgisonline.com';
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      // addAll bricht komplett ab, wenn EINE Datei fehlt -> einzeln absichern
      .then(cache => Promise.allSettled(APP_SHELL.map(u => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  const keep = [SHELL_CACHE, ASSET_CACHE, TILE_CACHE];
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !keep.includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Ältere Kachel-Einträge wegwerfen, wenn der Deckel überschritten wird
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await Promise.all(keys.slice(0, keys.length - maxEntries).map(k => cache.delete(k)));
  }
}

self.addEventListener('fetch', (e) => {
  const request = e.request;

  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch { return; }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (isBypassed(url)) return;

  // --- 1. Navigationen: Network-First, Fallback auf App-Shell ---
  if (request.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(SHELL_CACHE);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match('./index.html')) ||
               (await cache.match('./')) ||
               new Response(
                 '<!doctype html><meta charset="utf-8"><body style="background:#0f172a;color:#fff;font-family:sans-serif;padding:2rem;text-align:center"><h2>Offline</h2><p>Sprungbereich.de ist gerade nicht erreichbar. Bitte pr&uuml;fe deine Verbindung.</p></body>',
                 { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
               );
      }
    })());
    return;
  }

  // --- 2. Kartenkacheln: Cache-First mit Deckel ---
  if (isTile(url)) {
    e.respondWith((async () => {
      const cache = await caches.open(TILE_CACHE);
      const hit = await cache.match(request);
      if (hit) return hit;
      try {
        const res = await fetch(request);
        if (res && res.ok) {
          cache.put(request, res.clone());
          trimCache(TILE_CACHE, MAX_TILES);
        }
        return res;
      } catch {
        return Response.error();
      }
    })());
    return;
  }

  // --- 3a. Eigener App-Code (JS/CSS): NETWORK-FIRST ---
  // Vorher wurde zuerst der Cache ausgeliefert. Folge: Nach einem Deploy sah
  // der Nutzer weiterhin die alte Version – Änderungen kamen erst beim
  // übernächsten Aufruf an. Jetzt zählt immer die frische Datei, der Cache
  // dient nur noch als Offline-Reserve.
  const isOwnCode = url.origin === self.location.origin &&
                    /\.(js|css)$/.test(url.pathname);

  if (isOwnCode) {
    e.respondWith((async () => {
      const cache = await caches.open(ASSET_CACHE);
      try {
        const fresh = await fetch(request, { cache: 'no-cache' });
        if (fresh && fresh.ok) cache.put(request, fresh.clone());
        return fresh;
      } catch {
        return (await cache.match(request)) || Response.error();
      }
    })());
    return;
  }

  // --- 3b. Übrige Assets (Fonts, Bibliotheken, Bilder): Stale-While-Revalidate ---
  e.respondWith((async () => {
    const cache = await caches.open(ASSET_CACHE);
    const cached = await cache.match(request);

    const network = fetch(request).then(res => {
      // Nur brauchbare, gleichartige Antworten cachen (keine opaken Fehler)
      if (res && res.ok && (res.type === 'basic' || res.type === 'cors')) {
        cache.put(request, res.clone());
      }
      return res;
    }).catch(() => null);

    // Wichtig: niemals undefined an respondWith zurückgeben
    return cached || (await network) || Response.error();
  })());
});
