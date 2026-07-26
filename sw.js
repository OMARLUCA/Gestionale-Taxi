/* Gestionale Taxi — Service Worker
   Alza il numero di versione quando cambi index.html o gli asset,
   così il vecchio cache viene ripulito e i client prendono la nuova versione. */
const VERSION = 'taxi31-v5';
const SHELL_CACHE = 'shell-' + VERSION;
const RUNTIME_CACHE = 'runtime-' + VERSION;

// File "guscio" dell'app, precaricati all'installazione: bastano per aprirla offline.
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                 // POST/PUT ecc. → rete diretta

  const url = new URL(req.url);

  // Supabase (auth + database): SEMPRE rete, mai cache. Offline fallisce e l'app
  // continua coi dati locali, com'è già progettata.
  if (url.hostname.endsWith('.supabase.co')) return;

  // Navigazioni (apertura pagina): rete, con fallback all'index in cache se offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Tutto il resto (asset locali + librerie CDN): cache-first, con aggiornamento in rete.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetching = fetch(req).then((res) => {
        if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fetching;
    })
  );
});
