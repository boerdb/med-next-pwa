// MedTracker Service Worker
// Handles: caching, background sync, push notifications, update signalling

const CACHE_VERSION = 'medtracker-v2';
const STATIC_ASSETS = [
  '/',
  '/today',
  '/manage',
  '/history',
  '/manifest.webmanifest',
];

// ─── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()),
  );
});

// ─── Activate ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION && key !== 'medtracker-data-v1')
          .map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  );
});

// ─── Fetch — stale-while-revalidate for pages, cache-first for assets ───────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, cross-origin, InstantDB, etc.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname === '/medtracker-sw-bundle.json') return; // handled by app

  // Network-first for HTML pages (app shell)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r ?? caches.match('/'))),
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(request, clone));
        }
        return res;
      });
    }),
  );
});

// ─── Skip waiting (triggered by update banner) ─────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ─── Periodic background sync — reminder checks ────────────────────────────
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'medtracker-reminders') {
    event.waitUntil(checkReminders());
  }
});

// ─── Push notifications ────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'MedTracker', body: 'Tijd voor uw medicijnen!' };
  try { if (event.data) data = event.data.json(); } catch { /* noop */ }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
    }),
  );
});

// ─── Notification click ────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return self.clients.openWindow('/today');
    }),
  );
});

// ─── Reminder check helper ─────────────────────────────────────────────────
async function checkReminders() {
  try {
    const cache = await caches.open('medtracker-data-v1');
    const url = `${self.location.origin}/medtracker-sw-bundle.json`;
    const res = await cache.match(url);
    if (!res) return;

    const bundle = await res.json();
    if (!bundle.notificationsEnabled) return;

    const now = Date.now();
    const date = new Date(now);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateKey = `${y}-${m}-${d}`;

    const { medications = [], logs = [], reminderBeeps = {} } = bundle;
    const updatedFlags = { ...reminderBeeps };

    for (const med of medications) {
      for (const time of med.times) {
        const logged = logs.some(
          (l) => l.medicationId === med.id && l.dateKey === dateKey && l.time === time,
        );
        if (logged) continue;

        const [hh, mm] = time.split(':').map(Number);
        const dueMs = new Date(+date.getFullYear(), date.getMonth(), date.getDate(), hh, mm).getTime();
        const sk = `${dateKey}::${med.id}::${time}`;
        const entry = updatedFlags[sk] ?? {};

        if (now >= dueMs + 5 * 60_000 && !entry.second) {
          updatedFlags[sk] = { first: true, second: true };
          await self.registration.showNotification('Medicijn nog niet ingenomen', {
            body: `${med.name} om ${time} — nog steeds niet geregistreerd.`,
            icon: '/icons/icon-192x192.png',
            tag: `mt-${sk.replace(/::/g, '-')}-second`,
            vibrate: [180, 100, 180],
          });
        } else if (now >= dueMs && now < dueMs + 5 * 60_000 && !entry.first) {
          updatedFlags[sk] = { ...entry, first: true };
          await self.registration.showNotification('Medicijn innemen', {
            body: `${med.name} — ${time}. Open de app om te registreren.`,
            icon: '/icons/icon-192x192.png',
            tag: `mt-${sk.replace(/::/g, '-')}-first`,
            vibrate: [160],
          });
        }
      }
    }

    // Persist updated flags back to cache
    const updated = { ...bundle, reminderBeeps: updatedFlags };
    await cache.put(new Request(url), new Response(JSON.stringify(updated)));
  } catch {
    // ignore errors in SW background sync
  }
}
