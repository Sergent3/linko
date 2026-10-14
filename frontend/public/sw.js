// Service worker di Linko: solo notifiche push. Nessuna cache, nessuna gestione delle richieste.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  const title = data.title || 'Linko';
  event.waitUntil((async () => {
    await self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.id || undefined,
      data: { url: data.url || '/', id: data.id },
    });
    // Le pagine aperte aggiornano subito la campanella
    for (const c of await self.clients.matchAll({ type: 'window' })) c.postMessage({ type: 'linko:notification' });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin);
  if (target.origin !== self.location.origin) return; // solo pagine di Linko
  event.waitUntil((async () => {
    const id = event.notification.data?.id;
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of wins) c.postMessage({ type: 'linko:notification-open', id });
    const same = wins.find((c) => new URL(c.url).pathname === target.pathname);
    if (same) return same.focus();
    if (wins[0] && 'navigate' in wins[0]) { await wins[0].focus(); return wins[0].navigate(target.href); }
    return self.clients.openWindow(target.href);
  })());
});
