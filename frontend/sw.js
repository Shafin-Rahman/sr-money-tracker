const CACHE = 'sr-money-tracker-v1';

const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css',
  '/css/components/sidebar.css',
  '/css/components/cards.css',
  '/css/components/forms.css',
  '/css/components/tables.css',
  '/css/components/modal.css',
  '/css/components/dark-mode.css',
  '/js/app.js',
  '/js/api.js',
  '/js/router.js',
  '/js/i18n.js',
  '/js/utils.js',
  '/js/lang/en.js',
  '/js/lang/bn.js',
  '/js/pages/dashboard.js',
  '/js/pages/accounts.js',
  '/js/pages/transactions.js',
  '/js/pages/categories.js',
  '/js/pages/loans.js',
  '/js/pages/budgets.js',
  '/js/pages/savings.js',
  '/js/pages/recurring.js',
  '/js/pages/reports.js',
  '/js/pages/settings.js',
  '/assets/icons/icon.svg',
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
    }).catch(() => caches.match('/index.html')))
  );
});
