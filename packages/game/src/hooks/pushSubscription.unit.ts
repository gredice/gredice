import assert from 'node:assert/strict';
import test from 'node:test';
import {
    type BrowserPushSubscription,
    browserPushNeedsSubscriptionRecovery,
    currentPushDevicePermissionReconciliation,
    type PushDeviceRegistrationPayload,
    pushDeviceNeedsSubscriptionRecovery,
    pushSubscriptionPayload,
    subscribePushDevice,
    urlBase64ToUint8Array,
} from './pushSubscription';

function mockSubscription(
    endpoint = 'https://example.com/push',
    unsubscribe: () => Promise<boolean> = async () => true,
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
        unsubscribe,
    };
}

test('urlBase64ToUint8Array decodes URL-safe VAPID keys', () => {
    const bytes = urlBase64ToUint8Array('SGVsbG8td29ybGQ');
    const decoded = new TextDecoder().decode(bytes);

    assert.equal(decoded, 'Hello-world');
});

test('pushSubscriptionPayload serializes endpoint and keys with metadata', () => {
    const payload = pushSubscriptionPayload(mockSubscription(), {
        deviceId: 'device-1',
        locale: 'hr-HR',
        timezone: 'Europe/Zagreb',
    });

    assert.deepEqual(payload, {
        deviceId: 'device-1',
        endpoint: 'https://example.com/push',
        keys: {
            auth: 'auth-key',
            p256dh: 'p256dh-key',
        },
        locale: 'hr-HR',
        permissionState: 'granted',
        timezone: 'Europe/Zagreb',
    });
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
            unsubscribe: async () => true,
        },
        {},
    );

    assert.equal(payload, null);
});

test('subscribePushDevice reuses and persists an existing browser subscription', async () => {
    const persisted: PushDeviceRegistrationPayload[] = [];
    const payload = await subscribePushDevice({
        applicationServerKey: 'SGVsbG8td29ybGQ',
        metadata: { deviceId: 'device-1' },
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
    assert.equal(persisted[0].deviceId, 'device-1');
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

test('push recovery is required for revoked or non-granted server devices', () => {
    assert.equal(
        pushDeviceNeedsSubscriptionRecovery({
            permissionState: 'granted',
            revokedAt: null,
        }),
        false,
    );
    assert.equal(
        pushDeviceNeedsSubscriptionRecovery({
            permissionState: 'granted',
            revokedAt: '2026-07-16T12:00:00.000Z',
        }),
        true,
    );
    assert.equal(
        pushDeviceNeedsSubscriptionRecovery({
            permissionState: 'denied',
            revokedAt: null,
        }),
        true,
    );
    assert.equal(pushDeviceNeedsSubscriptionRecovery({}), true);
});

test('browser permission loss reconciles only the current push device', () => {
    const devices = [
        {
            deviceId: 'current-device',
            enabled: true,
            id: 'current-subscription',
            permissionState: 'granted',
            revokedAt: null,
        },
        {
            deviceId: 'secondary-device',
            enabled: true,
            id: 'secondary-subscription',
            permissionState: 'granted',
            revokedAt: null,
        },
    ];

    assert.deepEqual(
        currentPushDevicePermissionReconciliation({
            browserPermission: 'denied',
            currentDeviceId: 'current-device',
            devices,
        }),
        {
            id: 'current-subscription',
            permissionState: 'denied',
        },
    );
    assert.deepEqual(
        currentPushDevicePermissionReconciliation({
            browserPermission: 'default',
            currentDeviceId: 'current-device',
            devices,
        }),
        {
            id: 'current-subscription',
            permissionState: 'default',
        },
    );
});

test('browser permission reconciliation is idempotent and never re-enables a device', () => {
    assert.equal(
        currentPushDevicePermissionReconciliation({
            browserPermission: 'denied',
            currentDeviceId: 'current-device',
            devices: [
                {
                    deviceId: 'current-device',
                    enabled: false,
                    id: 'current-subscription',
                    permissionState: 'denied',
                    revokedAt: null,
                },
            ],
        }),
        null,
    );
    assert.equal(
        currentPushDevicePermissionReconciliation({
            browserPermission: 'granted',
            currentDeviceId: 'current-device',
            devices: [
                {
                    deviceId: 'current-device',
                    enabled: false,
                    id: 'current-subscription',
                    permissionState: 'default',
                    revokedAt: null,
                },
            ],
        }),
        null,
    );
});

test('browser push recovery requires an exact live subscription after checks', () => {
    const cases = [
        {
            expected: true,
            status: 'failed',
            subscriptionChecked: false,
        },
        {
            expected: true,
            status: 'failed',
            subscriptionChecked: true,
        },
        {
            expected: true,
            status: 'denied',
            subscriptionChecked: false,
        },
        {
            expected: true,
            status: 'granted',
            subscriptionChecked: true,
        },
        {
            expected: true,
            status: 'default',
            subscriptionChecked: true,
        },
        {
            expected: true,
            status: 'prompt-dismissed',
            subscriptionChecked: true,
        },
        {
            expected: true,
            status: 'unsupported',
            subscriptionChecked: true,
        },
        {
            expected: true,
            status: 'unconfigured',
            subscriptionChecked: true,
        },
        {
            expected: false,
            status: 'granted',
            subscriptionChecked: false,
        },
        {
            expected: false,
            status: 'subscribed',
            subscriptionChecked: true,
        },
    ];

    for (const recoveryCase of cases) {
        assert.equal(
            browserPushNeedsSubscriptionRecovery(recoveryCase),
            recoveryCase.expected,
            `expected ${recoveryCase.status} (checked: ${recoveryCase.subscriptionChecked}) recovery to be ${recoveryCase.expected}`,
        );
    }
});

test('push recovery unsubscribes the stale endpoint before persisting a replacement', async () => {
    const operations: string[] = [];
    const stale = mockSubscription(
        'https://example.com/stale-push',
        async () => {
            operations.push('unsubscribe-stale');
            return true;
        },
    );
    const fresh = mockSubscription('https://example.com/fresh-push');

    const payload = await subscribePushDevice({
        applicationServerKey: 'SGVsbG8td29ybGQ',
        metadata: { deviceId: 'device-1' },
        persistSubscription: async ({ endpoint }) => {
            operations.push(`persist:${endpoint}`);
        },
        pushManager: {
            getSubscription: async () => stale,
            subscribe: async () => {
                operations.push('subscribe-fresh');
                return fresh;
            },
        },
        replaceExistingSubscription: true,
    });

    assert.equal(payload.endpoint, 'https://example.com/fresh-push');
    assert.deepEqual(operations, [
        'unsubscribe-stale',
        'subscribe-fresh',
        'persist:https://example.com/fresh-push',
    ]);
});

test('push recovery does not re-register an endpoint that could not be removed', async () => {
    let subscribeCalled = false;
    let persistCalled = false;

    await assert.rejects(
        subscribePushDevice({
            applicationServerKey: 'SGVsbG8td29ybGQ',
            metadata: {},
            persistSubscription: async () => {
                persistCalled = true;
            },
            pushManager: {
                getSubscription: async () =>
                    mockSubscription(
                        'https://example.com/stale-push',
                        async () => false,
                    ),
                subscribe: async () => {
                    subscribeCalled = true;
                    return mockSubscription();
                },
            },
            replaceExistingSubscription: true,
        }),
        /could not be removed/,
    );

    assert.equal(subscribeCalled, false);
    assert.equal(persistCalled, false);
});
