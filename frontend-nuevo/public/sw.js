/*
 * Service worker de Lyfta: la app instalada en el móvil arranca sin cobertura y
 * sirve los assets ya descargados. Lo que de verdad importa no se cachea: la
 * API siempre va a la red (un plan o una serie vieja en caché sería peor que
 * un error visible) y las rutas de navegación se refrescan solas.
 */
const VERSION = 'lyfta-v1';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      // Sin `addAll`: si un icono falla no se cae la instalación entera.
      await Promise.all(
        SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => null)),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // La API siempre va a la red: datos frescos o error, nunca una copia rancia.
  if (url.pathname.startsWith('/api')) return;

  // Navegación: red primero y, si no hay cobertura, el shell guardado.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(VERSION);
          cache.put('/index.html', fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(VERSION);
          return (await cache.match('/index.html')) ?? (await cache.match('/')) ?? Response.error();
        }
      })(),
    );
    return;
  }

  // Assets: caché primero (los bundles llevan hash) y red de respaldo.
  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const fresh = await fetch(request);
        if (fresh.ok) cache.put(request, fresh.clone());
        return fresh;
      } catch {
        return cached ?? Response.error();
      }
    })(),
  );
});
