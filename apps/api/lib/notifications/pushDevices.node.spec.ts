import assert from 'node:assert/strict';
import test from 'node:test';
import { pushDeviceResponse, pushDeviceUpsertSchema } from './pushDevices';

const validPayload = {
    endpoint: 'https://updates.push.services.mozilla.com/push/v1/example',
    keys: {
        p256dh: 'BOr4wQf8XUTKq7s-A0pL_FakeKeyForTests',
        auth: 'n6Xx_FakeAuth',
    },
    deviceId: 'device-1',
    deviceLabel: 'Ovaj uređaj',
    locale: 'hr-HR',
    permissionState: 'granted',
    platform: 'MacIntel',
    timezone: 'Europe/Zagreb',
    userAgent: 'Mozilla/5.0',
};

test('pushDeviceUpsertSchema accepts a browser push subscription payload', () => {
    const result = pushDeviceUpsertSchema.safeParse(validPayload);

    assert.equal(result.success, true);
});

test('pushDeviceUpsertSchema rejects non-HTTPS endpoints', () => {
    const result = pushDeviceUpsertSchema.safeParse({
        ...validPayload,
        endpoint: 'http://example.com/push',
    });

    assert.equal(result.success, false);
});

test('pushDeviceUpsertSchema rejects malformed key material', () => {
    const result = pushDeviceUpsertSchema.safeParse({
        ...validPayload,
        keys: {
            p256dh: 'not valid+base64',
            auth: 'n6Xx_FakeAuth',
        },
    });

    assert.equal(result.success, false);
});

test('pushDeviceResponse omits endpoint and subscription keys', () => {
    const now = new Date('2026-05-20T10:00:00.000Z');
    const response = pushDeviceResponse({
        browserName: null,
        browserVersion: null,
        createdAt: now,
        deviceId: 'device-1',
        deviceLabel: 'Ovaj uređaj',
        enabled: true,
        failCount: 0,
        id: 'subscription-1',
        lastFailureAt: null,
        lastFailureCode: null,
        lastFailureReason: null,
        lastSeenAt: now,
        lastSuccessAt: null,
        locale: 'hr-HR',
        permissionState: 'granted',
        platform: 'MacIntel',
        revokedAt: null,
        revokedReason: null,
        timezone: 'Europe/Zagreb',
        updatedAt: now,
        userAgent: 'Mozilla/5.0',
    });

    assert.equal('endpoint' in response, false);
    assert.equal('p256dh' in response, false);
    assert.equal('auth' in response, false);
    assert.equal(response.id, 'subscription-1');
});
