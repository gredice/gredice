import assert from 'node:assert/strict';
import test from 'node:test';
import {
    type BrowserPushSubscription,
    type PushDeviceRegistrationPayload,
    pushSubscriptionPayload,
    subscribePushDevice,
    urlBase64ToUint8Array,
} from '../src/push';

function mockSubscription(
    endpoint = 'https://example.com/push',
): BrowserPushSubscription {
    return {
        endpoint,
        toJSON: () => ({
            endpoint,
            keys: {
                auth: 'auth-key',
                p256dh: 'p256dh-key',
            },
        }),
    };
}

test('urlBase64ToUint8Array decodes URL-safe VAPID keys', () => {
    const bytes = urlBase64ToUint8Array('SGVsbG8td29ybGQ');
    const decoded = new TextDecoder().decode(bytes);

    assert.equal(decoded, 'Hello-world');
});

test('pushSubscriptionPayload serializes endpoint and device metadata', () => {
    const payload = pushSubscriptionPayload(mockSubscription(), {
        deviceId: 'farm-device-1',
        deviceLabel: 'Ovaj uređaj (MacIntel)',
        locale: 'hr-HR',
        platform: 'MacIntel',
        timezone: 'Europe/Zagreb',
        userAgent: 'Farm test browser',
    });

    assert.deepEqual(payload, {
        deviceId: 'farm-device-1',
        deviceLabel: 'Ovaj uređaj (MacIntel)',
        endpoint: 'https://example.com/push',
        keys: {
            auth: 'auth-key',
            p256dh: 'p256dh-key',
        },
        locale: 'hr-HR',
        permissionState: 'granted',
        platform: 'MacIntel',
        timezone: 'Europe/Zagreb',
        userAgent: 'Farm test browser',
    });
});

test('pushSubscriptionPayload falls back to the subscription endpoint', () => {
    const payload = pushSubscriptionPayload(
        {
            endpoint: 'https://example.com/fallback-push',
            toJSON: () => ({
                keys: {
                    auth: 'auth-key',
                    p256dh: 'p256dh-key',
                },
            }),
        },
        { deviceId: 'farm-device-1' },
    );

    assert.equal(payload?.endpoint, 'https://example.com/fallback-push');
});

test('pushSubscriptionPayload rejects subscriptions without key material', () => {
    const payload = pushSubscriptionPayload(
        {
            endpoint: 'https://example.com/push',
            toJSON: () => ({
                endpoint: 'https://example.com/push',
                keys: {
                    auth: 'auth-key',
                },
            }),
        },
        {},
    );

    assert.equal(payload, null);
});

test('subscribePushDevice reuses and persists an existing browser subscription', async () => {
    const persisted: PushDeviceRegistrationPayload[] = [];
    const payload = await subscribePushDevice({
        applicationServerKey: 'SGVsbG8td29ybGQ',
        metadata: { deviceId: 'farm-device-1' },
        persistSubscription: async (subscriptionPayload) => {
            persisted.push(subscriptionPayload);
        },
        pushManager: {
            getSubscription: async () => mockSubscription(),
            subscribe: async () => {
                throw new Error('Should not create a new subscription');
            },
        },
    });

    assert.equal(payload.endpoint, 'https://example.com/push');
    assert.equal(persisted.length, 1);
    assert.equal(persisted[0].deviceId, 'farm-device-1');
});

test('subscribePushDevice creates and persists a new browser subscription', async () => {
    let subscribeCalled = false;
    const persisted: PushDeviceRegistrationPayload[] = [];
    const payload = await subscribePushDevice({
        applicationServerKey: 'SGVsbG8td29ybGQ',
        metadata: {},
        persistSubscription: async (subscriptionPayload) => {
            persisted.push(subscriptionPayload);
        },
        pushManager: {
            getSubscription: async () => null,
            subscribe: async (options) => {
                subscribeCalled = true;
                assert.equal(options?.userVisibleOnly, true);
                assert.ok(options?.applicationServerKey instanceof Uint8Array);
                assert.equal(options.applicationServerKey.byteLength, 11);
                return mockSubscription('https://example.com/new-push');
            },
        },
    });

    assert.equal(subscribeCalled, true);
    assert.equal(payload.endpoint, 'https://example.com/new-push');
    assert.equal(persisted.length, 1);
});
