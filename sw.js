/* ═══════════════════════════════════════════════════
   تـدّبير Service Worker v1.0
   استراتيجية: Cache First للـ assets، Network First للـ Firestore
═══════════════════════════════════════════════════ */

const CACHE_NAME = 'tdbeer-v2';
const CACHE_VERSION = '2.0.0';
const BUILD_TIME = '2026-04-25';

// تحقق من الـ version في كل طلب navigate
async function checkVersion() {
  try {
    const res = await fetch('./?v=' + Date.now(), { cache: 'no-store' });
    if (res.ok) {
      const text = await res.text();
      // إذا تغير الـ HTML، أبلّغ الـ clients
      const clients_list = await self.clients.matchAll({ type: 'window' });
      for (const client of clients_list) {
        client.postMessage({ type: 'NEW_VERSION_AVAILABLE' });
      }
    }
  } catch {}
}

// الملفات الأساسية اللي تشتغل أوفلاين
const CORE_ASSETS = [
  './',
  './index.html',
];

// ─── INSTALL ───
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE ───
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// ─── FETCH ───
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // تجاهل: Firebase, Analytics, Chrome extensions
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googletagmanager') ||
    url.hostname.includes('googleapis.com') ||
    url.protocol === 'chrome-extension:'
  ) {
    return; // اتركها للـ network
  }

  // Google Fonts: Cache First (نادراً ما تتغير)
  if (url.hostname.includes('fonts.googleapis.com') || 
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(CACHE_NAME + '-fonts').then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // الـ HTML الرئيسي: Network First مع Cache Fallback
  if (request.mode === 'navigate' || 
      (request.destination === 'document') ||
      url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match('./index.html') || caches.match('./'))
    );
    return;
  }

  // باقي الـ assets: Cache First
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback
        if (request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ─── PUSH NOTIFICATIONS (مستقبلاً) ───
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'تـدّبير', {
        body: data.body || 'إشعار جديد',
        icon: data.icon || './icons/icon-192.png',
        badge: './icons/badge-72.png',
        dir: 'rtl',
        lang: 'ar',
        data: data,
        actions: data.actions || []
      })
    );
  } catch {}
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow('./');
    })
  );
});

// ─── BACKGROUND SYNC ───
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-streak') {
    event.waitUntil(syncStreak());
  }
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncStreak() {
  // لما يعود الإنترنت، نبلّغ الـ clients لتشغّل syncStreak
  const clients_list = await self.clients.matchAll({ type: 'window' });
  for (const client of clients_list) {
    client.postMessage({ type: 'SYNC_STREAK' });
  }
}

async function syncData() {
  const clients_list = await self.clients.matchAll({ type: 'window' });
  for (const client of clients_list) {
    client.postMessage({ type: 'SYNC_DATA' });
  }
}
