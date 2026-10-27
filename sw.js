/* Bump on every app-shell release. Waiting workers activate after old tabs close. */
const SHELL = 'lolo-shell-v7';
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

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  const isAppPage =
    request.mode === "navigate" &&
    url.origin === self.location.origin &&
    url.pathname.startsWith(
      new URL(self.registration.scope).pathname
    );

  const isAppAsset =
    url.origin === self.location.origin &&
    /\.(js|css)$/.test(url.pathname);

  // NETWORK FIRST: HTML, JavaScript, CSS
  if (isAppPage || isAppAsset) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL);

      try {
        const response = await fetch(request);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        // Save the latest successful version.
        await cache.put(
          isAppPage ? INDEX : request,
          response.clone()
        );

        return response;

      } catch (error) {
        // No connection? Use the downloaded version.
        const cached = await cache.match(
          isAppPage ? INDEX : request
        );

        if (cached) return cached;

        throw error;
      }
    })());

    return;
  }

  // CACHE FIRST: Downloaded map tiles
  event.respondWith((async () => {
    const shell = await caches.open(SHELL);

    const asset = await shell.match(request);

    if (asset) return asset;

    if (
      /\/tiles\/(areas|area-labels|roads|trails|pois|trailheads|gates)\/\d+\/\d+\/\d+\.mvt$/
        .test(url.pathname)
    ) {
      const keys = await caches.keys();

      for (const key of keys.filter(
        key => key.startsWith(TILE_PREFIX)
      )) {
        const tileCache = await caches.open(key);
        const tile = await tileCache.match(request);

        if (tile) return tile;
      }
    }

    return fetch(request);
  })());
});