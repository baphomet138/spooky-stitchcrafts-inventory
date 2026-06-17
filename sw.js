/* Service worker for the Inventory Scanner PWA.
 * Strategy:
 *  - scanner.html + sku-map.json  -> NETWORK-FIRST (fresh pushes win; cache only as offline fallback)
 *  - icons + manifest (static)    -> CACHE-FIRST (fast, rarely change)
 *  - everything cross-origin / non-GET (Apps Script POSTs) -> NOT intercepted at all,
 *    so the offline submit queue keeps working exactly as before.
 * Bump CACHE when the shell asset list changes; old caches are purged on activate.
 */
const CACHE = 'inv-scanner-v1';
const FRESH = ['scanner.html', 'sku-map.json'];   // always try network first
const SHELL = [
  './', 'scanner.html', 'sku-map.json', 'manifest.webmanifest',
  'icon-192.png', 'icon-512.png', 'icon-180.png', 'icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // POSTs (sheet logging) pass straight through
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // never touch script.google.com / cdn

  const name = url.pathname.split('/').pop();
  const networkFirst = req.mode === 'navigate' || FRESH.includes(name);

  if (networkFirst) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const c = await caches.open(CACHE);
        c.put(req, res.clone());                          // refresh the offline copy
        return res;
      } catch (_) {
        const cached = await caches.match(req);
        return cached || caches.match('scanner.html');    // offline fallback
      }
    })());
  } else {
    e.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        const c = await caches.open(CACHE);
        c.put(req, res.clone());
        return res;
      } catch (_) { return cached; }
    })());
  }
});
