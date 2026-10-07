/* FloodGuard service worker — app-shell caching + Web Push emergency notifications.
 *
 * Emergency API responses (/api/*) are never cached: stale emergency data is worse than none.
 * Notification sound/vibration are requested but always subject to OS settings (silent mode,
 * Do Not Disturb, per-app notification settings) — a web app cannot override them.
 */
const VERSION = 'floodguard-v2'; // bump when cached shell or icon files change
const SHELL = ['/emergency', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/badge-96.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // network only
  if (req.mode === 'navigate') {
    // network-first; offline fallback to the cached emergency shell
    event.respondWith(fetch(req).catch(() => caches.match('/emergency').then((r) => r || new Response('FloodGuard is offline. Call 112 in an emergency.', { status: 503, headers: { 'Content-Type': 'text/plain' } }))));
    return;
  }
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    })));
  }
});

self.addEventListener('push', (event) => {
  let p = {};
  try { p = event.data ? event.data.json() : {}; } catch (e) { p = { title: 'FloodGuard', body: event.data ? event.data.text() : '' }; }
  const urgent = p.level === 'CRITICAL' || p.level === 'WARNING';
  const title = p.title || 'FloodGuard';
  const options = {
    body: p.body || 'Open FloodGuard for details.',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: p.tag || 'floodguard',
    renotify: true,
    requireInteraction: urgent,
    silent: false,
    vibrate: urgent ? [600, 200, 600, 200, 900, 300, 900] : [200, 100, 200],
    timestamp: Date.now(),
    data: { url: p.url || '/emergency', delivery_id: p.delivery_id || null, alert_id: p.alert_id || null },
    actions: [{ action: 'open', title: 'Open FloodGuard' }],
  };
  event.waitUntil(Promise.all([
    self.registration.showNotification(title, options),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => cs.forEach((c) => c.postMessage({ type: 'fg-push', payload: p }))),
  ]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/emergency', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) {
      if (new URL(c.url).origin === self.location.origin && 'focus' in c) {
        c.postMessage({ type: 'fg-open', url: target });
        return c.navigate ? c.navigate(target).then((w) => (w || c).focus()) : c.focus();
      }
    }
    return self.clients.openWindow(target);
  }));
});

// Browsers may rotate push subscriptions; re-subscribe with the same server key.
// The app re-registers the new subscription with the backend the next time it is opened.
self.addEventListener('pushsubscriptionchange', (event) => {
  const key = event.oldSubscription && event.oldSubscription.options && event.oldSubscription.options.applicationServerKey;
  if (!key) return;
  event.waitUntil(self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
});
