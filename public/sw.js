/*
 * Self-destroying service worker.
 *
 * The previous worker (Vite-era, "coupon-master-v3") was cache-first and
 * precached "/" and "/index.html". Once installed it kept serving that stale
 * shell, which pointed at an old JS bundle hash — so devices that had the PWA
 * installed never picked up new deploys no matter what we shipped.
 *
 * The Expo build registers no service worker at all. This file exists only to
 * evict the old one: browsers re-fetch the worker script on update checks, get
 * this, drop every cache and unregister themselves. It can be deleted once
 * installs have had time to update.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));

      await self.registration.unregister();

      // Reload open tabs so they come back from the network, not the dead cache.
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => client.navigate(client.url));
    })()
  );
});

// Pass everything straight through while we are still alive.
self.addEventListener("fetch", () => {});
