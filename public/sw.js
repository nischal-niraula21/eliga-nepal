const CACHE_NAME = "eleague-static-v4.6";

const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/eliga-logo.png",
  "/favicon-64.png",
  "/apple-touch-icon.png",
  "/pwa-192.png",
  "/pwa-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(
        STATIC_ASSETS.map((url) => new Request(url, { cache: "reload" }))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME &&
            (key.startsWith("eleague-static-") || key.startsWith("eliga-static-")))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function loadStaticAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    // Revalidate with the website so a replaced logo is visible without
    // renaming the image or changing the service worker on every update.
    const response = await fetch(request, { cache: "no-cache" });
    if (response.ok) {
      // A full/unavailable cache must not hide a successful network response.
      await cache.put(request, response.clone()).catch(() => {});
      return response;
    }
    return (await cache.match(request)) || response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.mode === "navigate") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Only PWA images and the manifest are cached; API responses and app bundles
  // remain under their existing browser/network behavior.
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(loadStaticAsset(request));
  }
});
