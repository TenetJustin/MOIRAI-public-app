const APP_VERSION = "1.2.2";
const SHELL_CACHE = `moirai-shell-${APP_VERSION}`;
const MEDIA_CACHE = `moirai-media-${APP_VERSION}`;

const scopedUrl = (path = "./") => new URL(path.replace(/^\//, "./"), self.registration.scope).toString();

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    const essentials = ["./", "./manifest.json", "./version.json", "./icons/icon-192.png", "./icons/icon-512.png"];
    await Promise.allSettled(essentials.map((path) => shell.add(scopedUrl(path))));

    try {
      const response = await fetch(scopedUrl("./pwa-assets.json"), { cache: "no-store" });
      const paths = response.ok ? await response.json() : [];
      const media = await caches.open(MEDIA_CACHE);
      await Promise.allSettled(paths.map((path) => media.add(scopedUrl(path))));
    } catch {
      // Essential shell caching is enough to keep the app bootable.
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const validCaches = new Set([SHELL_CACHE, MEDIA_CACHE]);
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith("moirai-") && !validCaches.has(name)).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        const cache = await caches.open(SHELL_CACHE);
        cache.put(request, response.clone());
        return response;
      } catch {
        return (await caches.match(request)) || (await caches.match(scopedUrl("./")));
      }
    })());
    return;
  }

  if (url.pathname.endsWith("/version.json")) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: "no-store" });
        if (response.ok) (await caches.open(SHELL_CACHE)).put(request, response.clone());
        return response;
      } catch {
        return (await caches.match(request)) || Response.error();
      }
    })());
    return;
  }

  const isMedia = request.destination === "image" || /\.(?:webp|png|jpe?g|svg)$/i.test(url.pathname);
  if (isMedia) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) (await caches.open(MEDIA_CACHE)).put(request, response.clone());
      return response;
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    const network = fetch(request).then(async (response) => {
      if (response.ok) (await caches.open(SHELL_CACHE)).put(request, response.clone());
      return response;
    }).catch(() => undefined);
    return cached || network || Response.error();
  })());
});
