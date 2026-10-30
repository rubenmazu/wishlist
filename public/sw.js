// Service worker minimal: suficient pentru a face aplicația instalabilă (PWA).
// Fără cache agresiv — lista trebuie să fie mereu proaspătă.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Pass-through: lăsăm rețeaua să răspundă normal.
});
