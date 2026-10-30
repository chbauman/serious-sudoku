// Service worker: makes the app installable and playable offline.
// Only used in the deployed layout (see .github/workflows/deploy.yml), where
// index.html, dist/ and assets/ are siblings of this file. c4e8210383 is
// replaced with the commit hash on deploy, so every release gets a new cache.
const CACHE = "sudoku-c4e8210383";

const PRECACHE = [
  "./",
  "index.html",
  "style.css",
  "manifest.webmanifest",
  "dist/main.js",
  "dist/html_util.js",
  "dist/sudoku.js",
  "dist/storage.js",
  "dist/settings.js",
  "dist/pages.js",
  "dist/history.js",
  "assets/favicon/favicon.svg",
  "assets/favicon/favicon.ico",
  "assets/favicon/favicon-16x16.png",
  "assets/favicon/favicon-32x32.png",
  "assets/favicon/apple-touch-icon.png",
  "assets/favicon/android-chrome-192x192.png",
  "assets/favicon/android-chrome-512x512.png",
  ...Array.from({ length: 7 }, (_, i) => `assets/data/ext_lvl_${i}.txt`),
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Cache first; everything else from the same origin is fetched from the
// network. Range requests bypass the cache.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  if (new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req))
  );
});
