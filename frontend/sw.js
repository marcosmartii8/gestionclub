
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// Recibir notificaciones push del servidor
self.addEventListener('push', (event) => {
    let data = {};

    if (event.data) {
        try {
            data = event.data.json();
        } catch (error) {
            data = {
                title: 'GestDeVol',
                body: event.data.text()
            };
        }
    }

    const title = data.title || 'GestDeVol';

    const options = {
        body: data.body || 'Tienes un nuevo aviso.',
        icon: '/aseets/icon-192.png',
        badge: '/aseets/icon-192.png',
        data: {
            url: data.url || '/index.html'
        }
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Abrir GestDeVol al pulsar una notificación
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = new URL(
        event.notification.data?.url || '/index.html',
        self.location.origin
    ).href;

    event.waitUntil(
        self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then((clients) => {
            for (const client of clients) {
                if (client.url === targetUrl && 'focus' in client) {
                    return client.focus();
                }
            }

            return self.clients.openWindow(targetUrl);
        })
    );
});
