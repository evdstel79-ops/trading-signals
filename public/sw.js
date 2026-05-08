// Trading Signals service worker.
// Strategy:
//  - On install: pre-cache the app shell so first navigation works offline.
//  - On fetch (navigations): cache-first, fall back to network, fall back to
//    the cached "/" shell when offline.
//  - On fetch (/api/*): network-first with a cache fallback for the last
//    successful response.
//  - Other GETs: stale-while-revalidate against a runtime cache.

const SHELL_CACHE = "ts-shell-v1";
const RUNTIME_CACHE = "ts-runtime-v1";
const API_CACHE = "ts-api-v1";

const SHELL_URLS = ["/", "/signals", "/correlations"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const allowed = new Set([SHELL_CACHE, RUNTIME_CACHE, API_CACHE]);
      await Promise.all(
        keys
          .filter((k) => !allowed.has(k))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip cross-origin requests entirely; let the network handle them.
  if (url.origin !== self.location.origin) return;

  // Don't try to cache the Next dev/HMR endpoints.
  if (url.pathname.startsWith("/_next/webpack-hmr")) return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(navigationHandler(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
});

async function navigationHandler(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    // Refresh in the background.
    fetchAndUpdate(cache, request).catch(() => {});
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const fallback = await cache.match("/");
    if (fallback) return fallback;
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached ?? networkPromise;
}

async function fetchAndUpdate(cache, request) {
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
}
