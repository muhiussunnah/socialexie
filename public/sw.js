/*
 * Socialexie service worker.
 *
 * Bump CACHE_VERSION on any change to this file: the activate handler deletes
 * every cache that does not carry the current version, which is the only thing
 * that stops a stale shell from outliving a deploy.
 */

const CACHE_VERSION = "v1";
const PRECACHE = `socialexie-shell-${CACHE_VERSION}`;
const RUNTIME = `socialexie-runtime-${CACHE_VERSION}`;
const CURRENT_CACHES = [PRECACHE, RUNTIME];

const OFFLINE_URL = "/offline";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icons/icon.svg",
  "/icons/icon-maskable.svg",
];

/** Runtime cache ceiling, so a long session cannot grow the cache without end. */
const RUNTIME_MAX_ENTRIES = 120;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      // Individual puts rather than addAll: one missing asset must not abort
      // the whole install and leave the app with no offline page at all.
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: "reload" }));
          } catch {
            /* Optional asset — the shell still works without it. */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("socialexie-"))
          .filter((key) => !CURRENT_CACHES.includes(key))
          .map((key) => caches.delete(key)),
      );

      // Lets the network-first navigation handler start its request while the
      // worker is still booting.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }

      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

/**
 * Anything authenticated, mutating or API-shaped must never touch a cache —
 * one user's response reaching another session is worse than being offline.
 */
function isCacheable(request) {
  if (request.method !== "GET") return false;
  if (request.headers.has("authorization")) return false;
  if (request.headers.has("range")) return false;
  if (request.cache === "no-store") return false;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  if (url.pathname.startsWith("/auth/")) return false;
  if (url.searchParams.has("_rsc")) return false;

  return true;
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/favicon.svg"
  );
}

function isImage(request, url) {
  return (
    request.destination === "image" ||
    /\.(?:avif|webp|png|jpe?g|gif|svg|ico)$/i.test(url.pathname)
  );
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  // Cache keys are insertion-ordered, so the head is the oldest.
  await Promise.all(
    keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)),
  );
}

/** Network first, falling back to the last good copy and then to /offline. */
async function handleNavigation(event) {
  const cache = await caches.open(RUNTIME);

  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) {
      if (preloaded.ok) cache.put(event.request, preloaded.clone());
      return preloaded;
    }

    const response = await fetch(event.request);
    if (response.ok) {
      cache.put(event.request, response.clone());
      trimCache(RUNTIME, RUNTIME_MAX_ENTRIES);
    }
    return response;
  } catch {
    const cached = await cache.match(event.request);
    if (cached) return cached;

    const offline = await caches.match(OFFLINE_URL, { cacheName: PRECACHE });
    if (offline) return offline;

    return new Response("You are offline.", {
      status: 503,
      statusText: "Offline",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

/** Serve immediately, refresh in the background for the next visit. */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
        if (cacheName === RUNTIME) trimCache(RUNTIME, RUNTIME_MAX_ENTRIES);
      }
      return response;
    })
    .catch(() => undefined);

  if (cached) return cached;

  const response = await network;
  if (response) return response;

  return new Response("", { status: 504, statusText: "Offline" });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.mode === "navigate") {
    // A navigation straight to an API route (a download, an OAuth callback)
    // must reach the network untouched.
    if (isCacheable(request)) event.respondWith(handleNavigation(event));
    return;
  }

  if (!isCacheable(request)) return;

  const url = new URL(request.url);

  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request, PRECACHE));
    return;
  }

  if (isImage(request, url)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME));
  }
});
