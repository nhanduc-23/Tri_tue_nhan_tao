const CACHE_NAME = "waste-static-v1";
const STATIC_PATHS = new Set([
  "/",
  "/index.html",
  "/app.js",
  "/style.css",
  "/manifest.json",
  "/offline.html",
]);

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const assets = ["./", "./index.html", "./app.js", "./manifest.json", "./offline.html", "./style.css",
      "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-512-maskable.png"];
    await Promise.all(assets.map(async (asset) => {
      try {
        const response = await fetch(asset, { cache: "no-cache" });
        if (response.ok) await cache.put(asset, response);
      } catch (_error) {
        // Optional assets (such as generated icons or style.css) may not exist yet.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith("waste-static-") && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // API traffic must always reach FastAPI and is never read from or written to cache.
  if (url.pathname === "/detect" || url.pathname.startsWith("/detect/")
      || url.pathname === "/health" || url.pathname.startsWith("/health/")) {
    event.respondWith(fetch(request));
    return;
  }

  const isIcon = url.pathname.startsWith("/icons/");
  const isStatic = STATIC_PATHS.has(url.pathname) || isIcon;
  if (!isStatic) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && (response.type === "basic" || response.type === "default")) {
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      if (request.mode === "navigate") {
        return (await cache.match("./offline.html")) || new Response(
          "Cần kết nối tới máy chủ để nhận diện rác",
          { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
        );
      }
      throw error;
    }
  })());
});
