// Service worker: lets the game start offline once it has been opened.
// Built by the offline plugin in vite.config.ts, which fills in the build's
// file list and version; edit this template, not dist/sw.js.
//
// The page itself is fetched network-first and bypasses the HTTP cache, so
// online players always get the newest build. Everything else comes from this
// build's own cache, which the next deploy replaces.
const VERSION = '__BUILD_VERSION__';
const PRECACHE = __PRECACHE_FILES__;
const CACHE = `sweet-scoops-${VERSION}`;
const PAGE = new URL('./', self.registration.scope).href;

self.addEventListener('install', (event) => {
  const requests = PRECACHE.map((file) => new Request(new URL(file, self.registration.scope), { cache: 'reload' }));
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(requests))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  const stale = (key) => key.startsWith('sweet-scoops-') && key !== CACHE;
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter(stale).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return;
  event.respondWith(request.mode === 'navigate' ? pageFirstFromNetwork(request) : fileFromCache(request));
});

async function pageFirstFromNetwork(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request, { cache: 'no-cache' });
    if (response.ok) await cache.put(PAGE, response.clone());
    return response;
  } catch {
    return (await cache.match(PAGE)) ?? Response.error();
  }
}

async function fileFromCache(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  return cached ?? fetch(request);
}
