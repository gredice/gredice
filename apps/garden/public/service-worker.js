self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
    if (!event.data) {
        return;
    }

    let payload;
    try {
        payload = event.data.json();
    } catch (error) {
        payload = { title: 'Gredice', body: event.data.text() };
    }

    const title = payload?.title ?? 'Gredice';
    const options = {
        body: payload?.body,
        icon: payload?.icon ?? '/icon.png',
        image: payload?.image,
        data: {
            url: payload?.url,
            notificationId: payload?.notificationId,
            ...payload?.data,
        },
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url;

    event.waitUntil(
        (async () => {
            const windowClients = await self.clients.matchAll({
                type: 'window',
                includeUncontrolled: true,
            });

            if (targetUrl) {
                for (const client of windowClients) {
                    if ('focus' in client) {
                        if (client.url === targetUrl) {
                            await client.focus();
                            return;
                        }
                    }
                }
                if (self.clients.openWindow) {
                    await self.clients.openWindow(targetUrl);
                    return;
                }
            }

            if (windowClients.length > 0 && 'focus' in windowClients[0]) {
                await windowClients[0].focus();
            }
        })(),
    );
});
