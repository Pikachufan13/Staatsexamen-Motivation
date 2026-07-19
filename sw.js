/* Service Worker für die Henry-App (PWA).
 * Ziel: Nach dem ersten Online-Öffnen läuft die App auch offline.
 * Strategie: App-Dateien beim Installieren cachen (cache-first),
 * Schriften von Google werden zur Laufzeit mitgecacht. */
const CACHE = 'henry-app-v1';

// Relative Pfade, damit es auch in einem GitHub-Pages-Unterordner funktioniert.
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './ui.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // einzeln hinzufügen, damit ein fehlendes Icon die Installation nicht abbricht
      Promise.all(SHELL.map((url) => cache.add(url).catch(() => null)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isFont = url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com');

  // Navigationsanfragen: Netzwerk zuerst, bei Offline auf gecachte Startseite zurückfallen.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // App-Dateien & Schriften: erst Cache, sonst Netzwerk (und Ergebnis mitcachen).
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if ((url.origin === self.location.origin || isFont) && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
    })
  );
});
