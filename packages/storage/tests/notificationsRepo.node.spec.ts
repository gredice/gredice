import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from './testDb';
import { createNotification, getNotificationsByAccount } from '@gredice/storage';
import { createTestAccount } from './helpers/testHelpers';

test('createNotification and getNotificationsByAccount basic usage', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const notificationId = await createNotification({ accountId, header: 'Test', content: 'Test notification' });
    const notifications = await getNotificationsByAccount(accountId);
    assert.ok(Array.isArray(notifications));
    assert.ok(notifications.some((n: any) => n.id === notificationId));
});
