/**
 * ============================================================================
 * ACCESSYOURDISTRICT - PWA SERVICE WORKER (OFFLINE FIELD RESILIENCE)
 * Congressional App Challenge - Civic Inclusion Platform
 * ============================================================================
 *
 * FULL-STACK ARCHITECTURE & OFFLINE CACHING EXPLANATION:
 * ------------------------------------------------------
 * 1. Offline App Shell Precaching (`install` event):
 *    - Automatically caches all core HTML, CSS, vector icons, JavaScript
 *      modules, and external Leaflet.js CDN libraries (`leaflet.css`,
 *      `leaflet.js`) into `ayd-pwa-cache-v1`.
 *    - Enables constituents and field workers to launch the application
 *      instantly even in areas with zero cellular service.
 *
 * 2. Intelligent Map Tile Caching (`fetch` event):
 *    - Intercepts OpenStreetMap tile requests (`tile.openstreetmap.org`) and
 *      employs a Stale-While-Revalidate / Cache-First caching strategy using
 *      the `ayd-map-tiles-v1` cache.
 *    - When a user views their neighborhood map online, the tiles are stored.
 *      If they later travel into a dead zone or subway to report an obstacle,
 *      the interactive Leaflet map continues rendering from cache!
 * ============================================================================
 */

const CACHE_NAME = "ayd-pwa-cache-v1";
const TILE_CACHE_NAME = "ayd-map-tiles-v1";

// Static Application Shell & CDN libraries to precache on install
const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
  "./js/district-config.js",
  "./js/firebase-config.js",
  "./js/map-controller.js",
  "./js/report-service.js",
  "./js/security-utils.js",
  "./js/ui-controller.js",
  "./assets/icons/favicon.svg",
  "./assets/icons/logo.svg",
  "./manifest.json",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
];

// 1. INSTALL EVENT: Precache application shell & Leaflet library
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("✅ [ServiceWorker] Pre-caching application shell & Leaflet library...");
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.error("❌ [ServiceWorker] Pre-cache error:", err);
      })
  );
});

// 2. ACTIVATE EVENT: Clean up outdated caches and claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== TILE_CACHE_NAME) {
              console.log("🧹 [ServiceWorker] Purging legacy cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// 3. FETCH EVENT: Intelligent Caching Routing (Map Tiles vs App Shell)
self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  // A. MAP TILES ROUTE (`tile.openstreetmap.org`): Stale-While-Revalidate / Cache-First
  if (requestUrl.hostname.includes("tile.openstreetmap.org")) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          // If cached tile exists, return it immediately for instant rendering
          const fetchPromise = fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(event.request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => cachedResponse);

          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // B. EXTERNAL CDNS (`unpkg.com`, `gstatic.com`): Cache-First with Network Fallback
  if (requestUrl.hostname.includes("unpkg.com") || requestUrl.hostname.includes("gstatic.com")) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // C. APP SHELL & LOCAL ASSETS: Network-First with Cache Fallback for Offline Field Use
  if (event.request.method === "GET") {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If offline and request is HTML navigation, fallback to index.html
            if (event.request.headers.get("accept")?.includes("text/html")) {
              return caches.match("./index.html");
            }
          });
        })
    );
  }
});
