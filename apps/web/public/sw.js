// Service Worker para notificações - v2
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker instalado - v2');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker ativado - v2');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Abrir a página do chamado quando clicar na notificação
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});

self.addEventListener('push', (event) => {
  const options = {
    body: event.data?.text() || 'Nova notificação',
    icon: 'https://dtvoeevhaseb5.cloudfront.net/uploads/mocha-import/b4d52216-85e6-4a21-b93e-45671531bdd3/040c14e4-eeac-4642-9796-b7d1dd537ef2.png',
    badge: 'https://dtvoeevhaseb5.cloudfront.net/uploads/mocha-import/b4d52216-85e6-4a21-b93e-45671531bdd3/040c14e4-eeac-4642-9796-b7d1dd537ef2.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification('TicketHPC', options)
  );
});
