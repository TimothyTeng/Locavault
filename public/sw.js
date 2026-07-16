// Minimal service worker — enough for installability + a fast, resilient shell.
// Deliberately conservative for an SSR app: navigations are network-first (so
// loader data / auth are never served stale), only static build assets are
// cached.
//
// Offline WRITES are handled one layer up, in the page: `~/utils/useOutbox`
// queues the two in-scope mutations ("we're out" taps + quick-adds) in IndexedDB
// and replays them on reconnect. That lives in the app rather than here because
// the queue is per-signed-in-user, and this cache is shared across everyone who
// uses the browser — which is also why authenticated loader responses are never
// cached for offline reads.
const CACHE = "locavault-v1";
const SHELL = ["/", "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin (Clerk, APIs)

  // HTML navigations: network-first, fall back to the cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/").then((r) => r || Response.error()),
      ),
    );
    return;
  }

  // Immutable build assets: cache-first, then network (and cache the result).
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches
              .open(CACHE)
              .then((c) => c.put(request, copy))
              .catch(() => {});
            return res;
          }),
      ),
    );
  }
});
