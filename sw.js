/* JUN 个人工作台 Service Worker v14.0 — 离线缓存 */
const SW_VERSION = 'jun-v14.1.0';
const CORE_ASSETS = [
  './',
  './index.html',
  './desktop.html',
  './manifest.json',
  './workout.json',
  './news.json',
  './todos.json'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SW_VERSION)
      .then(function (cache) { return cache.addAll(CORE_ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== SW_VERSION; }).map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // 页面导航与 JSON 数据：网络优先，离线时回退缓存
  const isFresh = req.mode === 'navigate' || url.pathname.endsWith('.json');
  if (isFresh) {
    event.respondWith(
      fetch(req).then(function (resp) {
        const copy = resp.clone();
        caches.open(SW_VERSION).then(function (c) { c.put(req, copy); });
        return resp;
      }).catch(function () {
        return caches.match(req, { ignoreSearch: true }).then(function (r) { return r || caches.match('./index.html'); });
      })
    );
    return;
  }

  // 其余同源静态资源（图片等）：缓存优先
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (resp) {
        if (resp.ok) {
          const copy = resp.clone();
          caches.open(SW_VERSION).then(function (c) { c.put(req, copy); });
        }
        return resp;
      });
    })
  );
});
