// Service worker for the installed (home-screen) web app.
//
// Chrome will not offer "Install app" / "Add to home screen" as an app unless
// the site registers a service worker that can serve start_url while offline -
// a manifest alone only gets you a bookmark. That is the main job here; real
// offline data is out of scope, since every screen reads from Supabase.
//
// Registered from src/app/+html.tsx, production builds only.
//
// Bump CACHE_VERSION to force every client to drop its caches on next load.
const CACHE_VERSION = 'v1';
const PRECACHE = `zeeba-shell-${CACHE_VERSION}`;
const RUNTIME = `zeeba-assets-${CACHE_VERSION}`;

// The one HTML document kept on disk. It doubles as the offline response for
// any route: Expo Router decides what to render from window.location on the
// client, so the home document boots into whatever path the user opened.
const SHELL_URL = '/';

// Everything under these prefixes is content-hashed by Metro (or is a static
// icon), so a changed file always arrives under a new URL and the cached copy
// can never go stale. Matches the immutable Cache-Control rules in _headers.
const IMMUTABLE_PATHS = /^\/(?:_expo\/static|assets|icons)\//;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      // `cache: 'reload'` bypasses the HTTP cache so a fresh install never
      // precaches a stale document that the browser happened to be holding.
      await cache.add(new Request(SHELL_URL, { cache: 'reload' }));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== PRECACHE && key !== RUNTIME).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only GETs are cacheable, and a ranged request (media seeking) must reach
  // the network so the server can answer with the 206 the browser asked for.
  if (request.method !== 'GET' || request.headers.has('range')) return;

  const url = new URL(request.url);

  // Cross-origin is left completely alone - Supabase REST/auth/storage and
  // Google's OAuth endpoints must never be intercepted, let alone cached.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, url));
    return;
  }

  if (IMMUTABLE_PATHS.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }

  // Anything else (manifest.json, favicon, sw.js itself) falls through to the
  // browser's normal networking, governed by the headers Cloudflare sends.
});

// HTML is always fetched fresh when there is a network, which keeps the
// deploy-visibility guarantee that _headers sets up with must-revalidate.
// The cache is only a fallback for being offline.
async function networkFirst(request, url) {
  const cache = await caches.open(PRECACHE);
  try {
    const response = await fetch(request);
    // Only the shell is re-stored. Caching every visited /item/<uuid> would
    // grow without bound, and those documents are interchangeable anyway -
    // they all boot the same bundle.
    if (response.ok && url.pathname === SHELL_URL) {
      await cache.put(SHELL_URL, response.clone());
    }
    return response;
  } catch (error) {
    const cached = (await cache.match(request)) || (await cache.match(SHELL_URL));
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    // Not awaited: the response should start streaming to the page now, not
    // after the write finishes.
    cache.put(request, response.clone());
  }
  return response;
}
