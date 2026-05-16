import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    cancelNotificationCampaign,
    createNotification,
    createNotificationCampaign,
    createUserWithPassword,
    enqueueNotificationCampaign,
    gardens,
    getNotificationCampaign,
    getNotificationsByAccount,
    getUser,
    notifications,
    previewNotificationCampaignAudience,
    routeNotificationDelivery,
    storage,
} from '@gredice/storage';
import { eq } from 'drizzle-orm';
import {
    createTestAccount,
    createTestGarden,
    ensureFarmId,
} from './helpers/testHelpers';
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

test('notification campaign enqueue records queue intent without synchronous fan-out', async () => {
    createTestDb();
    await ensureFarmId();
    const userName = `campaign-${randomUUID()}@example.com`;
    const userId = await createUserWithPassword(userName, 'password');
    const user = await getUser(userId);
    assert.ok(user);
    const accountId = user.accounts[0]?.accountId;
    assert.ok(accountId);

    const preview = await previewNotificationCampaignAudience({
        type: 'accounts',
        accountIds: [accountId],
    });
    assert.equal(preview.targetCount, 1);
    assert.equal(preview.accountCount, 1);
    assert.equal(preview.userCount, 1);

    const campaignId = await createNotificationCampaign({
        name: 'Feature release',
        audience: { type: 'accounts', accountIds: [accountId] },
        channelPolicy: {
            inApp: true,
            email: true,
            push: false,
            digest: true,
            required: false,
            respectPreferences: true,
        },
        header: 'Feature release',
        content: 'New feature announcement',
        category: 'admin_campaigns',
        eventType: 'feature_release_note',
        primaryChannel: 'in_app',
        priority: 'normal',
        metadata: {},
        deliveryMetadata: {},
        scheduledAt: null,
        createdByUserId: userId,
        createdFromAccountId: accountId,
    });

    const campaign = await getNotificationCampaign(campaignId);
    assert.equal(campaign?.status, 'draft');

    const enqueued = await enqueueNotificationCampaign({
        id: campaignId,
        requestedByUserId: userId,
    });
    assert.equal(enqueued?.status, 'queued');
    assert.equal(enqueued?.targetCount, 1);
    assert.equal(enqueued?.queuedCount, 1);
    assert.equal(enqueued?.sentCount, 0);

    const fanOutNotifications = await storage()
        .select({ id: notifications.id })
        .from(notifications)
        .where(eq(notifications.campaignId, campaignId));
    assert.equal(fanOutNotifications.length, 0);
});

test('scheduled notification campaign can be cancelled before fan-out', async () => {
    createTestDb();
    await ensureFarmId();
    const userName = `scheduled-campaign-${randomUUID()}@example.com`;
    const userId = await createUserWithPassword(userName, 'password');
    const user = await getUser(userId);
    assert.ok(user);
    const accountId = user.accounts[0]?.accountId;
    assert.ok(accountId);

    const campaignId = await createNotificationCampaign({
        name: 'Maintenance window',
        audience: { type: 'users', userIds: [userId], accountIds: [accountId] },
        channelPolicy: {
            inApp: true,
            email: true,
            push: true,
            digest: false,
            required: true,
            respectPreferences: false,
        },
        header: 'Maintenance window',
        content: 'Scheduled maintenance starts later today.',
        category: 'admin_campaigns',
        eventType: 'maintenance_window',
        primaryChannel: 'in_app',
        priority: 'high',
        metadata: {},
        deliveryMetadata: {},
        scheduledAt: null,
        createdByUserId: userId,
        createdFromAccountId: accountId,
    });
    const scheduledAt = new Date(Date.now() + 60 * 60 * 1000);

    const scheduled = await enqueueNotificationCampaign({
        id: campaignId,
        requestedByUserId: userId,
        scheduledAt,
    });
    assert.equal(scheduled?.status, 'scheduled');
    assert.equal(scheduled?.targetCount, 1);
    assert.equal(scheduled?.queuedCount, 0);

    const cancelled = await cancelNotificationCampaign({
        id: campaignId,
        cancelledByUserId: userId,
    });
    assert.equal(cancelled?.status, 'cancelled');
    assert.equal(cancelled?.queuedCount, 0);
    assert.ok(cancelled?.cancelledAt);
});

test('explicit notification campaign audience excludes deleted gardens', async () => {
    createTestDb();
    const farmId = await ensureFarmId();
    const userName = `deleted-garden-campaign-${randomUUID()}@example.com`;
    const userId = await createUserWithPassword(userName, 'password');
    const user = await getUser(userId);
    assert.ok(user);
    const accountId = user.accounts[0]?.accountId;
    assert.ok(accountId);
    const gardenId = await createTestGarden({
        accountId,
        farmId,
        name: 'Deleted campaign target garden',
    });

    await storage()
        .update(gardens)
        .set({ isDeleted: true })
        .where(eq(gardens.id, gardenId));

    const preview = await previewNotificationCampaignAudience({
        type: 'explicit',
        recipients: [{ accountId, userId, gardenId }],
    });

    assert.equal(preview.explicitRecipientCount, 1);
    assert.equal(preview.targetCount, 0);
    assert.equal(preview.accountCount, 0);
    assert.equal(preview.userCount, 0);
    assert.equal(preview.gardenCount, 0);
    assert.equal(preview.unmatchedRecipientCount, 1);
});
