const CACHE = 'sr-money-tracker-v7';

// Derive base path from the SW script location, so it works on both
// GitHub Pages (/sr-money-tracker/) and Vercel (/).
const PREFIX = self.registration && self.registration.scope
  ? self.registration.scope.replace(/\/$/, '')
  : '';

const PRECACHE = [
  PREFIX + '/',
  PREFIX + '/index.html',
  PREFIX + '/manifest.json',
  PREFIX + '/css/style.css',
  PREFIX + '/css/components/sidebar.css',
  PREFIX + '/css/components/cards.css',
  PREFIX + '/css/components/forms.css',
  PREFIX + '/css/components/tables.css',
  PREFIX + '/css/components/modal.css',
  PREFIX + '/css/components/dark-mode.css',
  PREFIX + '/js/app.js',
  PREFIX + '/js/api.js',
  PREFIX + '/js/config.js',
  PREFIX + '/js/localdb.js',
  PREFIX + '/js/sync.js',
  PREFIX + '/js/offlineCompute.js',
  PREFIX + '/js/router.js',
  PREFIX + '/js/i18n.js',
  PREFIX + '/js/utils.js',
  PREFIX + '/js/lang/en.js',
  PREFIX + '/js/lang/bn.js',
  PREFIX + '/js/pages/dashboard.js',
  PREFIX + '/js/pages/accounts.js',
  PREFIX + '/js/pages/transactions.js',
  PREFIX + '/js/pages/categories.js',
  PREFIX + '/js/pages/loans.js',
  PREFIX + '/js/pages/budgets.js',
  PREFIX + '/js/pages/savings.js',
  PREFIX + '/js/pages/recurring.js',
  PREFIX + '/js/pages/reports.js',
  PREFIX + '/js/pages/settings.js',
  PREFIX + '/assets/icons/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
      if (res.status === 200) {
        const clone = res.clone();
        caches.open(CACHE).then((cache) => cache.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match(PREFIX + '/index.html')))
  );
});
