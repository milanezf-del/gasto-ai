const SHELL_CACHE = "gasto-shell-v1";
const SHELL_ASSETS = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/icon.svg",
  "/pwa-192x192.png",
  "/pwa-512x512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // NUNCA cachear /api/*
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Navegação SPA: network-first com fallback para shell ou página offline amigável
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put("/", copy));
          }
          return response;
        })
        .catch(async () => {
          const cachedShell = await caches.match("/");
          if (cachedShell) return cachedShell;
          const offlinePage = await caches.match("/offline.html");
          return offlinePage || Response.error();
        })
    );
    return;
  }

  // Assets estáticos: cache-first com revalidação em segundo plano
  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".webmanifest")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);

        return cached || networkFetch;
      })
    );
  }
});
