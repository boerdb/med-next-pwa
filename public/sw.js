// MedTracker Service Worker
// Handles: caching, background sync, push notifications, update signalling

importScripts('/push-handler.js');

const CACHE_VERSION = 'medtracker-v3';
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

  // Skip non-GET and cross-origin requests.
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

// ─── Reminder check helper (periodic sync fallback, Android/desktop) ───────
function formatMedicationList(names) {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} en ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} en ${names[names.length - 1]}`;
}

function bundledReminderTag(dateKey, time, kind) {
  const raw = `${dateKey}-${time.replace(':', '')}-${kind}`;
  return `mt-${raw.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

function bundledReminderBody(kind, time, names) {
  const list = formatMedicationList(names);
  if (kind === 'first') {
    return `${list} — ${time}. Open de app om te registreren.`;
  }
  return `${list} (${time}): nog niet als ingenomen gemarkeerd. Open de app en tik op Innemen.`;
}

async function showBundledReminderNotification(kind, dateKey, time, names) {
  const title = kind === 'first' ? 'Medicijn innemen' : 'Medicijn nog niet ingenomen';
  await self.registration.showNotification(title, {
    body: bundledReminderBody(kind, time, names),
    icon: '/icons/icon-192x192.png',
    tag: bundledReminderTag(dateKey, time, kind),
    vibrate: kind === 'first' ? [160] : [180, 100, 180],
  });
}

function formatMedLabel(med) {
  if (med.doseAmount == null || med.doseAmount === undefined) return med.name;
  const unit = med.doseUnit || 'mg';
  return `${med.name} ${med.doseAmount} ${unit}`;
}

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
    const pendingFirst = new Map();
    const pendingSecond = new Map();
    const weekday = date.getDay();

    for (const med of medications) {
      const days = med.daysOfWeek;
      if (Array.isArray(days) && days.length > 0 && !days.includes(weekday)) continue;

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
          const names = pendingSecond.get(time) ?? [];
          names.push(formatMedLabel(med));
          pendingSecond.set(time, names);
        } else if (now >= dueMs && now < dueMs + 5 * 60_000 && !entry.first) {
          updatedFlags[sk] = { ...entry, first: true };
          const names = pendingFirst.get(time) ?? [];
          names.push(formatMedLabel(med));
          pendingFirst.set(time, names);
        }
      }
    }

    for (const [time, names] of pendingFirst) {
      names.sort((a, b) => a.localeCompare(b, 'nl'));
      await showBundledReminderNotification('first', dateKey, time, names);
    }
    for (const [time, names] of pendingSecond) {
      names.sort((a, b) => a.localeCompare(b, 'nl'));
      await showBundledReminderNotification('second', dateKey, time, names);
    }

    // Persist updated flags back to cache
    const updated = { ...bundle, reminderBeeps: updatedFlags };
    await cache.put(new Request(url), new Response(JSON.stringify(updated)));
  } catch {
    // ignore errors in SW background sync
  }
}
