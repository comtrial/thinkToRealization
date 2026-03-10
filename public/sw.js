// Service Worker for Web Push Notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const hasVisibleClient = windowClients.some((c) => c.visibilityState === 'visible');
      // iOS requires showNotification or permission gets revoked
      const isIOS = /iPhone|iPad/.test(self.navigator?.userAgent ?? '');
      if (hasVisibleClient && !isIOS) return;

      return self.registration.showNotification(data.title || 'TTR', {
        body: data.body || '',
        icon: '/icons/icon-192x192.png',
        tag: data.tag || 'default',
        data: { url: data.url || '/' },
      });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wcs) => {
      for (const c of wcs) {
        if (c.url.includes(self.location.origin) && 'focus' in c) {
          return c.focus().then((focused) => focused.navigate(url));
        }
      }
      return clients.openWindow(url);
    })
  );
});
