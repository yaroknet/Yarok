// Service Worker for Push Notifications and Offline Support
const CACHE_NAME = 'yarok-fleet-v3';
const STATIC_CACHE = 'yarok-fleet-static-v3';
const DYNAMIC_CACHE = 'yarok-fleet-dynamic-v3';
const API_CACHE = 'yarok-fleet-api-v3';

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/favicon.ico'
];

// App shell pages to cache
const APP_SHELL_PAGES = [
  '/dashboard',
  '/vehicles',
  '/drivers',
  '/reminders',
  '/handover',
  '/documents',
  '/tasks',
  '/auth'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      console.log('Service Worker installed');
      return self.skipWaiting();
    }).catch((error) => {
      console.error('Failed to cache static assets:', error);
      return self.skipWaiting();
    })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return cacheName.startsWith('yarok-fleet-') && 
                   cacheName !== STATIC_CACHE && 
                   cacheName !== DYNAMIC_CACHE &&
                   cacheName !== API_CACHE;
          })
          .map((cacheName) => {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => {
      console.log('Service Worker activated');
      return clients.claim();
    })
  );
});

// Fetch event - implement cache strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // API requests - Network first, then cache
  if (url.pathname.includes('/rest/') || url.hostname.includes('supabase')) {
    event.respondWith(networkFirstStrategy(request, API_CACHE));
    return;
  }

  // Static assets (js, css, images) - Cache first
  if (request.destination === 'script' || 
      request.destination === 'style' || 
      request.destination === 'image' ||
      request.destination === 'font') {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
    return;
  }

  // HTML pages - Network first with offline fallback
  if (request.destination === 'document' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // Default - Network first
  event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE));
});

// Cache first strategy - for static assets
async function cacheFirstStrategy(request, cacheName) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Update cache in background
      updateCache(request, cacheName);
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Network first strategy - for API calls
async function networkFirstStrategy(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Network first with offline fallback for HTML pages
async function networkFirstWithOfflineFallback(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Try to get from cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Try to get the index page as fallback
    const indexResponse = await caches.match('/');
    if (indexResponse) {
      return indexResponse;
    }

    // Return offline page
    return new Response(getOfflineHTML(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

// Update cache in background
async function updateCache(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
  } catch (error) {
    // Silently fail - we have a cached version
  }
}

// Offline HTML fallback
function getOfflineHTML() {
  return `
    <!DOCTYPE html>
    <html lang="he" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>אופליין - Yarok Fleet</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          color: #f1f5f9;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
          text-align: center;
        }
        .container {
          max-width: 400px;
        }
        .icon {
          font-size: 64px;
          margin-bottom: 24px;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        h1 {
          font-size: 24px;
          margin-bottom: 16px;
          color: #22c55e;
        }
        p {
          font-size: 16px;
          line-height: 1.6;
          margin-bottom: 24px;
          color: #94a3b8;
        }
        button {
          background: #22c55e;
          color: white;
          border: none;
          padding: 12px 32px;
          font-size: 16px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.2s;
        }
        button:hover {
          background: #16a34a;
        }
        .tips {
          margin-top: 32px;
          padding: 16px;
          background: rgba(255,255,255,0.05);
          border-radius: 8px;
          text-align: right;
        }
        .tips h3 {
          font-size: 14px;
          margin-bottom: 8px;
          color: #22c55e;
        }
        .tips ul {
          list-style: none;
          font-size: 14px;
          color: #94a3b8;
        }
        .tips li {
          margin-bottom: 4px;
        }
        .tips li::before {
          content: "✓ ";
          color: #22c55e;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">📡</div>
        <h1>אין חיבור לאינטרנט</h1>
        <p>נראה שאתה לא מחובר לאינטרנט. בדוק את החיבור שלך ונסה שוב.</p>
        <button onclick="window.location.reload()">נסה שוב</button>
        <div class="tips">
          <h3>טיפים:</h3>
          <ul>
            <li>בדוק את חיבור ה-WiFi או הנתונים</li>
            <li>נסה להפעיל מצב טיסה ולכבות</li>
            <li>דפים שביקרת בהם יהיו זמינים אופליין</li>
          </ul>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  
  let data = {
    title: 'Yarok Fleet',
    body: 'התראה חדשה',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: {}
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    vibrate: [100, 50, 100],
    data: data.data || {},
    dir: 'rtl',
    lang: 'he',
    requireInteraction: true,
    actions: [
      { action: 'open', title: 'פתח' },
      { action: 'close', title: 'סגור' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // Open the app when notification is clicked
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        const url = event.notification.data?.url || '/dashboard';
        return clients.openWindow(url);
      }
    })
  );
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Background sync:', event.tag);
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  // This will be called when the user comes back online
  // You can implement syncing of offline actions here
  console.log('Syncing data after coming online...');
}

// Message event - for communication with the main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_PAGES') {
    event.waitUntil(cachePages(event.data.pages));
  }
});

async function cachePages(pages) {
  try {
    const cache = await caches.open(DYNAMIC_CACHE);
    await cache.addAll(pages);
  } catch {
    // Failed to cache pages - non-critical
  }
}
