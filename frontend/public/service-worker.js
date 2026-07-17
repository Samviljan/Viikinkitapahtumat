/**
 * Viikinkitapahtumat — Service Worker
 *
 * Strategy:
 *   - App shell (HTML/CSS/JS/fonts/images): stale-while-revalidate. On the
 *     very first load we cache the essentials so subsequent visits work
 *     offline instantly.
 *   - API list endpoints (/api/events, /api/articles): stale-while-revalidate
 *     with a hard 24 h max-age. This lets users browse recent events/articles
 *     even without a network connection.
 *   - API detail endpoints (/api/events/{id}, /api/articles/{slug}):
 *     network-first with cache fallback. Users always get fresh data when
 *     online, but a cached copy is served when offline.
 *   - All other /api/* requests: bypass cache entirely (auth, POST/PATCH,
 *     RSVP, uploads, admin operations).
 *
 * Bump `CACHE_VERSION` whenever you change caching behaviour or invalidate
 * older client caches — the `activate` handler deletes all non-matching
 * caches so obsolete data can't linger on devices.
 */

const CACHE_VERSION = "viikinki-v3";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const API_CACHE = `${CACHE_VERSION}-api`;
const IMG_CACHE = `${CACHE_VERSION}-img`;

// Files that make up the app shell — precached on install.
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/pwa-icons/icon-192.png",
  "/pwa-icons/icon-512.png",
  "/pwa-icons/apple-touch-icon.png",
];

// Endpoints where a slightly-stale response is OK. Frontend fetches these
// as list views; the detail endpoints are handled separately below.
const CACHEABLE_LIST_PATHS = [
  /^\/api\/events\/?(\?.*)?$/,
  /^\/api\/articles\/?(\?.*)?$/,
];

// Detail endpoints — network-first, cached fallback for offline.
const CACHEABLE_DETAIL_PATHS = [
  /^\/api\/events\/[^/]+$/,
  /^\/api\/articles\/[^/]+$/,
];

// Article/event image endpoints — cache aggressively (immutable filenames).
const IMAGE_PATHS = [
  /^\/api\/uploads\/article-images\//,
  /^\/api\/uploads\/default-images\//,
  /^\/api\/og\/events\//,
  /^\/event-images\//,
  /^\/pwa-icons\//,
];

const API_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// --- install: pre-cache the shell ---------------------------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch(() => null) // best-effort — never block install
  );
  self.skipWaiting();
});

// --- activate: purge any caches from older SW versions ------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// --- helpers ------------------------------------------------------------
function matchesAny(pathname, patterns) {
  return patterns.some((rx) => rx.test(pathname));
}

async function cachePutWithMeta(cacheName, request, response) {
  // Attach a timestamp header on cache write so we can implement expiration
  // on read. `Response` headers are immutable, so we rebuild the response.
  const cache = await caches.open(cacheName);
  const cloned = response.clone();
  const body = await cloned.blob();
  const headers = new Headers(cloned.headers);
  headers.set("x-sw-cached-at", String(Date.now()));
  const wrapped = new Response(body, {
    status: cloned.status,
    statusText: cloned.statusText,
    headers,
  });
  await cache.put(request, wrapped);
}

function isStale(cachedResponse, maxAgeMs) {
  const at = Number(cachedResponse.headers.get("x-sw-cached-at") || 0);
  return !at || Date.now() - at > maxAgeMs;
}

// --- fetch --------------------------------------------------------------
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Only same-origin requests get any special treatment.
  if (url.origin !== self.location.origin) return;

  // ---- API endpoints ---------------------------------------------------
  if (url.pathname.startsWith("/api/")) {
    // 1. List endpoints — stale-while-revalidate with 24 h max-age.
    if (matchesAny(url.pathname, CACHEABLE_LIST_PATHS)) {
      event.respondWith(handleListRequest(request));
      return;
    }
    // 2. Detail endpoints — network-first, cache fallback.
    if (matchesAny(url.pathname, CACHEABLE_DETAIL_PATHS)) {
      event.respondWith(handleDetailRequest(request));
      return;
    }
    // 3. Uploaded/generated images — cache-first (immutable).
    if (matchesAny(url.pathname, IMAGE_PATHS)) {
      event.respondWith(handleImageRequest(request));
      return;
    }
    // 4. Everything else under /api — do NOT cache (auth, RSVP, admin, ...).
    return;
  }

  // ---- Same-origin images (event-images/, pwa-icons/) ------------------
  if (matchesAny(url.pathname, IMAGE_PATHS)) {
    event.respondWith(handleImageRequest(request));
    return;
  }

  // ---- App shell (HTML/CSS/JS/fonts) -----------------------------------
  event.respondWith(handleShellRequest(request));
});

// ---- Handler implementations -------------------------------------------

async function handleListRequest(request) {
  // Stale-while-revalidate. Serve cache immediately if present (even if
  // stale), then update from the network in the background.
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cachePutWithMeta(API_CACHE, request, response.clone()).catch(() => null);
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    // Kick off network refresh in the background but return cache immediately.
    // If the cache is very stale we still return it (better than nothing when
    // offline); the SW will refresh silently.
    networkFetch.catch(() => null);
    if (isStale(cached, API_CACHE_MAX_AGE_MS)) {
      // Try to await a fresh response briefly — but never block > 3 s so
      // the UI stays responsive on slow networks.
      try {
        const fresh = await Promise.race([
          networkFetch,
          new Promise((resolve) => setTimeout(() => resolve(null), 3000)),
        ]);
        if (fresh && fresh.ok) return fresh;
      } catch {
        // fall through to cached
      }
    }
    return cached;
  }

  // No cache — must go to network. If offline, return an empty JSON array
  // so the frontend renders "no items" gracefully instead of crashing.
  const fresh = await networkFetch;
  if (fresh) return fresh;
  return new Response("[]", {
    status: 200,
    headers: { "Content-Type": "application/json", "x-sw-offline": "1" },
  });
}

async function handleDetailRequest(request) {
  // Network-first. On failure, fall back to cache.
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      cachePutWithMeta(API_CACHE, request, fresh.clone()).catch(() => null);
    }
    return fresh;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // No cache and offline — return a JSON error the frontend can detect.
    return new Response(
      JSON.stringify({ detail: "Offline and no cached copy available" }),
      {
        status: 503,
        headers: { "Content-Type": "application/json", "x-sw-offline": "1" },
      }
    );
  }
}

async function handleImageRequest(request) {
  // Cache-first. Filenames on the backend are UUID-prefixed → immutable.
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      const cache = await caches.open(IMG_CACHE);
      cache.put(request, fresh.clone()).catch(() => null);
    }
    return fresh;
  } catch {
    return new Response("", { status: 504 });
  }
}

async function handleShellRequest(request) {
  const url = new URL(request.url);
  // For navigation requests (HTML), always try network first so we don't
  // ship a stale SPA build. Fall back to cached index.html when offline.
  if (
    request.mode === "navigate" ||
    (request.headers.get("accept") || "").includes("text/html")
  ) {
    try {
      const fresh = await fetch(request);
      if (fresh && fresh.ok) {
        const cache = await caches.open(SHELL_CACHE);
        cache.put("/index.html", fresh.clone()).catch(() => null);
      }
      return fresh;
    } catch {
      const cached =
        (await caches.match("/index.html")) || (await caches.match("/"));
      if (cached) return cached;
      return new Response(
        "<h1>Offline</h1><p>Ei yhteyttä ja välimuistissa ei ole sivua.</p>",
        {
          status: 503,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }
  }

  // Static assets: stale-while-revalidate.
  const cached = await caches.match(request);
  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.ok && response.type === "basic") {
        caches
          .open(SHELL_CACHE)
          .then((cache) => cache.put(request, response.clone()))
          .catch(() => null);
      }
      return response;
    })
    .catch(() => cached);
  return cached || networkFetch;
}

// --- Message channel: allow the page to trigger an immediate skipWaiting.
// The install-prompt component uses this to activate a newer SW as soon as
// the user clicks "Update available".
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
