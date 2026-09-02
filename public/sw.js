/*
 * Notification-only service worker.
 *
 * Do not cache the app shell here. Expo's web build uses hashed assets and
 * must always load its current HTML from the network. This worker stays
 * registered solely because Web Push subscriptions require an active worker.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Remove caches left by the old Vite-era service worker.
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("push", (event) => {
  let data = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || "קופון מאסטר";
  const options = {
    body: data.body || "יש עדכון חדש בקופונים שלך.",
    // Direction and language both: a browser that ignores one may honour the
    // other, and the text itself carries bidi marks for the rest.
    dir: data.dir || "rtl",
    lang: data.lang || "he",
    icon: data.icon || "/pwa-192x192.png",
    badge: data.badge || "/pwa-192x192.png",
    tag: data.tag || "coupon-master-update",
    renotify: Boolean(data.renotify),
    requireInteraction: Boolean(data.requireInteraction),
    data: {
      url: data.url || "/notifications",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/notifications";
  const destinationUrl = new URL(targetUrl, self.location.origin).toString();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      for (const client of clients) {
        if (client.url === destinationUrl || client.url.startsWith(destinationUrl)) {
          await client.focus();
          client.postMessage({ url: targetUrl });
          return;
        }
      }

      // Keep notification taps inside an already-open installed PWA even when
      // it currently shows another route. Matching only the destination used
      // to open a new Safari window for every different coupon.
      const appClient = clients.find((client) => new URL(client.url).origin === self.location.origin);
      if (appClient) {
        await appClient.navigate(destinationUrl);
        await appClient.focus();
        return;
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(destinationUrl);
      }
    })
  );
});
