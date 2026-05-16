import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createNotification,
    getNotificationsByAccount,
    routeNotificationDelivery,
} from '@gredice/storage';
import { createTestAccount } from './helpers/testHelpers';
import { createTestDb } from './testDb';

test('createNotification and getNotificationsByAccount basic usage', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const notificationId = await createNotification({
        accountId,
        header: 'Test',
        content: 'Test notification',
        timestamp: new Date(),
    });
    const notifications = await getNotificationsByAccount(
        accountId,
        false,
        0,
        10000,
    );
    assert.ok(Array.isArray(notifications));
    assert.ok(notifications.some((n) => n.id === notificationId));
});

test('routeNotificationDelivery returns default immediate email and suppressed push without subscription', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const notificationId = await createNotification({
        accountId,
        header: 'Routing',
        content: 'Routing notification',
        category: 'general',
        timestamp: new Date(),
    });
    const decisions = await routeNotificationDelivery(notificationId);
    assert.equal(decisions.length, 2);
    assert.ok(
        decisions.some(
            (decision) =>
                decision.channel === 'email' &&
                decision.outcome === 'immediate',
        ),
    );
    assert.ok(
        decisions.some(
            (decision) =>
                decision.channel === 'push' &&
                decision.outcome === 'suppressed',
        ),
    );
});
