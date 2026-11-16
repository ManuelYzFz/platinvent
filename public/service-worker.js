const CACHE_NAME = 'vtraxx-cache-v10';
const PRECACHE_URLS = [
  '/',
  '/login',
  '/manifest.webmanifest',
  '/icon.png',
  '/badge.png',
  '/pwa/icon-192x192.png',
  '/pwa/icon-512x512.png',
  '/images/logo.png',
  '/images/openvtraxx.png',
  '/images/vtraxx.png',
];

self.addEventListener('install', function (event) {
  if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
    return self.skipWaiting();
  }
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
    event.waitUntil(
      caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (key) { return caches.delete(key); }));
      }).then(function () {
        return self.registration.unregister();
      })
    );
    return;
  }
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; })
            .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') {
    return;
  }

  // En localhost/desarrollo no interceptar para evitar chunks obsoletos durante Turbopack HMR
  if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
    return;
  }

  const url = new URL(event.request.url);

  // Recursos estáticos inmutables (bundles _next/static, imágenes, fuentes): Cache-First
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.startsWith('/pwa/')
  ) {
    event.respondWith(
      caches.match(event.request).then(function (cachedResponse) {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then(function (networkResponse) {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Network-First para páginas HTML y llamadas de datos
  event.respondWith(
    fetch(event.request)
      .then(function (networkResponse) {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          !networkResponse.redirected &&
          (networkResponse.type === 'basic' || networkResponse.type === 'cors')
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(function () {
        return caches.match(event.request, { ignoreSearch: true }).then(function (cachedResponse) {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            if (url.pathname.includes('/dispositivos')) {
              return caches.match('/dispositivos');
            }
            if (url.pathname.includes('/simcards')) {
              return caches.match('/simcards');
            }
            if (url.pathname.includes('/reportes')) {
              return caches.match('/reportes');
            }
            if (url.pathname.includes('/informes')) {
              return caches.match('/informes');
            }
            return caches.match('/').then(function (r) {
              return r || caches.match('/login');
            });
          }
          // Para peticiones RSC que no están en caché, responder 503 para que Next.js active navegación completa
          if (url.search.includes('_rsc=') || url.pathname.includes('.rsc')) {
            return new Response('Offline', { status: 503, statusText: 'Offline' });
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
  );
});

self.addEventListener('push', function (event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || '/icon.png',
      badge: '/badge.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '2',
      },
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(self.clients.openWindow('/'));
});
