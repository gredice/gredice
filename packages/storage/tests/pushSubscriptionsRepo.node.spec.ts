import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import {
    createUserWithPassword,
    getPushSubscriptionsForNotification,
    getUser,
    removePushSubscription,
    savePushSubscription,
} from '@gredice/storage';
import { createTestDb } from './testDb';

function toBase64Url(buffer: Buffer) {
    return buffer
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

test('savePushSubscription upserts and retrieves subscriptions', async () => {
    createTestDb();
    const email = `push-user-${Date.now()}@example.com`;
    const userId = await createUserWithPassword(email, 'password');
    const user = await getUser(userId);
    assert.ok(user);
    const accountId = user.accounts[0]?.accountId;
    assert.ok(accountId);

    const endpoint = 'https://example.com/push/test';
    const keys = {
        p256dh: toBase64Url(randomBytes(65)),
        auth: toBase64Url(randomBytes(16)),
    };

    await savePushSubscription({
        accountId,
        userId,
        endpoint,
        keys,
        expirationTime: new Date(),
        userAgent: 'initial-agent',
        platform: 'test-platform',
    });

    let subscriptions = await getPushSubscriptionsForNotification({
        accountId,
        userId,
    });
    assert.equal(subscriptions.length, 1);
    assert.equal(subscriptions[0]?.userAgent, 'initial-agent');

    await savePushSubscription({
        accountId,
        userId,
        endpoint,
        keys,
        userAgent: 'updated-agent',
    });

    subscriptions = await getPushSubscriptionsForNotification({
        accountId,
        userId,
    });
    assert.equal(subscriptions.length, 1);
    assert.equal(subscriptions[0]?.userAgent, 'updated-agent');

    await removePushSubscription(endpoint, accountId);
    subscriptions = await getPushSubscriptionsForNotification({
        accountId,
        userId,
    });
    assert.equal(subscriptions.length, 0);
});
