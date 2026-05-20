import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    cancelNotificationCampaign,
    cleanupNotificationRetention,
    createNotification,
    createNotificationCampaign,
    createUserWithPassword,
    enqueueNotificationCampaign,
    enqueuePushDeliveryAttemptsForNotification,
    gardens,
    getNotificationCampaign,
    getNotificationDeliverySummary,
    getNotificationsByAccount,
    getUser,
    notificationCampaigns,
    notificationDeliveryAttempts,
    notifications,
    previewNotificationCampaignAudience,
    recordNotificationDeliveryEvent,
    routeNotificationDelivery,
    storage,
    webPushSubscriptions,
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

test('enqueuePushDeliveryAttemptsForNotification queues enabled subscriptions idempotently', async () => {
    createTestDb();
    await ensureFarmId();
    const userName = `push-queue-${randomUUID()}@example.com`;
    const userId = await createUserWithPassword(userName, 'password');
    const user = await getUser(userId);
    assert.ok(user);
    const accountId = user.accounts[0]?.accountId;
    assert.ok(accountId);

    const subscriptionId = randomUUID();
    await storage().execute(
        `insert into web_push_subscriptions (id, account_id, user_id, endpoint, p256dh, auth, enabled)
         values ('${subscriptionId}', '${accountId}', '${userId}', 'https://example.com/sub', 'k', 'a', true)`,
    );

    const notificationId = await createNotification({
        accountId,
        userId,
        header: 'Push queued',
        content: 'Queue push delivery',
        category: 'general',
        timestamp: new Date(),
    });

    const first = await enqueuePushDeliveryAttemptsForNotification({
        notificationId,
    });
    assert.equal(first.queued, 1);

    const second = await enqueuePushDeliveryAttemptsForNotification({
        notificationId,
    });
    assert.equal(second.queued, 0);
    assert.equal(second.skipped, 1);
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

test('notification retention cleanup deletes old terminal campaigns', async () => {
    createTestDb();
    await ensureFarmId();
    const userName = `retention-campaign-${randomUUID()}@example.com`;
    const userId = await createUserWithPassword(userName, 'password');
    const user = await getUser(userId);
    assert.ok(user);
    const accountId = user.accounts[0]?.accountId;
    assert.ok(accountId);

    async function createCampaignWithStatus(
        status: 'sent' | 'cancelled' | 'failed' | 'queued',
        updatedAt: Date,
    ) {
        const id = await createNotificationCampaign({
            name: `Retention ${status} ${randomUUID()}`,
            audience: { type: 'accounts', accountIds: [accountId] },
            channelPolicy: {
                inApp: true,
                email: false,
                push: false,
                digest: false,
                required: false,
                respectPreferences: true,
            },
            header: 'Retention cleanup',
            content: 'Retention cleanup campaign',
            category: 'admin_campaigns',
            eventType: 'retention_cleanup',
            primaryChannel: 'in_app',
            priority: 'normal',
            metadata: {},
            deliveryMetadata: {},
            scheduledAt: null,
            createdByUserId: userId,
            createdFromAccountId: accountId,
        });

        await storage()
            .update(notificationCampaigns)
            .set({ status, updatedAt })
            .where(eq(notificationCampaigns.id, id));

        return id;
    }

    const oldDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    const freshDate = new Date();
    const oldSentId = await createCampaignWithStatus('sent', oldDate);
    const oldCancelledId = await createCampaignWithStatus('cancelled', oldDate);
    const oldFailedId = await createCampaignWithStatus('failed', oldDate);
    const oldQueuedId = await createCampaignWithStatus('queued', oldDate);
    const freshSentId = await createCampaignWithStatus('sent', freshDate);

    const result = await cleanupNotificationRetention({
        deleteTerminalCampaignsOlderThanDays: 365,
    });

    assert.equal(result.campaignsDeleted, 3);
    assert.equal(await getNotificationCampaign(oldSentId), undefined);
    assert.equal(await getNotificationCampaign(oldCancelledId), undefined);
    assert.equal(await getNotificationCampaign(oldFailedId), undefined);
    assert.ok(await getNotificationCampaign(oldQueuedId));
    assert.ok(await getNotificationCampaign(freshSentId));
});

test('notification delivery summary tracks attempts and engagement events', async () => {
    createTestDb();
    await ensureFarmId();
    const userName = `delivery-summary-${randomUUID()}@example.com`;
    const userId = await createUserWithPassword(userName, 'password');
    const user = await getUser(userId);
    assert.ok(user);
    const accountId = user.accounts[0]?.accountId;
    assert.ok(accountId);

    const notificationId = await createNotification({
        accountId,
        userId,
        header: 'Push analytics',
        content: 'Track delivery analytics',
        category: 'general',
        timestamp: new Date(),
    });
    const sub1Id = randomUUID();
    const sub2Id = randomUUID();
    await storage().execute(
        `insert into web_push_subscriptions (id, account_id, user_id, endpoint, p256dh, auth, enabled)
         values ('${sub1Id}', '${accountId}', '${userId}', 'https://example.com/${sub1Id}', 'k', 'a', true),
                ('${sub2Id}', '${accountId}', '${userId}', 'https://example.com/${sub2Id}', 'k', 'a', true)`,
    );

    const emailAttempt = await storage()
        .insert(notificationDeliveryAttempts)
        .values({
            notificationId,
            userId,
            accountId,
            channel: 'email',
            status: 'failed',
        })
        .returning({ id: notificationDeliveryAttempts.id });

    const attemptRows = await storage()
        .insert(notificationDeliveryAttempts)
        .values([
            {
                notificationId,
                userId,
                accountId,
                channel: 'push',
                status: 'accepted',
                pushSubscriptionId: sub1Id,
            },
            {
                notificationId,
                userId,
                accountId,
                channel: 'push',
                status: 'failed',
                pushSubscriptionId: sub1Id,
            },
            {
                notificationId,
                userId,
                accountId,
                channel: 'push',
                status: 'sent',
                pushSubscriptionId: sub2Id,
            },
        ])
        .returning({ id: notificationDeliveryAttempts.id });

    await recordNotificationDeliveryEvent({
        notificationId,
        deliveryAttemptId: attemptRows[0].id,
        type: 'opened',
    });
    await recordNotificationDeliveryEvent({
        notificationId,
        deliveryAttemptId: attemptRows[0].id,
        type: 'clicked',
    });
    await recordNotificationDeliveryEvent({
        notificationId,
        deliveryAttemptId: attemptRows[1].id,
        type: 'failed',
    });
    await recordNotificationDeliveryEvent({
        notificationId,
        deliveryAttemptId: attemptRows[2].id,
        type: 'dismissed',
    });
    await recordNotificationDeliveryEvent({
        notificationId,
        deliveryAttemptId: attemptRows[2].id,
        type: 'unsubscribed',
    });

    const summary = await getNotificationDeliverySummary(notificationId);
    assert.equal(summary.sent, 1);
    assert.equal(summary.accepted, 1);
    assert.equal(summary.failed, 1);
    assert.equal(summary.retried, 1);
    assert.equal(summary.opened, 1);
    assert.equal(summary.clicked, 1);
    assert.equal(summary.dismissed, 1);
    assert.equal(summary.invalidated, 1);
    assert.equal(summary.unsubscribed, 1);
    assert.notEqual(emailAttempt[0].id, attemptRows[0].id);
});

test('recordNotificationDeliveryEvent rejects mismatched notification and attempt ids', async () => {
    createTestDb();
    await ensureFarmId();
    const firstUserName = `delivery-event-first-${randomUUID()}@example.com`;
    const firstUserId = await createUserWithPassword(firstUserName, 'password');
    const firstUser = await getUser(firstUserId);
    assert.ok(firstUser);
    const firstAccountId = firstUser.accounts[0]?.accountId;
    assert.ok(firstAccountId);

    const secondUserName = `delivery-event-second-${randomUUID()}@example.com`;
    const secondUserId = await createUserWithPassword(
        secondUserName,
        'password',
    );
    const secondUser = await getUser(secondUserId);
    assert.ok(secondUser);
    const secondAccountId = secondUser.accounts[0]?.accountId;
    assert.ok(secondAccountId);

    const firstNotificationId = await createNotification({
        accountId: firstAccountId,
        userId: firstUserId,
        header: 'First',
        content: 'First notification',
        category: 'general',
        timestamp: new Date(),
    });
    const secondNotificationId = await createNotification({
        accountId: secondAccountId,
        userId: secondUserId,
        header: 'Second',
        content: 'Second notification',
        category: 'general',
        timestamp: new Date(),
    });

    const secondAttempt = await storage()
        .insert(notificationDeliveryAttempts)
        .values({
            notificationId: secondNotificationId,
            userId: secondUserId,
            accountId: secondAccountId,
            channel: 'push',
            status: 'accepted',
        })
        .returning({ id: notificationDeliveryAttempts.id });

    await assert.rejects(
        recordNotificationDeliveryEvent({
            notificationId: firstNotificationId,
            deliveryAttemptId: secondAttempt[0].id,
            type: 'opened',
        }),
        /does not belong to the provided notification/u,
    );
});

test('enqueuePushDeliveryAttemptsForNotification skips revoked subscriptions', async () => {
    createTestDb();
    await ensureFarmId();
    const userName = `push-revoked-${randomUUID()}@example.com`;
    const userId = await createUserWithPassword(userName, 'password');
    const user = await getUser(userId);
    assert.ok(user);
    const accountId = user.accounts[0]?.accountId;
    assert.ok(accountId);

    await storage().execute(
        `insert into web_push_subscriptions (id, account_id, user_id, endpoint, p256dh, auth, enabled, revoked_at)
         values ('${randomUUID()}', '${accountId}', '${userId}', 'https://example.com/revoked', 'k', 'a', true, now())`,
    );

    const notificationId = await createNotification({
        accountId,
        userId,
        header: 'Push revoked',
        content: 'Revoked subscriptions should not queue',
        category: 'general',
        timestamp: new Date(),
    });

    const result = await enqueuePushDeliveryAttemptsForNotification({
        notificationId,
    });

    assert.equal(result.queued, 0);
    assert.equal(result.skipped, 0);
});

test('cleanupNotificationRetention disables denied and default subscriptions', async () => {
    createTestDb();
    await ensureFarmId();
    const userName = `push-cleanup-${randomUUID()}@example.com`;
    const userId = await createUserWithPassword(userName, 'password');
    const user = await getUser(userId);
    assert.ok(user);
    const accountId = user.accounts[0]?.accountId;
    assert.ok(accountId);

    const deniedSubscriptionId = randomUUID();
    const defaultSubscriptionId = randomUUID();
    await storage().execute(
        `insert into web_push_subscriptions (id, account_id, user_id, endpoint, p256dh, auth, enabled, permission_state, fail_count)
         values ('${deniedSubscriptionId}', '${accountId}', '${userId}', 'https://example.com/denied', 'k', 'a', true, 'denied', 0)`,
    );
    await storage().execute(
        `insert into web_push_subscriptions (id, account_id, user_id, endpoint, p256dh, auth, enabled, permission_state, fail_count)
         values ('${defaultSubscriptionId}', '${accountId}', '${userId}', 'https://example.com/default', 'k', 'a', true, 'default', 0)`,
    );

    const cleanup = await cleanupNotificationRetention();
    assert.ok(cleanup.subscriptionsDisabled >= 2);
    const deniedSubscription =
        await storage().query.webPushSubscriptions.findFirst({
            where: eq(webPushSubscriptions.id, deniedSubscriptionId),
        });
    const defaultSubscription =
        await storage().query.webPushSubscriptions.findFirst({
            where: eq(webPushSubscriptions.id, defaultSubscriptionId),
        });
    assert.equal(deniedSubscription?.enabled, false);
    assert.equal(deniedSubscription?.revokedReason, 'retention_cleanup');
    assert.ok(deniedSubscription?.revokedAt);
    assert.equal(defaultSubscription?.enabled, false);
    assert.equal(defaultSubscription?.revokedReason, 'retention_cleanup');
    assert.ok(defaultSubscription?.revokedAt);
});
