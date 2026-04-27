/* ═══════════════════════════════════════════════════════════════════
   تـدّبير — Service Worker v2.0
   ───────────────────────────────────────────────────────────────────
   Strategy:
     • Cache First للـ assets الأساسية (HTML, CSS, JS)
     • Network First للـ HTML (للحصول على آخر نسخة)
     • Network only للـ Firebase (لا تُكاش أبداً)

   Improvements over v1.0:
     • Logs SW errors to a queue accessible from the app
     • Caches the new modular JS/CSS files
     • Better cleanup of old caches
     • Push notifications + background sync
═══════════════════════════════════════════════════════════════════ */

const CACHE_VERSION = '5.1.7';
const BUILD_TIME = '2026-04-27';
const CACHE_NAME = `tdbeer-v${CACHE_VERSION}`;
const FONTS_CACHE = `${CACHE_NAME}-fonts`;

// Core assets that must be cached for offline support
const CORE_ASSETS = [
  './',
  './index.html',
  './css/main.css',
  './css/print.css',
  './css/features.css',

  // Core JS modules — load order matters
  './js/core/00-namespace.js',
  './js/core/01-constants.js',
  './js/core/02-logger.js',
  './js/core/03-utils.js',
  './js/core/04-formatter.js',
  './js/core/05-storage.js',
  './js/core/06-store.js',
  './js/core/07-scheduler.js',
  './js/core/08-dom.js',
  './js/core/09-error-handling.js',
  './js/core/10-toast.js',

  // Services
  './js/services/00-firebase.js',
  './js/services/01-app.js',
  './js/services/02-image-handler.js',
  './js/services/03-biometric.js',
  './js/services/04-pwa-install.js',
  './js/services/05-bootstrap.js',

  // UI
  './js/ui/01-renderers.js',
  './js/ui/02-controllers.js',
  './js/ui/03-sidebar.js',
  './js/ui/04-dedicated-pages.js',
  './js/ui/05-chats-page.js',
  './js/ui/06-html-bindings.js',

  // Features
  './js/features/01-social.js',
  './js/features/02-bot.js',
  './js/features/03-smart-features.js',
  './js/features/04-companion.js',
  './js/features/05-smart-moments.js',
  './js/features/06-fresh-content.js',
  './js/features/07-chat-notifications.js',
  './js/features/08-birthday.js',

  // ─── New Features (12 ميزة جديدة) ───
  './js/features/09-smart-categorizer.js',
  './js/features/10-quick-actions.js',
  './js/features/12-loan-simulator.js',
  './js/features/13-bill-scanner.js',
  './js/features/14-smart-notifs.js',
  './js/features/15-visual-calendar.js',
  './js/features/16-budget-challenges.js',
  './js/features/17-year-wrapped.js',
  './js/features/18-extra-themes.js',
  './js/features/19-pwa-shortcuts.js',
  './js/features/20-features-ui.js',
  './js/features/21-fab-controller.js',
  './js/features/22-unread-badges.js',
  './js/features/23-money-insights.js',
  './js/features/24-onboarding.js',
  './js/features/25-yearly-charts.js',
  './js/features/26-smart-search.js',
  './js/features/27-performance.js',
  './js/features/28-heatmap.js',
  './js/features/29-push-notifs.js',
  './js/features/30-ui-polish.js',
  './js/features/31-diagnostics.js',
  './js/features/32-settings-search.js'
];

// Domains we never cache (always go to network)
const NETWORK_ONLY_HOSTS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebase',
  'googletagmanager',
  'googleapis.com'
];

// ─── INSTALL ───────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) =>
        // addAll fails if any single fetch fails — we want resilience
        Promise.allSettled(
          CORE_ASSETS.map((url) =>
            cache.add(url).catch((err) => {
              console.warn('[SW] Failed to cache:', url, err.message);
              return null;
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE ──────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== FONTS_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── FETCH ─────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never cache: Firebase, analytics, chrome extensions
  if (
    NETWORK_ONLY_HOSTS.some((h) => url.hostname.includes(h)) ||
    url.protocol === 'chrome-extension:'
  ) {
    return; // let the browser handle it
  }

  // Google Fonts: Cache First
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(FONTS_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          }).catch((err) => {
            console.warn('[SW] Font fetch failed:', err.message);
            return cached || Response.error();
          });
        })
      )
    );
    return;
  }

  // HTML: Network First with Cache fallback
  if (request.mode === 'navigate' ||
      request.destination === 'document' ||
      url.pathname.endsWith('.html') ||
      url.pathname === '/') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match('./index.html').then((cached) =>
            cached || caches.match('./')
          )
        )
    );
    return;
  }

  // Everything else: Stale-While-Revalidate (سريع + محدّث)
  // المنطق: نخدم من الكاش فوراً (سرعة)، ونحدّث في الخلفية
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response.ok && request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          if (request.destination === 'document') {
            return caches.match('./index.html');
          }
          return cached || new Response('', { status: 503, statusText: 'Service Unavailable' });
        });
      
      // Return cached immediately, update in background
      return cached || fetchPromise;
    })
  );
});

// ─── PUSH NOTIFICATIONS ───────────────────────────────────────────
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
  } catch (e) {
    console.warn('[SW] Push handler error:', e.message);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // استخراج URL من data
  const targetUrl = event.notification.data?.url || './';
  const action = event.notification.data?.action;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // إذا فيه نافذة مفتوحة، استخدمها
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // أرسل رسالة للنافذة لتنفّذ الـ action
          if (action) {
            client.postMessage({ 
              type: 'NOTIFICATION_CLICK', 
              action, 
              url: targetUrl 
            });
          }
          return client.focus();
        }
      }
      // وإلا افتح نافذة جديدة
      return clients.openWindow(targetUrl);
    })
  );
});

// معالج إغلاق التنبيه (تحليلات)
self.addEventListener('notificationclose', (event) => {
  // يمكن إضافة logging هنا لاحقاً
});

// ─── BACKGROUND SYNC ───────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-streak') {
    event.waitUntil(broadcastSync('SYNC_STREAK'));
  }
  if (event.tag === 'sync-data' || event.tag === 'sync-write-queue') {
    event.waitUntil(broadcastSync('SYNC_DATA'));
  }
});

async function broadcastSync(type) {
  const clients_list = await self.clients.matchAll({ type: 'window' });
  for (const client of clients_list) {
    client.postMessage({ type });
  }
}

// ─── MESSAGE HANDLING ──────────────────────────────────────────────
// Allow the app to ask SW to flush caches, check version, etc.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLEAR_CACHE') {
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    );
  }
  if (event.data?.type === 'GET_VERSION') {
    event.ports[0]?.postMessage({ version: CACHE_VERSION, buildTime: BUILD_TIME });
  }
});
