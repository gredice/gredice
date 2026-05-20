import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceWorkerPath = path.resolve(
    __dirname,
    '../public/push-notifications-sw.js',
);
const origin = 'https://vrt.gredice.test';

async function createHarness({ clients = [] } = {}) {
    const source = await readFile(serviceWorkerPath, 'utf8');
    const handlers = new Map();
    const notifications = [];
    const openedUrls = [];
    const focusedUrls = [];
    const fetchRequests = [];

    const windowClients = clients.map((client) => ({
        url: client.url,
        focus: async () => {
            focusedUrls.push(client.url);
            return client;
        },
    }));

    const self = {
        location: { origin },
        Notification: { maxActions: 2 },
        registration: {
            showNotification: async (title, options) => {
                notifications.push({ title, options });
            },
        },
        clients: {
            matchAll: async () => windowClients,
            openWindow: async (url) => {
                openedUrls.push(url);
                return null;
            },
        },
        addEventListener: (type, handler) => {
            handlers.set(type, handler);
        },
    };

    const context = vm.createContext({
        clients: self.clients,
        self,
        URL,
        fetch: async (url, init) => {
            fetchRequests.push({ url, init });
            return { ok: true, status: 204 };
        },
        console,
    });

    vm.runInContext(source, context, { filename: serviceWorkerPath });

    return {
        fetchRequests,
        focusedUrls,
        handlers,
        notifications,
        openedUrls,
    };
}

async function dispatchPush(harness, data) {
    const handler = harness.handlers.get('push');
    assert.equal(typeof handler, 'function');
    const waits = [];

    handler({
        data,
        waitUntil: (promise) => {
            waits.push(Promise.resolve(promise));
        },
    });

    assert.equal(waits.length, 1);
    await Promise.all(waits);

    return harness.notifications.at(-1);
}

async function dispatchClick(harness, notification, action = '') {
    const handler = harness.handlers.get('notificationclick');
    assert.equal(typeof handler, 'function');
    const waits = [];
    let closed = false;

    handler({
        action,
        notification: {
            actions: notification.options.actions,
            close: () => {
                closed = true;
            },
            data: notification.options.data,
        },
        waitUntil: (promise) => {
            waits.push(Promise.resolve(promise));
        },
    });

    assert.equal(waits.length, 1);
    await Promise.all(waits);

    return { closed };
}

async function dispatchClose(harness, notification) {
    const handler = harness.handlers.get('notificationclose');
    assert.equal(typeof handler, 'function');
    const waits = [];

    handler({
        notification: {
            data: notification.options.data,
        },
        waitUntil: (promise) => {
            waits.push(Promise.resolve(promise));
        },
    });

    assert.equal(waits.length, 1);
    await Promise.all(waits);
}

test('shows a fallback notification when push payload data is missing', async () => {
    const harness = await createHarness();
    const notification = await dispatchPush(harness);

    assert.equal(notification.title, 'Gredice');
    assert.equal(notification.options.body, '');
    assert.equal(notification.options.data.url, origin);
});

test('shows a fallback notification when push payload JSON is malformed', async () => {
    const harness = await createHarness();
    const notification = await dispatchPush(harness, {
        json: () => {
            throw new Error('malformed payload');
        },
    });

    assert.equal(notification.title, 'Gredice');
    assert.equal(notification.options.data.url, origin);
});

test('stores same-origin action URLs in notification data, not action options', async () => {
    const harness = await createHarness();
    const notification = await dispatchPush(harness, {
        json: () => ({
            actions: [
                {
                    action: 'open-cart',
                    title: 'Košarica',
                    url: '/kosarica',
                },
            ],
            deliveryAttemptId: 42,
            notificationId: 'notification-1',
            title: 'Test obavijest',
            url: '/obavijesti',
        }),
    });

    assert.equal(notification.options.data.url, `${origin}/obavijesti`);
    assert.equal(
        notification.options.data.actionUrls['open-cart'],
        `${origin}/kosarica`,
    );
    assert.equal(notification.options.actions.length, 1);
    assert.equal(notification.options.actions[0].action, 'open-cart');
    assert.equal(notification.options.actions[0].title, 'Košarica');
    assert.equal(notification.options.actions[0].icon, undefined);
    assert.equal(notification.options.actions[0].url, undefined);

    await dispatchClick(harness, notification, 'open-cart');

    assert.deepEqual(harness.openedUrls, [`${origin}/kosarica`]);
    assert.equal(harness.fetchRequests.length, 1);
    assert.equal(harness.fetchRequests[0].url, '/api/notifications/events');
    assert.equal(
        JSON.parse(harness.fetchRequests[0].init.body).action,
        'open-cart',
    );
    assert.equal(
        JSON.parse(harness.fetchRequests[0].init.body).deliveryAttemptId,
        42,
    );
});

test('ignores unsafe default and action URLs', async () => {
    const harness = await createHarness();
    const notification = await dispatchPush(harness, {
        json: () => ({
            actions: [
                {
                    action: 'external',
                    title: 'Vanjska poveznica',
                    url: 'https://example.com/phishing',
                },
            ],
            title: 'Test obavijest',
            url: 'javascript:alert(1)',
        }),
    });

    assert.equal(notification.options.data.url, origin);
    assert.equal(notification.options.data.actionUrls, undefined);
    assert.equal(notification.options.actions.length, 1);
    assert.equal(notification.options.actions[0].action, 'external');
    assert.equal(notification.options.actions[0].title, 'Vanjska poveznica');
    assert.equal(notification.options.actions[0].icon, undefined);
    assert.equal(notification.options.actions[0].url, undefined);

    await dispatchClick(harness, notification, 'external');

    assert.deepEqual(harness.openedUrls, [`${origin}/`]);
});

test('focuses an existing client for a matching action deep link', async () => {
    const targetUrl = `${origin}/vrt/aktivnosti`;
    const harness = await createHarness({
        clients: [{ url: targetUrl }],
    });
    const notification = await dispatchPush(harness, {
        json: () => ({
            actions: [
                {
                    action: 'open-activity',
                    title: 'Otvori',
                    url: '/vrt/aktivnosti',
                },
            ],
            title: 'Test obavijest',
            url: '/obavijesti',
        }),
    });

    const click = await dispatchClick(harness, notification, 'open-activity');

    assert.equal(click.closed, true);
    assert.deepEqual(harness.focusedUrls, [targetUrl]);
    assert.deepEqual(harness.openedUrls, []);
});

test('emits dismissed analytics for notification close with normalized attempt id', async () => {
    const harness = await createHarness();
    const notification = await dispatchPush(harness, {
        json: () => ({
            deliveryAttemptId: '77',
            notificationId: 'notification-1',
            title: 'Test obavijest',
        }),
    });

    await dispatchClose(harness, notification);

    assert.equal(harness.fetchRequests.length, 1);
    const body = JSON.parse(harness.fetchRequests[0].init.body);
    assert.equal(body.type, 'dismissed');
    assert.equal(body.notificationId, 'notification-1');
    assert.equal(body.deliveryAttemptId, 77);
});
