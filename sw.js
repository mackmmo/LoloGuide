/* Bump on every app-shell release. Waiting workers activate after old tabs close. */
const SHELL = 'lolo-shell-v6';
const TILE_PREFIX = 'lolo-map-';
const INDEX = new URL('index.html', self.registration.scope).href;
const MAPLIBRE = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';

self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(SHELL);
  const index = await fetch(INDEX, {cache: 'reload'});
  if (!index.ok) throw new Error('App shell download failed');
  const html = await index.clone().text();
  const assets = [...html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)].map(match => new URL(match[1], INDEX).href);
  await cache.addAll([...new Set([...assets, MAPLIBRE, MAPLIBRE_CSS])]);
  await cache.put(INDEX, index);
})()));

self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) {
    if (key.startsWith('lolo-shell-') && key !== SHELL) await caches.delete(key);
  }
  await self.clients.claim();
})()));

self.addEventListener('fetch', event => {
  const request = event.request;
  // Private API data and ALL writes remain in the application layer.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (request.mode === 'navigate' && url.origin === self.location.origin && url.pathname.startsWith(new URL(self.registration.scope).pathname)) {
    event.respondWith((async () => (await (await caches.open(SHELL)).match(INDEX)) || fetch(request))());
    return;
  }
  event.respondWith((async () => {
    const shell = await caches.open(SHELL);
    const asset = await shell.match(request);
    if (asset) return asset;
    // Only explicitly downloaded map packages are consulted; never generic API caches.
    if (/\/tiles\/(areas|area-labels|roads|trails|pois|trailheads|gates)\/\d+\/\d+\/\d+\.mvt$/.test(url.pathname)) {
      for (const key of (await caches.keys()).filter(key => key.startsWith(TILE_PREFIX))) {
        const tile = await (await caches.open(key)).match(request);
        if (tile) return tile;
      }
    }
    return fetch(request);
  })());
});
