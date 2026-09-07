// Migration worker at the previous PWA URL. Release old cached HTML before opening the new build.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (/workbox|soniclab/i.test(key)) await caches.delete(key);
    }
    await self.clients.claim();
    await self.registration.unregister();
    for (const client of await self.clients.matchAll({ type: 'window' })) {
      await client.navigate(client.url);
    }
  })());
});
