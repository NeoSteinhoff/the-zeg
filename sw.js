// The Zeg — Service Worker (PWA Offline Support)
const CACHE_VERSION = 'v1';
const CACHE_NAME = 'the-zeg-' + CACHE_VERSION;
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // API requests: network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  // Static assets: cache first
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
