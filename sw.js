// PRODASH Service Worker — Background Notifications v2.0

// ── IndexedDB helpers ──
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('prodash_sw_db', 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('notifications', { keyPath: 'id' });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveNotif(n) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('notifications', 'readwrite');
    tx.objectStore('notifications').put(n);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}

async function getAllNotifs() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('notifications', 'readonly');
    const req = tx.objectStore('notifications').getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  });
}

async function removeNotif(id) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('notifications', 'readwrite');
    tx.objectStore('notifications').delete(id);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}

// ── In-memory timers ──
const timers = new Map();

async function scheduleTimer(n) {
  if (timers.has(n.id)) { clearTimeout(timers.get(n.id)); }
  const delay = Math.max(0, n.scheduledTime - Date.now());
  // Only set timer if within 24 hours (browsers kill SW otherwise)
  if (delay > 24 * 60 * 60 * 1000) return;
  const t = setTimeout(async () => {
    timers.delete(n.id);
    try {
      await self.registration.showNotification(n.title, {
        body: n.body,
        icon: '/prodash/icon.svg',
        badge: '/prodash/icon.svg',
        tag: n.id,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: { url: '/prodash/' }
      });
      await removeNotif(n.id);
    } catch(e) { console.error('SW notif error:', e); }
  }, delay);
  timers.set(n.id, t);
}

// Check for any overdue notifications and fire them immediately
async function checkOverdue() {
  const now = Date.now();
  const notifs = await getAllNotifs();
  for (const n of notifs) {
    if (n.scheduledTime <= now) {
      try {
        await self.registration.showNotification(n.title, {
          body: n.body,
          icon: '/prodash/icon.svg',
          badge: '/prodash/icon.svg',
          tag: n.id,
          requireInteraction: true,
          vibrate: [200, 100, 200],
          data: { url: '/prodash/' }
        });
        await removeNotif(n.id);
      } catch(e) {}
    } else {
      await scheduleTimer(n);
    }
  }
}

// ── Event Listeners ──
self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    self.clients.claim().then(() => checkOverdue())
  );
});

self.addEventListener('message', async event => {
  const { type, ...data } = event.data || {};

  if (type === 'SCHEDULE_NOTIFICATION') {
    await saveNotif(data);
    await scheduleTimer(data);
    event.ports?.[0]?.postMessage({ ok: true });
  }

  if (type === 'CANCEL_NOTIFICATION') {
    if (timers.has(data.id)) {
      clearTimeout(timers.get(data.id));
      timers.delete(data.id);
    }
    await removeNotif(data.id);
  }

  if (type === 'CHECK_NOW') {
    await checkOverdue();
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('/prodash') && 'focus' in c) return c.focus();
      }
      return clients.openWindow('/prodash/');
    })
  );
});

// Periodic background sync (Chrome Android supports this)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'prodash-notif-check') {
    event.waitUntil(checkOverdue());
  }
});
