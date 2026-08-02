// Bump cache when deploying a new build. Old Vite asset hashes must never block startup.
const CACHE_NAME = 'coupon-master-v3';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.svg',
  '/logo-icon.svg',
  '/logo.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
  '/og-image.png'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching App Shell');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Network First with Cache Fallback for dynamic requests, Cache First for static assets
self.addEventListener('fetch', (event) => {
  // Ignore non-GET requests or Supabase/API calls for offline cache
  if (event.request.method !== 'GET' || event.request.url.includes('/supabase/') || event.request.url.includes('chrome-extension')) {
    return;
  }

  event.respondWith((async () => {
    const cachedResponse = await caches.match(event.request);

    try {
      const networkResponse = await fetch(event.request);
      if (networkResponse?.ok && networkResponse.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, networkResponse.clone());
      }
      return networkResponse;
    } catch {
      // Offline fallback only. Never prefer stale JS/CSS while online.
      if (cachedResponse) return cachedResponse;
      if (event.request.mode === 'navigate') return caches.match('/index.html');
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});

self.addEventListener('push', (event) => {
  let data = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || 'קופון מאסטר';
  const options = {
    body: data.body || 'יש עדכון חדש בקופונים שלך.',
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    tag: data.tag || 'coupon-master-update',
    renotify: Boolean(data.renotify),
    requireInteraction: Boolean(data.requireInteraction),
    data: {
      url: data.url || '/notifications',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/notifications';
  const destinationUrl = new URL(targetUrl, self.location.origin).toString();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if (client.url === destinationUrl || client.url.startsWith(destinationUrl)) {
          client.focus();
          client.postMessage({ url: targetUrl });
          return;
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(destinationUrl);
      }
    })
  );
});
