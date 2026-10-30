// Offline support. The app's own files: try the network first so updates arrive,
// but fall back to the saved copy after 3 seconds or when there's no signal.
// Fonts: saved copy first, as they never change.
const CACHE = 'randminton-v1';
const APP_FILES = [
  './',
  './index.html',
  './styles.css',
  './src/app.js',
  './src/draw.js',
  './src/store.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png'
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const NETWORK_WAIT_MS = 3000;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) event.respondWith(networkFirst(request));
  else if (FONT_HOSTS.includes(url.hostname)) event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const fromNetwork = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  const saved = await cache.match(request, { ignoreSearch: true });
  if (!saved) return fromNetwork;
  const timeout = new Promise(resolve => setTimeout(() => resolve(saved), NETWORK_WAIT_MS));
  return Promise.race([fromNetwork.catch(() => saved), timeout]);
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}
