import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    accountUsers,
    backfillNotificationRolloutDefaults,
    cancelNotificationCampaign,
    claimDeliveryLifecycleEmailCandidate,
    cleanupNotificationRetention,
    createNotification,
    createNotificationCampaign,
    createNotificationWithOutcome,
    createUserWithPassword,
    dropDeliveryLifecycleEmailAttempt,
    enqueueNotificationCampaign,
    enqueuePushDeliveryAttemptsForNotification,
    gardens,
    getDeliveryLifecycleEmailCandidates,
    getDeliveryLifecycleNotificationHealth,
    getNotificationCampaign,
    getNotificationDeliverySummary,
    getNotificationsByAccount,
    getNotificationsForCenter,
    getUser,
    markDeliveryLifecycleEmailAttemptFailed,
    markDeliveryLifecycleEmailAttemptSent,
    maxNotificationReadBatchSize,
    notificationCampaigns,
    notificationDeliveryAttempts,
    notificationDeliveryEvents,
    notificationRolloutDefaultDeviceLabel,
    notifications,
    notificationUserChannelPreferences,
    previewNotificationCampaignAudience,
    promoteDeferredWebPushDeliveryAttempts,
    recordNotificationDeliveryEvent,
    revalidateQueuedWebPushDeliveryAttempt,
    routeNotificationDelivery,
    setAllNotificationsRead,
    setNotificationRead,
    startDeliveryLifecycleEmailAttempt,
    storage,
    userNotificationSettings,
    users,
    webPushSubscriptions,
} from '@gredice/storage';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import {
    createTestAccount,
    createTestGarden,
    ensureFarmId,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

async function createDeliveryPushRecipient(label: string) {
    await ensureFarmId();
    const userId = await createUserWithPassword(
        `${label}-${randomUUID()}@example.com`,
        'password',
    );
    const user = await getUser(userId);
    assert.ok(user);
    const accountId = user.accounts[0]?.accountId;
    assert.ok(accountId);
    const subscriptionId = randomUUID();
    await storage()
        .insert(webPushSubscriptions)
        .values({
            id: subscriptionId,
            accountId,
            userId,
            endpoint: `https://example.com/${label}/${subscriptionId}`,
            p256dh: 'k',
            auth: 'a',
            enabled: true,
            permissionState: 'granted',
        });
    return { accountId, subscriptionId, userId };
}

async function createDeliveryLifecyclePushNotification({
    accountId,
    now,
    ttlSeconds = 24 * 60 * 60,
    userId,
}: {
    accountId: string;
    now: Date;
    ttlSeconds?: number;
    userId: string;
}) {
    return await createNotification(
        {
            accountId,
            category: 'delivery_updates',
            content: 'Dostava je krenula.',
            header: 'Dostava',
            timestamp: now,
            ttlSeconds,
            type: 'delivery_lifecycle',
            userId,
        },
        { now },
    );
}

async function getQueuedPushAttempt(notificationId: string) {
    const attempt =
        await storage().query.notificationDeliveryAttempts.findFirst({
            where: and(
                eq(notificationDeliveryAttempts.notificationId, notificationId),
                eq(notificationDeliveryAttempts.channel, 'push'),
                eq(notificationDeliveryAttempts.provider, 'web_push_queue'),
            ),
        });
    assert.ok(attempt);
    return attempt;
}

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

test('createNotificationWithOutcome distinguishes new rows from idempotent reuse while preserving createNotification', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const idempotencyKey = `delivery-lifecycle:${randomUUID()}`;
    const notification = {
        accountId,
        header: 'Dostava je krenula',
        content: 'Pratite status dostave.',
        category: 'delivery_updates',
        type: 'route-started',
        timestamp: new Date(),
    };

    const first = await createNotificationWithOutcome(notification, {
        idempotencyKey,
    });
    const replayId = await createNotification(notification, { idempotencyKey });
    const replay = await createNotificationWithOutcome(notification, {
        idempotencyKey,
    });
    const firstId = first.notificationId;

    assert.equal(firstId, replayId);
    assert.deepEqual(first, { notificationId: firstId, outcome: 'created' });
    assert.deepEqual(replay, { notificationId: firstId, outcome: 'reused' });
    assert.equal(firstId.startsWith('notification:'), true);
    assert.equal(firstId.length <= 128, true);
    assert.equal(firstId.includes(idempotencyKey), false);

    const storedRows = await storage()
        .select({ id: notifications.id })
        .from(notifications)
        .where(eq(notifications.id, firstId));
    assert.equal(storedRows.length, 1);

    const attempts = await storage()
        .select({ provider: notificationDeliveryAttempts.provider })
        .from(notificationDeliveryAttempts)
        .where(eq(notificationDeliveryAttempts.notificationId, firstId));
    assert.equal(
        attempts.filter((attempt) => attempt.provider === 'router').length,
        3,
    );
});

test('createNotification rejects empty or cross-target idempotency key reuse', async () => {
    createTestDb();
    const firstAccountId = await createTestAccount();
    const secondAccountId = await createTestAccount();
    const idempotencyKey = `delivery-lifecycle:${randomUUID()}`;
    const notification = {
        accountId: firstAccountId,
        header: 'Dostava',
        content: 'Status dostave.',
        category: 'delivery_updates',
        type: 'route-started',
        timestamp: new Date(),
    };

    await assert.rejects(
        createNotification(notification, { idempotencyKey: '   ' }),
        /must not be empty/,
    );
    await createNotification(notification, {
        idempotencyKey,
        routeDelivery: false,
    });
    await assert.rejects(
        createNotification(
            { ...notification, accountId: secondAccountId },
            { idempotencyKey, routeDelivery: false },
        ),
        /different target/,
    );
});

test('repeated keyed customer events queue each delivery channel once', async () => {
    createTestDb();
    await ensureFarmId();
    const userId = await createUserWithPassword(
        `delivery-idempotency-${randomUUID()}@example.com`,
        'password',
    );
    const user = await getUser(userId);
    assert.ok(user);
    const accountId = user.accounts[0]?.accountId;
    assert.ok(accountId);
    const subscriptionId = randomUUID();
    await storage()
        .insert(webPushSubscriptions)
        .values({
            id: subscriptionId,
            accountId,
            userId,
            endpoint: `https://example.com/${subscriptionId}`,
            p256dh: 'k',
            auth: 'a',
            enabled: true,
            permissionState: 'granted',
        });
    const notification = {
        accountId,
        userId,
        header: 'Dostava je krenula',
        content: 'Pratite status dostave.',
        category: 'delivery_updates',
        type: 'route-started',
        timestamp: new Date(),
    };
    const idempotencyKey = `delivery-lifecycle:${randomUUID()}`;

    const notificationIds = await Promise.all(
        Array.from(
            { length: 10 },
            async () =>
                await createNotification(notification, { idempotencyKey }),
        ),
    );
    assert.equal(new Set(notificationIds).size, 1);
    const notificationId = notificationIds[0];
    assert.ok(notificationId);

    const attempts = await storage()
        .select({
            channel: notificationDeliveryAttempts.channel,
            provider: notificationDeliveryAttempts.provider,
        })
        .from(notificationDeliveryAttempts)
        .where(eq(notificationDeliveryAttempts.notificationId, notificationId));
    assert.equal(
        attempts.filter((attempt) => attempt.provider === 'router').length,
        3,
    );
    assert.deepEqual(
        attempts
            .filter((attempt) => attempt.provider === 'web_push_queue')
            .map((attempt) => attempt.channel),
        ['push'],
    );

    await storage()
        .update(notificationDeliveryAttempts)
        .set({ createdAt: new Date('2020-01-01T00:00:00.000Z') })
        .where(eq(notificationDeliveryAttempts.notificationId, notificationId));
    const cleanup = await cleanupNotificationRetention({
        deleteDeliveryAttemptsOlderThanDays: 180,
    });
    assert.equal(cleanup.deliveryAttemptsDeleted, 4);

    const retainedNotificationId = await createNotification(notification, {
        idempotencyKey,
    });
    assert.equal(retainedNotificationId, notificationId);
    const attemptsAfterRetainedReplay = await storage()
        .select({ id: notificationDeliveryAttempts.id })
        .from(notificationDeliveryAttempts)
        .where(eq(notificationDeliveryAttempts.notificationId, notificationId));
    assert.deepEqual(attemptsAfterRetainedReplay, []);
});

test('delivery updates use optional defaults and account preferences override global preferences', async () => {
    createTestDb();
    await ensureFarmId();
    const userId = await createUserWithPassword(
        `delivery-preference-${randomUUID()}@example.com`,
        'password',
    );
    const user = await getUser(userId);
    assert.ok(user);
    const accountId = user.accounts[0]?.accountId;
    assert.ok(accountId);
    const subscriptionId = randomUUID();
    await storage()
        .insert(webPushSubscriptions)
        .values({
            id: subscriptionId,
            accountId,
            userId,
            endpoint: `https://example.com/${subscriptionId}`,
            p256dh: 'k',
            auth: 'a',
            enabled: true,
            permissionState: 'granted',
        });

    const defaultNotificationId = await createNotification(
        {
            accountId,
            userId,
            header: 'Dostava',
            content: 'Ažuriranje dostave.',
            category: 'delivery_updates',
            timestamp: new Date(),
        },
        { routeDelivery: false },
    );
    const defaultDecisions = await routeNotificationDelivery(
        defaultNotificationId,
    );
    assert.deepEqual(
        defaultDecisions
            .map(({ channel, outcome, required }) => ({
                channel,
                outcome,
                required,
            }))
            .sort((left, right) => left.channel.localeCompare(right.channel)),
        [
            { channel: 'email', outcome: 'immediate', required: false },
            { channel: 'in_app', outcome: 'immediate', required: false },
            { channel: 'push', outcome: 'immediate', required: false },
        ],
    );

    await storage()
        .insert(notificationUserChannelPreferences)
        .values([
            {
                userId,
                category: 'delivery_updates',
                channel: 'push',
                enabled: true,
            },
            {
                userId,
                accountId,
                scope: 'account',
                category: 'delivery_updates',
                channel: 'push',
                enabled: false,
            },
        ]);
    const accountOverrideId = await createNotification(
        {
            accountId,
            userId,
            header: 'Dostava',
            content: 'Ažuriranje dostave.',
            category: 'delivery_updates',
            timestamp: new Date(),
        },
        { routeDelivery: false },
    );
    const overrideDecisions =
        await routeNotificationDelivery(accountOverrideId);
    assert.ok(
        overrideDecisions.some(
            (decision) =>
                decision.channel === 'push' &&
                decision.outcome === 'suppressed' &&
                decision.reason === 'preference_disabled' &&
                decision.required === false,
        ),
    );
});

test('delivery update quiet hours use an injected clock across midnight', async () => {
    createTestDb();
    await ensureFarmId();
    const userId = await createUserWithPassword(
        `delivery-quiet-hours-${randomUUID()}@example.com`,
        'password',
    );
    const user = await getUser(userId);
    assert.ok(user);
    const accountId = user.accounts[0]?.accountId;
    assert.ok(accountId);
    await storage()
        .insert(notificationUserChannelPreferences)
        .values({
            userId,
            category: 'delivery_updates',
            channel: 'email',
            digestFrequency: 'daily',
            enabled: true,
            quietHoursStartMinute: 22 * 60,
            quietHoursEndMinute: 6 * 60,
            timezone: 'UTC',
        });

    const createUnrouted = async () =>
        await createNotification(
            {
                accountId,
                userId,
                header: 'Dostava',
                content: 'Ažuriranje dostave.',
                category: 'delivery_updates',
                timestamp: new Date(),
            },
            { routeDelivery: false },
        );
    const quietDecisions = await routeNotificationDelivery(
        await createUnrouted(),
        { now: new Date('2026-07-16T23:00:00.000Z') },
    );
    const daytimeDecisions = await routeNotificationDelivery(
        await createUnrouted(),
        { now: new Date('2026-07-16T12:00:00.000Z') },
    );
    assert.ok(
        quietDecisions.some(
            (decision) =>
                decision.channel === 'email' &&
                decision.outcome === 'deferred' &&
                decision.reason === 'quiet_hours',
        ),
    );
    assert.ok(
        daytimeDecisions.some(
            (decision) =>
                decision.channel === 'email' &&
                decision.outcome === 'immediate' &&
                decision.reason === 'eligible_immediate',
        ),
    );
});

test('deferred Web Push is promoted after quiet hours without duplicate queue attempts', async () => {
    createTestDb();
    const { accountId, userId } =
        await createDeliveryPushRecipient('push-promote');
    await storage()
        .insert(notificationUserChannelPreferences)
        .values({
            userId,
            category: 'delivery_updates',
            channel: 'push',
            enabled: true,
            quietHoursStartMinute: 22 * 60,
            quietHoursEndMinute: 6 * 60,
            timezone: 'UTC',
        });
    const notificationId = await createDeliveryLifecyclePushNotification({
        accountId,
        now: new Date('2026-07-16T23:00:00.000Z'),
        userId,
    });
    const beforePromotion = await storage()
        .select({ provider: notificationDeliveryAttempts.provider })
        .from(notificationDeliveryAttempts)
        .where(eq(notificationDeliveryAttempts.notificationId, notificationId));
    assert.equal(
        beforePromotion.some(
            (attempt) => attempt.provider === 'web_push_queue',
        ),
        false,
    );

    const firstPromotion = await promoteDeferredWebPushDeliveryAttempts({
        notificationId,
        now: new Date('2026-07-17T12:00:00.000Z'),
    });
    const secondPromotion = await promoteDeferredWebPushDeliveryAttempts({
        notificationId,
        now: new Date('2026-07-17T12:01:00.000Z'),
    });

    assert.deepEqual(firstPromotion, {
        deferred: 0,
        dropped: 0,
        queued: 1,
        scanned: 1,
    });
    assert.deepEqual(secondPromotion, {
        deferred: 0,
        dropped: 0,
        queued: 0,
        scanned: 0,
    });
    const promotedAttempts = await storage()
        .select({
            provider: notificationDeliveryAttempts.provider,
            reason: notificationDeliveryAttempts.providerResponseCode,
            status: notificationDeliveryAttempts.status,
        })
        .from(notificationDeliveryAttempts)
        .where(eq(notificationDeliveryAttempts.notificationId, notificationId));
    assert.equal(
        promotedAttempts.filter(
            (attempt) => attempt.provider === 'web_push_queue',
        ).length,
        1,
    );
    assert.ok(
        promotedAttempts.some(
            (attempt) =>
                attempt.provider === 'router' &&
                attempt.reason === 'eligible_after_quiet_hours' &&
                attempt.status === 'accepted',
        ),
    );
});

test('deferred Web Push rotates still-quiet attempts behind later eligible work', async () => {
    createTestDb();
    const stillQuiet = await createDeliveryPushRecipient('push-still-quiet');
    await storage()
        .insert(notificationUserChannelPreferences)
        .values({
            userId: stillQuiet.userId,
            category: 'delivery_updates',
            channel: 'push',
            enabled: true,
            quietHoursStartMinute: 22 * 60,
            quietHoursEndMinute: 6 * 60,
            timezone: 'UTC',
        });
    const stillQuietNotificationId =
        await createDeliveryLifecyclePushNotification({
            accountId: stillQuiet.accountId,
            now: new Date('2026-07-16T23:00:00.000Z'),
            userId: stillQuiet.userId,
        });

    const nowEligible = await createDeliveryPushRecipient('push-now-eligible');
    await storage()
        .insert(notificationUserChannelPreferences)
        .values({
            userId: nowEligible.userId,
            category: 'delivery_updates',
            channel: 'push',
            enabled: true,
            quietHoursStartMinute: 10 * 60,
            quietHoursEndMinute: 11 * 60,
            timezone: 'UTC',
        });
    const nowEligibleNotificationId =
        await createDeliveryLifecyclePushNotification({
            accountId: nowEligible.accountId,
            now: new Date('2026-07-16T10:30:00.000Z'),
            userId: nowEligible.userId,
        });
    await storage()
        .update(notificationDeliveryAttempts)
        .set({ attemptedAt: new Date('2026-01-01T00:00:00.000Z') })
        .where(
            eq(
                notificationDeliveryAttempts.notificationId,
                stillQuietNotificationId,
            ),
        );
    await storage()
        .update(notificationDeliveryAttempts)
        .set({ attemptedAt: new Date('2026-01-02T00:00:00.000Z') })
        .where(
            eq(
                notificationDeliveryAttempts.notificationId,
                nowEligibleNotificationId,
            ),
        );

    assert.deepEqual(
        await promoteDeferredWebPushDeliveryAttempts({
            limit: 1,
            now: new Date('2026-07-16T23:30:00.000Z'),
        }),
        { deferred: 1, dropped: 0, queued: 0, scanned: 1 },
    );
    assert.deepEqual(
        await promoteDeferredWebPushDeliveryAttempts({
            limit: 1,
            now: new Date('2026-07-16T23:30:01.000Z'),
        }),
        { deferred: 0, dropped: 0, queued: 1, scanned: 1 },
    );
    assert.equal(
        (await getQueuedPushAttempt(nowEligibleNotificationId)).status,
        'queued',
    );
});

test('queued Web Push is dropped when the recipient disables the channel before send', async () => {
    createTestDb();
    const { accountId, userId } = await createDeliveryPushRecipient(
        'push-disabled-before-send',
    );
    const notificationId = await createDeliveryLifecyclePushNotification({
        accountId,
        now: new Date('2026-07-16T12:00:00.000Z'),
        userId,
    });
    const attempt = await getQueuedPushAttempt(notificationId);
    await storage().insert(notificationUserChannelPreferences).values({
        userId,
        category: 'delivery_updates',
        channel: 'push',
        enabled: false,
    });

    assert.deepEqual(
        await revalidateQueuedWebPushDeliveryAttempt({
            attemptId: attempt.id,
            now: new Date('2026-07-16T12:05:00.000Z'),
        }),
        { reason: 'preference_disabled', status: 'dropped' },
    );
    const droppedAttempt = await getQueuedPushAttempt(notificationId);
    assert.equal(droppedAttempt.status, 'dropped');
    assert.equal(droppedAttempt.providerResponseCode, 'preference_disabled');
});

test('queued Web Push stays deferred when quiet hours begin before send', async () => {
    createTestDb();
    const { accountId, userId } = await createDeliveryPushRecipient(
        'push-quiet-before-send',
    );
    await storage()
        .insert(notificationUserChannelPreferences)
        .values({
            userId,
            category: 'delivery_updates',
            channel: 'push',
            enabled: true,
            quietHoursStartMinute: 22 * 60,
            quietHoursEndMinute: 6 * 60,
            timezone: 'UTC',
        });
    const notificationId = await createDeliveryLifecyclePushNotification({
        accountId,
        now: new Date('2026-07-16T12:00:00.000Z'),
        userId,
    });
    const attempt = await getQueuedPushAttempt(notificationId);

    assert.deepEqual(
        await revalidateQueuedWebPushDeliveryAttempt({
            attemptId: attempt.id,
            now: new Date('2026-07-16T23:00:00.000Z'),
        }),
        { reason: 'quiet_hours', status: 'deferred' },
    );
    const deferredAttempt = await getQueuedPushAttempt(notificationId);
    assert.equal(deferredAttempt.status, 'queued');
    assert.equal(deferredAttempt.providerResponseCode, 'quiet_hours');
});

test('queued Web Push uses a durable send lease before provider submission', async () => {
    createTestDb();
    const { accountId, userId } =
        await createDeliveryPushRecipient('push-send-lease');
    const notificationId = await createDeliveryLifecyclePushNotification({
        accountId,
        now: new Date('2026-07-16T12:00:00.000Z'),
        userId,
    });
    const attempt = await getQueuedPushAttempt(notificationId);

    assert.deepEqual(
        await revalidateQueuedWebPushDeliveryAttempt({
            attemptId: attempt.id,
            now: new Date('2026-07-16T12:05:00.000Z'),
        }),
        { reason: 'eligible_immediate', status: 'eligible' },
    );
    assert.deepEqual(
        await revalidateQueuedWebPushDeliveryAttempt({
            attemptId: attempt.id,
            now: new Date('2026-07-16T12:06:00.000Z'),
        }),
        { reason: 'send_claim_active', status: 'unavailable' },
    );
    const claimedAttempt = await getQueuedPushAttempt(notificationId);
    assert.equal(claimedAttempt.status, 'queued');
    assert.equal(claimedAttempt.providerResponseCode, 'web_push_sending');

    assert.deepEqual(
        await revalidateQueuedWebPushDeliveryAttempt({
            attemptId: attempt.id,
            now: new Date('2026-07-16T13:06:00.000Z'),
        }),
        { reason: 'eligible_immediate', status: 'eligible' },
    );
});

test('queued Web Push drops notifications after their delivery TTL', async () => {
    createTestDb();
    const { accountId, userId } =
        await createDeliveryPushRecipient('push-expired');
    const notificationId = await createDeliveryLifecyclePushNotification({
        accountId,
        now: new Date('2026-07-16T12:00:00.000Z'),
        ttlSeconds: 60,
        userId,
    });
    const attempt = await getQueuedPushAttempt(notificationId);

    assert.deepEqual(
        await revalidateQueuedWebPushDeliveryAttempt({
            attemptId: attempt.id,
            now: new Date('2026-07-16T12:02:00.000Z'),
        }),
        { reason: 'notification_expired', status: 'dropped' },
    );
    const expiredAttempt = await getQueuedPushAttempt(notificationId);
    assert.equal(expiredAttempt.status, 'dropped');
    assert.equal(expiredAttempt.providerResponseCode, 'notification_expired');
});

test('queued customer Web Push is dropped after role or membership changes', async () => {
    createTestDb();
    const roleRecipient = await createDeliveryPushRecipient(
        'push-role-before-send',
    );
    const roleNotificationId = await createDeliveryLifecyclePushNotification({
        accountId: roleRecipient.accountId,
        now: new Date('2026-07-16T12:00:00.000Z'),
        userId: roleRecipient.userId,
    });
    const roleAttempt = await getQueuedPushAttempt(roleNotificationId);
    await storage()
        .update(users)
        .set({ role: 'driver' })
        .where(eq(users.id, roleRecipient.userId));
    assert.deepEqual(
        await revalidateQueuedWebPushDeliveryAttempt({
            attemptId: roleAttempt.id,
            now: new Date('2026-07-16T12:05:00.000Z'),
        }),
        { reason: 'not_recipient', status: 'dropped' },
    );

    const removedRecipient = await createDeliveryPushRecipient(
        'push-membership-before-send',
    );
    const membershipNotificationId =
        await createDeliveryLifecyclePushNotification({
            accountId: removedRecipient.accountId,
            now: new Date('2026-07-16T12:00:00.000Z'),
            userId: removedRecipient.userId,
        });
    const membershipAttempt = await getQueuedPushAttempt(
        membershipNotificationId,
    );
    await storage()
        .delete(accountUsers)
        .where(
            and(
                eq(accountUsers.accountId, removedRecipient.accountId),
                eq(accountUsers.userId, removedRecipient.userId),
            ),
        );
    assert.deepEqual(
        await revalidateQueuedWebPushDeliveryAttempt({
            attemptId: membershipAttempt.id,
            now: new Date('2026-07-16T12:05:00.000Z'),
        }),
        { reason: 'not_recipient', status: 'dropped' },
    );
});

test('notification center uses one account-safe globally ordered page', async () => {
    createTestDb();
    await ensureFarmId();
    const userId = await createUserWithPassword(
        `delivery-center-order-${randomUUID()}@example.com`,
        'password',
    );
    const user = await getUser(userId);
    assert.ok(user);
    const accountId = user.accounts[0]?.accountId;
    assert.ok(accountId);
    const otherAccountId = await createTestAccount();
    await storage()
        .insert(accountUsers)
        .values({ accountId: otherAccountId, userId });
    const foreignUserId = await createUserWithPassword(
        `delivery-center-foreign-${randomUUID()}@example.com`,
        'password',
    );
    await storage()
        .insert(accountUsers)
        .values({ accountId, userId: foreignUserId });
    const createUnrouted = async ({
        targetAccountId = accountId,
        targetUserId,
        timestamp,
    }: {
        targetAccountId?: string;
        targetUserId?: string;
        timestamp: string;
    }) =>
        await createNotification(
            {
                accountId: targetAccountId,
                category: 'general',
                content: timestamp,
                header: timestamp,
                timestamp: new Date(timestamp),
                ...(targetUserId ? { userId: targetUserId } : {}),
            },
            { routeDelivery: false },
        );
    const accountNewestId = await createUnrouted({
        timestamp: '2026-07-16T12:04:00.000Z',
    });
    const userSecondId = await createUnrouted({
        targetUserId: userId,
        timestamp: '2026-07-16T12:03:00.000Z',
    });
    const accountThirdId = await createUnrouted({
        timestamp: '2026-07-16T12:02:00.000Z',
    });
    const userOldestId = await createUnrouted({
        targetUserId: userId,
        timestamp: '2026-07-16T12:01:00.000Z',
    });
    const crossAccountId = await createUnrouted({
        targetAccountId: otherAccountId,
        targetUserId: userId,
        timestamp: '2026-07-16T13:00:00.000Z',
    });
    const foreignUserNotificationId = await createUnrouted({
        targetUserId: foreignUserId,
        timestamp: '2026-07-16T14:00:00.000Z',
    });

    const firstPage = await getNotificationsForCenter({
        accountId,
        limit: 2,
        now: new Date('2026-07-16T12:00:00.000Z'),
        page: 0,
        read: true,
        userId,
    });
    const secondPage = await getNotificationsForCenter({
        accountId,
        limit: 2,
        now: new Date('2026-07-16T12:00:00.000Z'),
        page: 1,
        read: true,
        userId,
    });
    const beyondMaximumPage = await getNotificationsForCenter({
        accountId,
        limit: 2,
        now: new Date('2026-07-16T12:00:00.000Z'),
        page: 101,
        read: true,
        userId,
    });
    assert.deepEqual(
        firstPage.map(({ id }) => id),
        [accountNewestId, userSecondId],
    );
    assert.deepEqual(
        secondPage.map(({ id }) => id),
        [accountThirdId, userOldestId],
    );
    assert.deepEqual(beyondMaximumPage, []);
    const returnedIds = new Set(
        [...firstPage, ...secondPage].map(({ id }) => id),
    );
    assert.equal(returnedIds.has(crossAccountId), false);
    assert.equal(returnedIds.has(foreignUserNotificationId), false);
});

test('bulk notification reads reject oversized request batches', async () => {
    await assert.rejects(
        setAllNotificationsRead(
            'account-id',
            'user-id',
            Array.from(
                { length: maxNotificationReadBatchSize + 1 },
                () => 'duplicate-id',
            ),
            true,
            'notification-center',
        ),
        new RangeError(
            `Cannot update more than ${maxNotificationReadBatchSize} notifications at once`,
        ),
    );
});

test('bulk notification reads lock only authorized unread notifications', async () => {
    createTestDb();
    await ensureFarmId();
    const userId = await createUserWithPassword(
        `delivery-center-lock-owner-${randomUUID()}@example.com`,
        'password',
    );
    const user = await getUser(userId);
    assert.ok(user);
    const accountId = user.accounts[0]?.accountId;
    assert.ok(accountId);
    const foreignUserId = await createUserWithPassword(
        `delivery-center-lock-foreign-${randomUUID()}@example.com`,
        'password',
    );
    await storage()
        .insert(accountUsers)
        .values({ accountId, userId: foreignUserId });
    const createUnrouted = async (targetUserId: string) =>
        await createNotification(
            {
                accountId,
                category: 'general',
                content: 'Bulk read lock scope',
                header: 'Bulk read lock scope',
                timestamp: new Date(),
                userId: targetUserId,
            },
            { routeDelivery: false },
        );
    const ownedNotificationId = await createUnrouted(userId);
    const foreignNotificationId = await createUnrouted(foreignUserId);

    let signalForeignLockAcquired: (() => void) | undefined;
    const foreignLockAcquired = new Promise<void>((resolve) => {
        signalForeignLockAcquired = resolve;
    });
    let releaseForeignLock: (() => void) | undefined;
    const holdForeignLock = new Promise<void>((resolve) => {
        releaseForeignLock = resolve;
    });
    const foreignLockTransaction = storage().transaction(async (tx) => {
        await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`notification-delivery:${foreignNotificationId}`}));`,
        );
        signalForeignLockAcquired?.();
        await holdForeignLock;
    });
    await foreignLockAcquired;

    const update = setAllNotificationsRead(
        accountId,
        userId,
        [foreignNotificationId, ownedNotificationId],
        true,
        'notification-center',
    );
    const timeoutMarker = Symbol('timeout');
    let timeout: NodeJS.Timeout | undefined;
    let outcome: unknown;
    try {
        outcome = await Promise.race([
            update,
            new Promise<typeof timeoutMarker>((resolve) => {
                timeout = setTimeout(() => resolve(timeoutMarker), 1_000);
            }),
        ]);
    } finally {
        if (timeout) clearTimeout(timeout);
        releaseForeignLock?.();
        await foreignLockTransaction;
    }
    if (outcome === timeoutMarker) {
        await update;
        assert.fail('Bulk read waited on an out-of-scope notification lock');
    }
    assert.ok(
        (
            await storage().query.notifications.findFirst({
                where: eq(notifications.id, ownedNotificationId),
            })
        )?.readAt,
    );
    assert.equal(
        (
            await storage().query.notifications.findFirst({
                where: eq(notifications.id, foreignNotificationId),
            })
        )?.readAt,
        null,
    );
});

test('bulk lifecycle reads record one opened event per notification', async () => {
    createTestDb();
    await ensureFarmId();
    const userId = await createUserWithPassword(
        `delivery-center-batch-open-${randomUUID()}@example.com`,
        'password',
    );
    const user = await getUser(userId);
    assert.ok(user);
    const accountId = user.accounts[0]?.accountId;
    assert.ok(accountId);
    const notificationIds = await Promise.all(
        ['first', 'second'].map(
            async (label) =>
                await createNotification(
                    {
                        accountId,
                        category: 'delivery_updates',
                        content: `Delivery ${label}`,
                        header: 'Delivery',
                        timestamp: new Date(),
                        type: 'delivery_lifecycle',
                        userId,
                    },
                    { routeDelivery: false },
                ),
        ),
    );
    const attempts = await storage()
        .insert(notificationDeliveryAttempts)
        .values(
            notificationIds.map((notificationId) => ({
                accountId,
                channel: 'in_app' as const,
                notificationId,
                provider: 'router',
                status: 'accepted' as const,
                userId,
            })),
        )
        .returning({
            id: notificationDeliveryAttempts.id,
            notificationId: notificationDeliveryAttempts.notificationId,
        });

    await setAllNotificationsRead(
        accountId,
        userId,
        notificationIds,
        true,
        'notification-center',
    );
    await setAllNotificationsRead(
        accountId,
        userId,
        notificationIds,
        true,
        'notification-center',
    );
    await setNotificationRead(
        notificationIds[0] ?? '',
        false,
        'notification-center',
    );
    await setNotificationRead(
        notificationIds[0] ?? '',
        true,
        'notification-center',
    );

    const openedEvents = await storage()
        .select({
            deliveryAttemptId: notificationDeliveryEvents.deliveryAttemptId,
            notificationId: notificationDeliveryEvents.notificationId,
        })
        .from(notificationDeliveryEvents)
        .where(
            and(
                inArray(
                    notificationDeliveryEvents.notificationId,
                    notificationIds,
                ),
                eq(notificationDeliveryEvents.type, 'opened'),
            ),
        )
        .orderBy(asc(notificationDeliveryEvents.notificationId));
    assert.equal(openedEvents.length, notificationIds.length);
    assert.deepEqual(
        new Map(
            openedEvents.map((event) => [
                event.notificationId,
                event.deliveryAttemptId,
            ]),
        ),
        new Map(
            attempts.map((attempt) => [attempt.notificationId, attempt.id]),
        ),
    );
});

test('recipient lifecycle rows honor account preferences, quiet hours, and independent reads', async () => {
    createTestDb();
    await ensureFarmId();
    const firstUserId = await createUserWithPassword(
        `delivery-center-first-${randomUUID()}@example.com`,
        'password',
    );
    const firstUser = await getUser(firstUserId);
    assert.ok(firstUser);
    const accountId = firstUser.accounts[0]?.accountId;
    assert.ok(accountId);
    const secondUserId = await createUserWithPassword(
        `delivery-center-second-${randomUUID()}@example.com`,
        'password',
    );
    const disabledUserId = await createUserWithPassword(
        `delivery-center-disabled-${randomUUID()}@example.com`,
        'password',
    );
    await storage()
        .insert(accountUsers)
        .values([
            { accountId, userId: secondUserId },
            { accountId, userId: disabledUserId },
        ]);

    await storage()
        .insert(notificationUserChannelPreferences)
        .values([
            {
                category: 'delivery_updates',
                channel: 'in_app',
                enabled: false,
                userId: firstUserId,
            },
            {
                accountId,
                category: 'delivery_updates',
                channel: 'in_app',
                enabled: true,
                quietHoursEndMinute: 6 * 60,
                quietHoursStartMinute: 22 * 60,
                scope: 'account',
                timezone: 'UTC',
                userId: firstUserId,
            },
            {
                category: 'delivery_updates',
                channel: 'in_app',
                enabled: false,
                userId: disabledUserId,
            },
        ]);
    const quietTime = new Date('2026-07-16T23:00:00.000Z');
    const lifecycleNotification = (userId: string) => ({
        accountId,
        category: 'delivery_updates',
        content: 'Dostava je krenula.',
        header: 'Dostava',
        metadata: {
            milestone: 'route-started',
            requestId: `request-${userId}`,
            retryAttempt: 0,
            runId: 'run-1',
            stopId: '42',
        },
        timestamp: quietTime,
        type: 'delivery_lifecycle',
        userId,
    });
    const firstLifecycleId = await createNotification(
        lifecycleNotification(firstUserId),
        { now: quietTime },
    );
    const secondLifecycleId = await createNotification(
        lifecycleNotification(secondUserId),
        { now: quietTime },
    );
    const disabledLifecycleId = await createNotification(
        lifecycleNotification(disabledUserId),
        { now: quietTime },
    );

    const duringQuietHours = await getNotificationsForCenter({
        accountId,
        limit: 10,
        now: quietTime,
        page: 0,
        read: false,
        userId: firstUserId,
    });
    const afterQuietHours = await getNotificationsForCenter({
        accountId,
        limit: 10,
        now: new Date('2026-07-17T12:00:00.000Z'),
        page: 0,
        read: false,
        userId: firstUserId,
    });
    assert.equal(
        duringQuietHours.some(({ id }) => id === firstLifecycleId),
        false,
    );
    assert.equal(
        afterQuietHours.some(({ id }) => id === firstLifecycleId),
        true,
    );
    assert.equal(
        (
            await getNotificationsForCenter({
                accountId,
                limit: 10,
                now: new Date('2026-07-17T12:00:00.000Z'),
                page: 0,
                read: false,
                userId: disabledUserId,
            })
        ).some(({ id }) => id === disabledLifecycleId),
        false,
    );
    await storage()
        .update(notificationUserChannelPreferences)
        .set({ enabled: true })
        .where(
            and(
                eq(notificationUserChannelPreferences.userId, disabledUserId),
                eq(
                    notificationUserChannelPreferences.category,
                    'delivery_updates',
                ),
                eq(notificationUserChannelPreferences.channel, 'in_app'),
            ),
        );
    assert.equal(
        (
            await getNotificationsForCenter({
                accountId,
                limit: 10,
                now: new Date('2026-07-17T12:00:00.000Z'),
                page: 0,
                read: false,
                userId: disabledUserId,
            })
        ).some(({ id }) => id === disabledLifecycleId),
        false,
    );

    const quietAttempt =
        await storage().query.notificationDeliveryAttempts.findFirst({
            where: and(
                eq(
                    notificationDeliveryAttempts.notificationId,
                    firstLifecycleId,
                ),
                eq(notificationDeliveryAttempts.channel, 'in_app'),
                eq(notificationDeliveryAttempts.provider, 'router'),
            ),
        });
    assert.equal(quietAttempt?.status, 'queued');
    assert.equal(quietAttempt?.providerResponseCode, 'quiet_hours');
    const disabledAttempts = await storage()
        .select({
            channel: notificationDeliveryAttempts.channel,
            reason: notificationDeliveryAttempts.providerResponseCode,
        })
        .from(notificationDeliveryAttempts)
        .where(
            and(
                eq(
                    notificationDeliveryAttempts.notificationId,
                    disabledLifecycleId,
                ),
                eq(notificationDeliveryAttempts.provider, 'router'),
            ),
        );
    assert.deepEqual(
        disabledAttempts.sort((left, right) =>
            left.channel.localeCompare(right.channel),
        ),
        [
            { channel: 'email', reason: 'eligible_immediate' },
            { channel: 'in_app', reason: 'preference_disabled' },
            { channel: 'push', reason: 'missing_push_subscription' },
        ],
    );

    await setAllNotificationsRead(
        accountId,
        firstUserId,
        [secondLifecycleId],
        true,
        'notification-center',
    );
    assert.equal(
        (
            await storage().query.notifications.findFirst({
                where: eq(notifications.id, secondLifecycleId),
            })
        )?.readAt,
        null,
    );
    await setAllNotificationsRead(
        accountId,
        firstUserId,
        [firstLifecycleId],
        true,
        'notification-center',
    );
    await setNotificationRead(firstLifecycleId, true, 'notification-center');
    await setNotificationRead(firstLifecycleId, false, 'notification-center');
    await setNotificationRead(firstLifecycleId, true, 'notification-center');
    assert.ok(quietAttempt);
    const openedEvents = await storage()
        .select({
            deliveryAttemptId: notificationDeliveryEvents.deliveryAttemptId,
            metadata: notificationDeliveryEvents.metadata,
        })
        .from(notificationDeliveryEvents)
        .where(
            and(
                eq(notificationDeliveryEvents.notificationId, firstLifecycleId),
                eq(notificationDeliveryEvents.type, 'opened'),
            ),
        );
    assert.deepEqual(openedEvents, [
        {
            deliveryAttemptId: quietAttempt.id,
            metadata: { surface: 'notification_center' },
        },
    ]);
    const secondOpenedEvents = await storage()
        .select({ id: notificationDeliveryEvents.id })
        .from(notificationDeliveryEvents)
        .where(
            and(
                eq(
                    notificationDeliveryEvents.notificationId,
                    secondLifecycleId,
                ),
                eq(notificationDeliveryEvents.type, 'opened'),
            ),
        );
    assert.equal(secondOpenedEvents.length, 0);
    await storage().insert(notificationUserChannelPreferences).values({
        category: 'delivery_updates',
        channel: 'in_app',
        enabled: false,
        userId: secondUserId,
    });
    assert.equal(
        (
            await getNotificationsForCenter({
                accountId,
                limit: 10,
                now: new Date('2026-07-17T12:00:00.000Z'),
                page: 0,
                read: false,
                userId: firstUserId,
            })
        ).some(({ id }) => id === firstLifecycleId),
        false,
    );
    assert.equal(
        (
            await getNotificationsForCenter({
                accountId,
                limit: 10,
                now: new Date('2026-07-17T12:00:00.000Z'),
                page: 0,
                read: false,
                userId: secondUserId,
            })
        ).some(({ id }) => id === secondLifecycleId),
        true,
    );
});

test('removed account members cannot claim or route direct lifecycle notifications', async () => {
    createTestDb();
    await ensureFarmId();
    const userId = await createUserWithPassword(
        `delivery-center-removed-${randomUUID()}@example.com`,
        'password',
    );
    const user = await getUser(userId);
    assert.ok(user);
    const accountId = user.accounts[0]?.accountId;
    assert.ok(accountId);
    const notificationId = await createNotification(
        {
            accountId,
            category: 'delivery_updates',
            content: 'Dostava je krenula.',
            header: 'Dostava',
            metadata: {
                eventVersion: 1,
                milestone: 'route-started',
                requestId: randomUUID(),
                retryAttempt: 0,
                runId: 'run-removed-member',
                stopId: '42',
            },
            timestamp: new Date('2026-07-16T12:00:00.000Z'),
            type: 'delivery_lifecycle',
            userId,
        },
        { routeDelivery: false },
    );
    await storage()
        .delete(accountUsers)
        .where(
            and(
                eq(accountUsers.accountId, accountId),
                eq(accountUsers.userId, userId),
            ),
        );

    assert.equal(
        (await getDeliveryLifecycleEmailCandidates()).some(
            (candidate) =>
                candidate.notificationId === notificationId &&
                candidate.userId === userId,
        ),
        true,
    );
    assert.deepEqual(
        await claimDeliveryLifecycleEmailCandidate({ notificationId, userId }),
        { reason: 'not_recipient', status: 'unavailable' },
    );
    assert.deepEqual(await routeNotificationDelivery(notificationId), []);
    await storage().insert(accountUsers).values({ accountId, userId });
    assert.equal(
        (await getDeliveryLifecycleEmailCandidates()).some(
            (candidate) =>
                candidate.notificationId === notificationId &&
                candidate.userId === userId,
        ),
        false,
    );
    assert.deepEqual(
        await claimDeliveryLifecycleEmailCandidate({ notificationId, userId }),
        { reason: 'already_claimed', status: 'unavailable' },
    );
});

test('customer lifecycle delivery stops after a recipient role changes to driver', async () => {
    createTestDb();
    await ensureFarmId();
    const userId = await createUserWithPassword(
        `delivery-center-role-change-${randomUUID()}@example.com`,
        'password',
    );
    const user = await getUser(userId);
    assert.ok(user);
    const accountId = user.accounts[0]?.accountId;
    assert.ok(accountId);
    const notificationId = await createNotification({
        accountId,
        category: 'delivery_updates',
        content: 'Dostava je krenula.',
        header: 'Dostava',
        metadata: {
            eventVersion: 1,
            milestone: 'route-started',
            requestId: randomUUID(),
            retryAttempt: 0,
            runId: 'run-role-change',
            stopId: '42',
        },
        timestamp: new Date('2026-07-16T12:00:00.000Z'),
        type: 'delivery_lifecycle',
        userId,
    });
    assert.equal(
        (
            await getNotificationsForCenter({
                accountId,
                limit: 10,
                page: 0,
                read: true,
                userId,
            })
        ).some(({ id }) => id === notificationId),
        true,
    );
    await storage()
        .update(users)
        .set({ role: 'driver' })
        .where(eq(users.id, userId));

    assert.equal(
        (await getDeliveryLifecycleEmailCandidates()).some(
            (candidate) =>
                candidate.notificationId === notificationId &&
                candidate.userId === userId,
        ),
        true,
    );
    assert.deepEqual(
        await claimDeliveryLifecycleEmailCandidate({ notificationId, userId }),
        { reason: 'not_recipient', status: 'unavailable' },
    );
    assert.deepEqual(await routeNotificationDelivery(notificationId), []);
    assert.equal(
        (
            await getNotificationsForCenter({
                accountId,
                limit: 10,
                page: 0,
                read: true,
                userId,
            })
        ).some(({ id }) => id === notificationId),
        false,
    );
    await storage()
        .update(users)
        .set({ role: 'user' })
        .where(eq(users.id, userId));
    assert.equal(
        (await getDeliveryLifecycleEmailCandidates()).some(
            (candidate) =>
                candidate.notificationId === notificationId &&
                candidate.userId === userId,
        ),
        false,
    );
    assert.deepEqual(
        await claimDeliveryLifecycleEmailCandidate({ notificationId, userId }),
        { reason: 'already_claimed', status: 'unavailable' },
    );
});

test('createNotification routes and queues deliverable push by default', async () => {
    createTestDb();
    await ensureFarmId();
    const userName = `push-create-${randomUUID()}@example.com`;
    const userId = await createUserWithPassword(userName, 'password');
    const user = await getUser(userId);
    assert.ok(user);
    const accountId = user.accounts[0]?.accountId;
    assert.ok(accountId);

    const subscriptionId = randomUUID();
    await storage()
        .insert(webPushSubscriptions)
        .values({
            id: subscriptionId,
            accountId,
            userId,
            endpoint: `https://example.com/${subscriptionId}`,
            p256dh: 'k',
            auth: 'a',
            enabled: true,
            permissionState: 'granted',
        });

    const notificationId = await createNotification({
        accountId,
        userId,
        header: 'Push routed',
        content: 'Route and queue push delivery',
        category: 'general',
        timestamp: new Date(),
    });

    await routeNotificationDelivery(notificationId);
    await enqueuePushDeliveryAttemptsForNotification({ notificationId });

    const attempts = await storage()
        .select({
            channel: notificationDeliveryAttempts.channel,
            provider: notificationDeliveryAttempts.provider,
            providerResponseCode:
                notificationDeliveryAttempts.providerResponseCode,
            pushSubscriptionId: notificationDeliveryAttempts.pushSubscriptionId,
            status: notificationDeliveryAttempts.status,
        })
        .from(notificationDeliveryAttempts)
        .where(eq(notificationDeliveryAttempts.notificationId, notificationId));

    assert.equal(
        attempts.filter((attempt) => attempt.provider === 'router').length,
        3,
    );
    assert.ok(
        attempts.some(
            (attempt) =>
                attempt.provider === 'router' &&
                attempt.channel === 'in_app' &&
                attempt.providerResponseCode === 'eligible_immediate',
        ),
    );
    assert.ok(
        attempts.some(
            (attempt) =>
                attempt.provider === 'router' &&
                attempt.channel === 'push' &&
                attempt.providerResponseCode === 'eligible_immediate',
        ),
    );
    assert.deepEqual(
        attempts
            .filter((attempt) => attempt.provider === 'web_push_queue')
            .map((attempt) => ({
                pushSubscriptionId: attempt.pushSubscriptionId,
                status: attempt.status,
            })),
        [{ pushSubscriptionId: subscriptionId, status: 'queued' }],
    );
});

test('weather alert notifications are suppressed when no preference opt-in exists', async () => {
    createTestDb();
    await ensureFarmId();
    const userName = `push-weather-default-${randomUUID()}@example.com`;
    const userId = await createUserWithPassword(userName, 'password');
    const user = await getUser(userId);
    assert.ok(user);
    const accountId = user.accounts[0]?.accountId;
    assert.ok(accountId);

    await storage()
        .insert(webPushSubscriptions)
        .values({
            id: randomUUID(),
            accountId,
            userId,
            endpoint: `https://example.com/weather-${randomUUID()}`,
            p256dh: 'k',
            auth: 'a',
            enabled: true,
            permissionState: 'granted',
        });

    const notificationId = await createNotification({
        accountId,
        userId,
        header: 'Weather alert',
        content: 'Weather alerts default off',
        category: 'weather_alerts',
        timestamp: new Date(),
    });

    const attempts = await storage()
        .select({
            channel: notificationDeliveryAttempts.channel,
            provider: notificationDeliveryAttempts.provider,
            providerResponseCode:
                notificationDeliveryAttempts.providerResponseCode,
        })
        .from(notificationDeliveryAttempts)
        .where(eq(notificationDeliveryAttempts.notificationId, notificationId));

    assert.deepEqual(
        attempts
            .filter((attempt) => attempt.provider === 'router')
            .map((attempt) => ({
                channel: attempt.channel,
                reason: attempt.providerResponseCode,
            }))
            .sort((left, right) => left.channel.localeCompare(right.channel)),
        [
            { channel: 'email', reason: 'preference_disabled' },
            { channel: 'in_app', reason: 'preference_disabled' },
            { channel: 'push', reason: 'preference_disabled' },
        ],
    );
    assert.equal(
        attempts.some((attempt) => attempt.provider === 'web_push_queue'),
        false,
    );
});

test('createNotification expands account-wide push to account users', async () => {
    createTestDb();
    await ensureFarmId();
    const firstUserId = await createUserWithPassword(
        `push-account-wide-first-${randomUUID()}@example.com`,
        'password',
    );
    const firstUser = await getUser(firstUserId);
    assert.ok(firstUser);
    const accountId = firstUser.accounts[0]?.accountId;
    assert.ok(accountId);
    const secondUserId = await createUserWithPassword(
        `push-account-wide-second-${randomUUID()}@example.com`,
        'password',
    );
    await storage().insert(accountUsers).values({
        accountId,
        userId: secondUserId,
    });

    const firstSubscriptionId = randomUUID();
    const secondSubscriptionId = randomUUID();
    await storage()
        .insert(webPushSubscriptions)
        .values([
            {
                id: firstSubscriptionId,
                accountId,
                userId: firstUserId,
                endpoint: `https://example.com/${firstSubscriptionId}`,
                p256dh: 'k',
                auth: 'a',
                enabled: true,
                permissionState: 'granted',
            },
            {
                id: secondSubscriptionId,
                accountId,
                userId: secondUserId,
                endpoint: `https://example.com/${secondSubscriptionId}`,
                p256dh: 'k',
                auth: 'a',
                enabled: true,
                permissionState: 'granted',
            },
        ]);

    const notificationId = await createNotification({
        accountId,
        header: 'Account-wide push',
        content: 'Account members should receive push delivery',
        category: 'general',
        timestamp: new Date(),
    });

    const attempts = await storage()
        .select({
            channel: notificationDeliveryAttempts.channel,
            provider: notificationDeliveryAttempts.provider,
            providerResponseCode:
                notificationDeliveryAttempts.providerResponseCode,
            pushSubscriptionId: notificationDeliveryAttempts.pushSubscriptionId,
            status: notificationDeliveryAttempts.status,
            userId: notificationDeliveryAttempts.userId,
        })
        .from(notificationDeliveryAttempts)
        .where(eq(notificationDeliveryAttempts.notificationId, notificationId));

    const pushRouterAttempts = attempts
        .filter(
            (attempt) =>
                attempt.provider === 'router' && attempt.channel === 'push',
        )
        .sort((left, right) =>
            (left.userId ?? '').localeCompare(right.userId ?? ''),
        );
    assert.deepEqual(
        pushRouterAttempts.map((attempt) => ({
            providerResponseCode: attempt.providerResponseCode,
            status: attempt.status,
            userId: attempt.userId,
        })),
        [firstUserId, secondUserId].sort().map((userId) => ({
            providerResponseCode: 'eligible_immediate',
            status: 'accepted',
            userId,
        })),
    );

    const queuedPushAttempts = attempts
        .filter((attempt) => attempt.provider === 'web_push_queue')
        .sort((left, right) =>
            (left.pushSubscriptionId ?? '').localeCompare(
                right.pushSubscriptionId ?? '',
            ),
        );
    assert.deepEqual(
        queuedPushAttempts.map((attempt) => ({
            pushSubscriptionId: attempt.pushSubscriptionId,
            status: attempt.status,
        })),
        [firstSubscriptionId, secondSubscriptionId].sort().map((id) => ({
            pushSubscriptionId: id,
            status: 'queued',
        })),
    );
});

test('account-wide push fan-out respects each user preference', async () => {
    createTestDb();
    await ensureFarmId();
    const enabledUserId = await createUserWithPassword(
        `push-account-pref-enabled-${randomUUID()}@example.com`,
        'password',
    );
    const enabledUser = await getUser(enabledUserId);
    assert.ok(enabledUser);
    const accountId = enabledUser.accounts[0]?.accountId;
    assert.ok(accountId);
    const disabledUserId = await createUserWithPassword(
        `push-account-pref-disabled-${randomUUID()}@example.com`,
        'password',
    );
    await storage().insert(accountUsers).values({
        accountId,
        userId: disabledUserId,
    });

    const enabledSubscriptionId = randomUUID();
    const disabledSubscriptionId = randomUUID();
    await storage()
        .insert(webPushSubscriptions)
        .values([
            {
                id: enabledSubscriptionId,
                accountId,
                userId: enabledUserId,
                endpoint: `https://example.com/${enabledSubscriptionId}`,
                p256dh: 'k',
                auth: 'a',
                enabled: true,
                permissionState: 'granted',
            },
            {
                id: disabledSubscriptionId,
                accountId,
                userId: disabledUserId,
                endpoint: `https://example.com/${disabledSubscriptionId}`,
                p256dh: 'k',
                auth: 'a',
                enabled: true,
                permissionState: 'granted',
            },
        ]);
    const category = `account-wide-preference-${randomUUID()}`;
    await storage().insert(notificationUserChannelPreferences).values({
        userId: disabledUserId,
        category,
        channel: 'push',
        enabled: false,
    });

    const notificationId = await createNotification({
        accountId,
        header: 'Account preference push',
        content: 'One account member disabled push for this category',
        category,
        timestamp: new Date(),
    });

    const attempts = await storage()
        .select({
            channel: notificationDeliveryAttempts.channel,
            provider: notificationDeliveryAttempts.provider,
            providerResponseCode:
                notificationDeliveryAttempts.providerResponseCode,
            pushSubscriptionId: notificationDeliveryAttempts.pushSubscriptionId,
            userId: notificationDeliveryAttempts.userId,
        })
        .from(notificationDeliveryAttempts)
        .where(eq(notificationDeliveryAttempts.notificationId, notificationId));

    assert.ok(
        attempts.some(
            (attempt) =>
                attempt.provider === 'router' &&
                attempt.channel === 'push' &&
                attempt.userId === enabledUserId &&
                attempt.providerResponseCode === 'eligible_immediate',
        ),
    );
    assert.ok(
        attempts.some(
            (attempt) =>
                attempt.provider === 'router' &&
                attempt.channel === 'push' &&
                attempt.userId === disabledUserId &&
                attempt.providerResponseCode === 'preference_disabled',
        ),
    );
    assert.deepEqual(
        attempts
            .filter((attempt) => attempt.provider === 'web_push_queue')
            .map((attempt) => attempt.pushSubscriptionId),
        [enabledSubscriptionId],
    );
});

test('createNotification records preference decisions without queueing suppressed or digest push', async () => {
    createTestDb();
    await ensureFarmId();
    const userName = `push-preferences-${randomUUID()}@example.com`;
    const userId = await createUserWithPassword(userName, 'password');
    const user = await getUser(userId);
    assert.ok(user);
    const accountId = user.accounts[0]?.accountId;
    assert.ok(accountId);

    await storage()
        .insert(webPushSubscriptions)
        .values({
            id: randomUUID(),
            accountId,
            userId,
            endpoint: `https://example.com/preferences-${randomUUID()}`,
            p256dh: 'k',
            auth: 'a',
            enabled: true,
            permissionState: 'granted',
        });
    await storage()
        .insert(notificationUserChannelPreferences)
        .values([
            {
                userId,
                category: 'disabled',
                channel: 'push',
                enabled: false,
            },
            {
                userId,
                category: 'digest',
                channel: 'push',
                digestFrequency: 'daily',
            },
            {
                userId,
                category: 'quiet',
                channel: 'push',
                quietHoursStartMinute: 0,
                quietHoursEndMinute: 1440,
                timezone: 'UTC',
            },
        ]);

    const cases = [
        { category: 'disabled', reason: 'preference_disabled' },
        { category: 'digest', reason: 'digest_daily' },
        { category: 'quiet', reason: 'quiet_hours' },
    ];

    for (const testCase of cases) {
        const notificationId = await createNotification({
            accountId,
            userId,
            header: `Push ${testCase.category}`,
            content: 'Preference-aware push routing',
            category: testCase.category,
            timestamp: new Date(),
        });
        const attempts = await storage()
            .select({
                channel: notificationDeliveryAttempts.channel,
                provider: notificationDeliveryAttempts.provider,
                providerResponseCode:
                    notificationDeliveryAttempts.providerResponseCode,
            })
            .from(notificationDeliveryAttempts)
            .where(
                eq(notificationDeliveryAttempts.notificationId, notificationId),
            );

        assert.ok(
            attempts.some(
                (attempt) =>
                    attempt.provider === 'router' &&
                    attempt.channel === 'push' &&
                    attempt.providerResponseCode === testCase.reason,
            ),
        );
        assert.equal(
            attempts.some((attempt) => attempt.provider === 'web_push_queue'),
            false,
        );
    }
});

test('routeNotificationDelivery returns default immediate email and suppressed push without subscription', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const notificationId = await createNotification(
        {
            accountId,
            header: 'Routing',
            content: 'Routing notification',
            category: 'general',
            timestamp: new Date(),
        },
        { routeDelivery: false },
    );
    const decisions = await routeNotificationDelivery(notificationId);
    assert.equal(decisions.length, 3);
    assert.ok(
        decisions.some(
            (decision) =>
                decision.channel === 'in_app' &&
                decision.outcome === 'immediate',
        ),
    );
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
        `insert into web_push_subscriptions (id, account_id, user_id, endpoint, p256dh, auth, enabled, permission_state)
         values ('${subscriptionId}', '${accountId}', '${userId}', 'https://example.com/sub', 'k', 'a', true, 'granted')`,
    );

    const notificationId = await createNotification(
        {
            accountId,
            userId,
            header: 'Push queued',
            content: 'Queue push delivery',
            category: 'general',
            timestamp: new Date(),
        },
        { routeDelivery: false },
    );

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

test('routeNotificationDelivery treats only granted active subscriptions as push eligible', async () => {
    createTestDb();
    await ensureFarmId();
    const cases: {
        enabled: boolean;
        expectedOutcome: 'immediate' | 'suppressed';
        expectedReason: string;
        permissionState: 'default' | 'denied' | 'granted';
        revokedAt: Date | null;
        suffix: string;
    }[] = [
        {
            enabled: true,
            permissionState: 'denied',
            revokedAt: null,
            suffix: 'denied',
            expectedOutcome: 'suppressed',
            expectedReason: 'missing_push_subscription',
        },
        {
            enabled: true,
            permissionState: 'default',
            revokedAt: null,
            suffix: 'default',
            expectedOutcome: 'suppressed',
            expectedReason: 'missing_push_subscription',
        },
        {
            enabled: false,
            permissionState: 'granted',
            revokedAt: null,
            suffix: 'disabled',
            expectedOutcome: 'suppressed',
            expectedReason: 'missing_push_subscription',
        },
        {
            enabled: true,
            permissionState: 'granted',
            revokedAt: new Date(),
            suffix: 'revoked',
            expectedOutcome: 'suppressed',
            expectedReason: 'missing_push_subscription',
        },
        {
            enabled: true,
            permissionState: 'granted',
            revokedAt: null,
            suffix: 'granted',
            expectedOutcome: 'immediate',
            expectedReason: 'eligible_immediate',
        },
    ];

    for (const testCase of cases) {
        const userName = `push-route-${testCase.suffix}-${randomUUID()}@example.com`;
        const userId = await createUserWithPassword(userName, 'password');
        const user = await getUser(userId);
        assert.ok(user);
        const accountId = user.accounts[0]?.accountId;
        assert.ok(accountId);

        await storage()
            .insert(webPushSubscriptions)
            .values({
                id: randomUUID(),
                accountId,
                userId,
                endpoint: `https://example.com/${testCase.suffix}-${randomUUID()}`,
                p256dh: 'k',
                auth: 'a',
                enabled: testCase.enabled,
                permissionState: testCase.permissionState,
                revokedAt: testCase.revokedAt,
            });

        const notificationId = await createNotification(
            {
                accountId,
                userId,
                header: `Push ${testCase.suffix}`,
                content: 'Route push delivery',
                category: 'general',
                timestamp: new Date(),
            },
            { routeDelivery: false },
        );
        const decisions = await routeNotificationDelivery(notificationId);
        const pushDecision = decisions.find(
            (decision) => decision.channel === 'push',
        );

        assert.equal(pushDecision?.outcome, testCase.expectedOutcome);
        assert.equal(pushDecision?.reason, testCase.expectedReason);
    }
});

test('enqueuePushDeliveryAttemptsForNotification queues only granted active subscriptions', async () => {
    createTestDb();
    await ensureFarmId();
    const userName = `push-deliverable-${randomUUID()}@example.com`;
    const userId = await createUserWithPassword(userName, 'password');
    const user = await getUser(userId);
    assert.ok(user);
    const accountId = user.accounts[0]?.accountId;
    assert.ok(accountId);

    const grantedSubscriptionId = randomUUID();
    await storage()
        .insert(webPushSubscriptions)
        .values([
            {
                id: grantedSubscriptionId,
                accountId,
                userId,
                endpoint: `https://example.com/${grantedSubscriptionId}`,
                p256dh: 'k',
                auth: 'a',
                enabled: true,
                permissionState: 'granted',
            },
            {
                id: randomUUID(),
                accountId,
                userId,
                endpoint: `https://example.com/denied-${randomUUID()}`,
                p256dh: 'k',
                auth: 'a',
                enabled: true,
                permissionState: 'denied',
            },
            {
                id: randomUUID(),
                accountId,
                userId,
                endpoint: `https://example.com/default-${randomUUID()}`,
                p256dh: 'k',
                auth: 'a',
                enabled: true,
                permissionState: 'default',
            },
            {
                id: randomUUID(),
                accountId,
                userId,
                endpoint: `https://example.com/disabled-${randomUUID()}`,
                p256dh: 'k',
                auth: 'a',
                enabled: false,
                permissionState: 'granted',
            },
            {
                id: randomUUID(),
                accountId,
                userId,
                endpoint: `https://example.com/revoked-${randomUUID()}`,
                p256dh: 'k',
                auth: 'a',
                enabled: true,
                permissionState: 'granted',
                revokedAt: new Date(),
            },
        ]);

    const notificationId = await createNotification(
        {
            accountId,
            userId,
            header: 'Push deliverable',
            content: 'Only deliverable subscriptions should queue',
            category: 'general',
            timestamp: new Date(),
        },
        { routeDelivery: false },
    );

    const result = await enqueuePushDeliveryAttemptsForNotification({
        notificationId,
    });
    assert.equal(result.queued, 1);
    assert.equal(result.skipped, 0);

    const attempts = await storage()
        .select({
            pushSubscriptionId: notificationDeliveryAttempts.pushSubscriptionId,
        })
        .from(notificationDeliveryAttempts)
        .where(eq(notificationDeliveryAttempts.notificationId, notificationId));

    assert.deepEqual(
        attempts.map((attempt) => attempt.pushSubscriptionId),
        [grantedSubscriptionId],
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

    const notificationId = await createNotification(
        {
            accountId,
            userId,
            header: 'Push analytics',
            content: 'Track delivery analytics',
            category: 'general',
            timestamp: new Date(),
        },
        { routeDelivery: false },
    );
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

    const firstNotificationId = await createNotification(
        {
            accountId: firstAccountId,
            userId: firstUserId,
            header: 'First',
            content: 'First notification',
            category: 'general',
            timestamp: new Date(),
        },
        { routeDelivery: false },
    );
    const secondNotificationId = await createNotification(
        {
            accountId: secondAccountId,
            userId: secondUserId,
            header: 'Second',
            content: 'Second notification',
            category: 'general',
            timestamp: new Date(),
        },
        { routeDelivery: false },
    );

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

    const notificationId = await createNotification(
        {
            accountId,
            userId,
            header: 'Push revoked',
            content: 'Revoked subscriptions should not queue',
            category: 'general',
            timestamp: new Date(),
        },
        { routeDelivery: false },
    );

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

test('backfillNotificationRolloutDefaults limits subscription updates with batch limit', async () => {
    createTestDb();
    const defaultSubscriptionIds: string[] = [];
    const deniedSubscriptionIds: string[] = [];
    const rolloutUserIds: string[] = [];
    const rolloutUserDates = [
        '1900-01-01T00:00:00.000Z',
        '1900-01-02T00:00:00.000Z',
    ];

    for (const [index, suffix] of ['first', 'second'].entries()) {
        const userId = await createUserWithPassword(
            `rollout-limit-${suffix}-${randomUUID()}@example.com`,
            'password',
        );
        rolloutUserIds.push(userId);
        await storage()
            .update(users)
            .set({ createdAt: new Date(rolloutUserDates[index]) })
            .where(eq(users.id, userId));
        const user = await getUser(userId);
        assert.ok(user);
        const accountId = user.accounts[0]?.accountId;
        assert.ok(accountId);

        const defaultSubscriptionId = randomUUID();
        const deniedSubscriptionId = randomUUID();
        defaultSubscriptionIds.push(defaultSubscriptionId);
        deniedSubscriptionIds.push(deniedSubscriptionId);
        await storage()
            .insert(webPushSubscriptions)
            .values([
                {
                    id: defaultSubscriptionId,
                    accountId,
                    userId,
                    endpoint: `https://example.com/${defaultSubscriptionId}`,
                    p256dh: 'k',
                    auth: 'a',
                    enabled: true,
                    permissionState: 'default',
                },
                {
                    id: deniedSubscriptionId,
                    accountId,
                    userId,
                    endpoint: `https://example.com/${deniedSubscriptionId}`,
                    p256dh: 'k',
                    auth: 'a',
                    enabled: true,
                    permissionState: 'denied',
                    deviceLabel: 'Known device',
                },
            ]);
    }

    const result = await backfillNotificationRolloutDefaults({
        limit: 1,
        now: new Date('2026-01-01T00:00:00.000Z'),
    });

    assert.equal(result.usersScanned, 1);
    assert.ok(result.subscriptionsMarkedGranted >= 1);
    assert.ok(result.deniedSubscriptionsDisabled >= 1);
    assert.ok(result.deviceLabelsBackfilled >= 1);

    const weatherAlertPreferences = await storage()
        .select({
            channel: notificationUserChannelPreferences.channel,
            enabled: notificationUserChannelPreferences.enabled,
        })
        .from(notificationUserChannelPreferences)
        .where(
            eq(notificationUserChannelPreferences.category, 'weather_alerts'),
        );
    assert.deepEqual(
        weatherAlertPreferences
            .map((preference) => ({
                channel: preference.channel,
                enabled: preference.enabled,
            }))
            .sort((left, right) => left.channel.localeCompare(right.channel)),
        [
            { channel: 'email', enabled: false },
            { channel: 'in_app', enabled: false },
            { channel: 'push', enabled: false },
        ],
    );

    const deliveryUpdatePreferences = await storage()
        .select({
            channel: notificationUserChannelPreferences.channel,
            digestFrequency: notificationUserChannelPreferences.digestFrequency,
            enabled: notificationUserChannelPreferences.enabled,
            required: notificationUserChannelPreferences.required,
            userId: notificationUserChannelPreferences.userId,
        })
        .from(notificationUserChannelPreferences)
        .where(
            eq(notificationUserChannelPreferences.category, 'delivery_updates'),
        );
    assert.deepEqual(
        deliveryUpdatePreferences
            .filter((preference) => preference.userId === rolloutUserIds[0])
            .map((preference) => ({
                channel: preference.channel,
                digestFrequency: preference.digestFrequency,
                enabled: preference.enabled,
                required: preference.required,
            }))
            .sort((left, right) => left.channel.localeCompare(right.channel)),
        [
            {
                channel: 'email',
                digestFrequency: 'off',
                enabled: true,
                required: false,
            },
            {
                channel: 'in_app',
                digestFrequency: 'off',
                enabled: true,
                required: false,
            },
            {
                channel: 'push',
                digestFrequency: 'off',
                enabled: true,
                required: false,
            },
        ],
    );

    const subscriptions = await storage()
        .select({
            id: webPushSubscriptions.id,
            deviceLabel: webPushSubscriptions.deviceLabel,
            enabled: webPushSubscriptions.enabled,
            permissionState: webPushSubscriptions.permissionState,
            revokedAt: webPushSubscriptions.revokedAt,
            revokedReason: webPushSubscriptions.revokedReason,
        })
        .from(webPushSubscriptions);
    const defaultSubscriptions = subscriptions.filter((subscription) =>
        defaultSubscriptionIds.includes(subscription.id),
    );
    const deniedSubscriptions = subscriptions.filter((subscription) =>
        deniedSubscriptionIds.includes(subscription.id),
    );

    assert.equal(
        defaultSubscriptions.filter(
            (subscription) => subscription.permissionState === 'granted',
        ).length,
        1,
    );
    assert.equal(
        defaultSubscriptions.filter(
            (subscription) => subscription.permissionState === 'default',
        ).length,
        1,
    );
    assert.equal(
        defaultSubscriptions.filter(
            (subscription) =>
                subscription.deviceLabel ===
                notificationRolloutDefaultDeviceLabel,
        ).length,
        1,
    );
    assert.equal(
        deniedSubscriptions.filter(
            (subscription) =>
                !subscription.enabled &&
                subscription.revokedReason ===
                    'permission_denied_rollout_backfill' &&
                Boolean(subscription.revokedAt),
        ).length,
        1,
    );
    assert.equal(
        deniedSubscriptions.filter(
            (subscription) =>
                subscription.enabled &&
                subscription.permissionState === 'denied' &&
                !subscription.revokedAt,
        ).length,
        1,
    );
});

test('delivery preference backfill inherits global quiet hours without replacing explicit overrides', async () => {
    createTestDb();
    await ensureFarmId();
    const userId = await createUserWithPassword(
        `delivery-backfill-quiet-hours-${randomUUID()}@example.com`,
        'password',
    );
    const user = await getUser(userId);
    assert.ok(user);
    const accountId = user.accounts[0]?.accountId;
    assert.ok(accountId);

    await storage()
        .update(users)
        .set({ createdAt: new Date('1800-01-01T00:00:00.000Z') })
        .where(eq(users.id, userId));
    await storage().insert(userNotificationSettings).values({
        userId,
        emailEnabled: false,
        dailyDigest: true,
    });
    await storage()
        .insert(notificationUserChannelPreferences)
        .values([
            {
                userId,
                category: 'reminders',
                channel: 'in_app',
                enabled: true,
                quietHoursStartMinute: 22 * 60,
                quietHoursEndMinute: 6 * 60,
                timezone: 'UTC',
            },
            {
                userId,
                category: 'delivery_updates',
                channel: 'push',
                enabled: false,
                timezone: 'Europe/Zagreb',
            },
        ]);
    const subscriptionId = randomUUID();
    await storage()
        .insert(webPushSubscriptions)
        .values({
            id: subscriptionId,
            accountId,
            userId,
            endpoint: `https://example.com/${subscriptionId}`,
            p256dh: 'k',
            auth: 'a',
            enabled: true,
            permissionState: 'granted',
        });

    const result = await backfillNotificationRolloutDefaults({ limit: 1 });
    assert.equal(result.usersScanned, 1);

    const deliveryPreferences = await storage()
        .select({
            channel: notificationUserChannelPreferences.channel,
            digestFrequency: notificationUserChannelPreferences.digestFrequency,
            enabled: notificationUserChannelPreferences.enabled,
            quietHoursEndMinute:
                notificationUserChannelPreferences.quietHoursEndMinute,
            quietHoursStartMinute:
                notificationUserChannelPreferences.quietHoursStartMinute,
            timezone: notificationUserChannelPreferences.timezone,
        })
        .from(notificationUserChannelPreferences)
        .where(
            and(
                eq(notificationUserChannelPreferences.userId, userId),
                eq(
                    notificationUserChannelPreferences.category,
                    'delivery_updates',
                ),
            ),
        );
    assert.deepEqual(
        deliveryPreferences.sort((left, right) =>
            left.channel.localeCompare(right.channel),
        ),
        [
            {
                channel: 'email',
                digestFrequency: 'off',
                enabled: false,
                quietHoursEndMinute: 6 * 60,
                quietHoursStartMinute: 22 * 60,
                timezone: 'UTC',
            },
            {
                channel: 'in_app',
                digestFrequency: 'off',
                enabled: true,
                quietHoursEndMinute: 6 * 60,
                quietHoursStartMinute: 22 * 60,
                timezone: 'UTC',
            },
            {
                channel: 'push',
                digestFrequency: 'off',
                enabled: false,
                quietHoursEndMinute: null,
                quietHoursStartMinute: null,
                timezone: 'Europe/Zagreb',
            },
        ],
    );

    const notificationId = await createNotification(
        {
            accountId,
            userId,
            header: 'Dostava',
            content: 'Ažuriranje dostave.',
            category: 'delivery_updates',
            timestamp: new Date('2026-07-16T23:00:00.000Z'),
        },
        { routeDelivery: false },
    );
    const decisions = await routeNotificationDelivery(notificationId, {
        now: new Date('2026-07-16T23:00:00.000Z'),
    });
    assert.ok(
        decisions.some(
            (decision) =>
                decision.channel === 'in_app' &&
                decision.outcome === 'deferred' &&
                decision.reason === 'quiet_hours',
        ),
    );
    assert.ok(
        decisions.some(
            (decision) =>
                decision.channel === 'email' &&
                decision.outcome === 'suppressed' &&
                decision.reason === 'preference_disabled',
        ),
    );
    assert.ok(
        decisions.some(
            (decision) =>
                decision.channel === 'push' &&
                decision.outcome === 'suppressed' &&
                decision.reason === 'preference_disabled',
        ),
    );
});

test('delivery lifecycle email candidates claim per account user with live preferences and durable retries', async () => {
    createTestDb();
    await ensureFarmId();
    const disabledEmail = `delivery-email-disabled-${randomUUID()}@example.com`;
    const quietEmail = `delivery-email-quiet-${randomUUID()}@example.com`;
    const disabledUserId = await createUserWithPassword(
        disabledEmail,
        'password',
    );
    const quietUserId = await createUserWithPassword(quietEmail, 'password');
    const disabledUser = await getUser(disabledUserId);
    assert.ok(disabledUser);
    const accountId = disabledUser.accounts[0]?.accountId;
    assert.ok(accountId);
    await storage()
        .insert(accountUsers)
        .values([
            { accountId, userId: quietUserId },
            { accountId, userId: quietUserId },
        ]);
    await storage()
        .insert(notificationUserChannelPreferences)
        .values([
            {
                category: 'delivery_updates',
                channel: 'email',
                enabled: false,
                userId: disabledUserId,
            },
            {
                category: 'delivery_updates',
                channel: 'email',
                enabled: true,
                quietHoursEndMinute: 6 * 60,
                quietHoursStartMinute: 22 * 60,
                timezone: 'UTC',
                userId: quietUserId,
            },
        ]);

    const metadata = {
        eventVersion: 1,
        milestone: 'route-started',
        requestId: `request:${randomUUID()}`,
        retryAttempt: 0,
        runId: `run:${randomUUID()}`,
        stopId: `stop:${randomUUID()}`,
    };
    const notificationId = await createNotification({
        accountId,
        category: 'delivery_updates',
        content: 'Catalog content is not the email source.',
        header: 'Catalog header is not the email source.',
        metadata,
        timestamp: new Date('2026-07-17T00:00:00.000Z'),
        type: 'delivery_lifecycle',
    });
    const wrongTypeId = await createNotification(
        {
            accountId,
            category: 'delivery_updates',
            content: 'Wrong type',
            header: 'Wrong type',
            metadata,
            timestamp: new Date('2026-07-16T20:01:00.000Z'),
            type: 'route-started',
        },
        { routeDelivery: false },
    );
    const wrongCategoryId = await createNotification(
        {
            accountId,
            category: 'general',
            content: 'Wrong category',
            header: 'Wrong category',
            metadata,
            timestamp: new Date('2026-07-16T20:02:00.000Z'),
            type: 'delivery_lifecycle',
        },
        { routeDelivery: false },
    );
    const accountWithoutUsers = await createTestAccount();
    const noRecipientId = await createNotification(
        {
            accountId: accountWithoutUsers,
            category: 'delivery_updates',
            content: 'No recipient',
            header: 'No recipient',
            metadata,
            timestamp: new Date('2026-07-16T20:03:00.000Z'),
            type: 'delivery_lifecycle',
        },
        { routeDelivery: false },
    );

    const initialCandidates = await getDeliveryLifecycleEmailCandidates();
    assert.deepEqual(
        initialCandidates
            .filter((candidate) => candidate.notificationId === notificationId)
            .map((candidate) => candidate.userId)
            .sort(),
        [disabledUserId, quietUserId].sort(),
    );
    for (const excludedId of [wrongTypeId, wrongCategoryId, noRecipientId]) {
        assert.equal(
            initialCandidates.some(
                (candidate) => candidate.notificationId === excludedId,
            ),
            false,
        );
    }

    const quietTime = new Date('2026-07-17T01:00:00.000Z');
    const disabled = await claimDeliveryLifecycleEmailCandidate({
        notificationId,
        now: quietTime,
        userId: disabledUserId,
    });
    assert.deepEqual(disabled, {
        reason: 'preference_disabled',
        status: 'skipped',
    });
    const deferred = await claimDeliveryLifecycleEmailCandidate({
        notificationId,
        now: quietTime,
        userId: quietUserId,
    });
    assert.deepEqual(deferred, {
        reason: 'quiet_hours',
        status: 'deferred',
    });

    const deliveryTime = new Date('2026-07-17T12:00:00.000Z');
    const concurrentClaims = await Promise.all(
        Array.from(
            { length: 10 },
            async () =>
                await claimDeliveryLifecycleEmailCandidate({
                    notificationId,
                    now: deliveryTime,
                    userId: quietUserId,
                }),
        ),
    );
    const claimed = concurrentClaims.filter(
        (result) => result.status === 'claimed',
    );
    assert.equal(claimed.length, 1);
    const firstClaim = claimed[0];
    assert.ok(firstClaim && firstClaim.status === 'claimed');
    assert.equal(firstClaim.claim.accountId, accountId);
    assert.equal(firstClaim.claim.email, quietEmail);
    assert.deepEqual(firstClaim.claim.metadata, metadata);
    assert.equal(
        concurrentClaims.filter(
            (result) =>
                result.status === 'unavailable' &&
                result.reason === 'already_claimed',
        ).length,
        9,
    );

    assert.equal(
        (
            await getDeliveryLifecycleEmailCandidates({
                now: new Date('2026-07-17T12:04:00.000Z'),
            })
        ).some(
            (candidate) =>
                candidate.notificationId === notificationId &&
                candidate.userId === quietUserId,
        ),
        false,
    );
    assert.equal(
        (
            await getDeliveryLifecycleEmailCandidates({
                now: new Date('2026-07-17T12:06:00.000Z'),
            })
        ).some(
            (candidate) =>
                candidate.notificationId === notificationId &&
                candidate.userId === quietUserId,
        ),
        true,
    );
    assert.deepEqual(
        await startDeliveryLifecycleEmailAttempt({
            attemptId: firstClaim.claim.attemptId,
            notificationId,
            now: new Date('2026-07-17T23:00:00.000Z'),
            userId: quietUserId,
        }),
        { reason: 'claim_unavailable', status: 'unavailable' },
    );
    await storage()
        .update(notificationUserChannelPreferences)
        .set({
            quietHoursEndMinute: 23 * 60 + 1,
            quietHoursStartMinute: 22 * 60,
            timezone: 'UTC',
        })
        .where(
            and(
                eq(notificationUserChannelPreferences.userId, quietUserId),
                eq(
                    notificationUserChannelPreferences.category,
                    'delivery_updates',
                ),
                eq(notificationUserChannelPreferences.channel, 'email'),
            ),
        );
    const staleClaimDuringQuietHours =
        await claimDeliveryLifecycleEmailCandidate({
            notificationId,
            now: new Date('2026-07-17T23:00:00.000Z'),
            userId: quietUserId,
        });
    assert.deepEqual(staleClaimDuringQuietHours, {
        reason: 'quiet_hours',
        status: 'deferred',
    });
    assert.deepEqual(
        await startDeliveryLifecycleEmailAttempt({
            attemptId: firstClaim.claim.attemptId,
            notificationId,
            now: new Date('2026-07-17T23:00:01.000Z'),
            userId: quietUserId,
        }),
        { reason: 'claim_unavailable', status: 'unavailable' },
    );
    await storage()
        .update(notificationUserChannelPreferences)
        .set({
            quietHoursEndMinute: null,
            quietHoursStartMinute: null,
            timezone: null,
        })
        .where(
            and(
                eq(notificationUserChannelPreferences.userId, quietUserId),
                eq(
                    notificationUserChannelPreferences.category,
                    'delivery_updates',
                ),
                eq(notificationUserChannelPreferences.channel, 'email'),
            ),
        );
    const freshClaim = await claimDeliveryLifecycleEmailCandidate({
        notificationId,
        now: new Date('2026-07-17T23:01:00.000Z'),
        userId: quietUserId,
    });
    assert.equal(freshClaim.status, 'claimed');
    assert.ok(freshClaim.status === 'claimed');
    assert.notEqual(freshClaim.claim.attemptId, firstClaim.claim.attemptId);
    assert.deepEqual(
        await startDeliveryLifecycleEmailAttempt({
            attemptId: freshClaim.claim.attemptId,
            notificationId,
            now: new Date('2026-07-17T23:01:01.000Z'),
            userId: quietUserId,
        }),
        { email: quietEmail, status: 'started' },
    );
    assert.equal(
        (
            await getDeliveryLifecycleEmailCandidates({
                now: new Date('2026-07-17T23:02:00.000Z'),
            })
        ).some(
            (candidate) =>
                candidate.notificationId === notificationId &&
                candidate.userId === quietUserId,
        ),
        false,
    );
    assert.equal(
        await markDeliveryLifecycleEmailAttemptFailed({
            attemptId: freshClaim.claim.attemptId,
            notificationId,
            now: new Date('2026-07-17T23:02:01.000Z'),
            userId: quietUserId,
        }),
        true,
    );
    assert.equal(
        (await getDeliveryLifecycleEmailCandidates()).some(
            (candidate) =>
                candidate.notificationId === notificationId &&
                candidate.userId === quietUserId,
        ),
        true,
    );
    assert.equal(
        (await getDeliveryLifecycleEmailCandidates({ maxAttempts: 1 })).some(
            (candidate) =>
                candidate.notificationId === notificationId &&
                candidate.userId === quietUserId,
        ),
        false,
    );
    assert.deepEqual(
        await claimDeliveryLifecycleEmailCandidate({
            maxAttempts: 1,
            notificationId,
            now: new Date('2026-07-17T23:02:30.000Z'),
            userId: quietUserId,
        }),
        { reason: 'attempts_exhausted', status: 'unavailable' },
    );
    assert.deepEqual(
        await claimDeliveryLifecycleEmailCandidate({
            maxAttempts: 1,
            notificationId,
            now: new Date('2026-07-17T23:02:31.000Z'),
            userId: quietUserId,
        }),
        { reason: 'attempts_exhausted', status: 'unavailable' },
    );
    const exhaustedEvents = await storage()
        .select({ metadata: notificationDeliveryEvents.metadata })
        .from(notificationDeliveryEvents)
        .where(
            and(
                eq(notificationDeliveryEvents.notificationId, notificationId),
                eq(notificationDeliveryEvents.type, 'failed'),
            ),
        );
    assert.deepEqual(
        exhaustedEvents.filter(
            (event) => event.metadata.reason === 'attempts_exhausted',
        ),
        [
            {
                metadata: {
                    provider: 'delivery_lifecycle_email',
                    reason: 'attempts_exhausted',
                    retryable: false,
                },
            },
        ],
    );
    const retry = await claimDeliveryLifecycleEmailCandidate({
        notificationId,
        now: new Date('2026-07-17T23:03:00.000Z'),
        userId: quietUserId,
    });
    assert.equal(retry.status, 'claimed');
    assert.ok(retry.status === 'claimed');
    assert.deepEqual(
        await startDeliveryLifecycleEmailAttempt({
            attemptId: retry.claim.attemptId,
            notificationId,
            now: new Date('2026-07-17T23:03:01.000Z'),
            userId: quietUserId,
        }),
        { email: quietEmail, status: 'started' },
    );
    assert.equal(
        await markDeliveryLifecycleEmailAttemptSent({
            attemptId: retry.claim.attemptId,
            notificationId,
            now: new Date('2026-07-17T23:04:00.000Z'),
            providerMessageId: `provider:${'x'.repeat(200)}`,
            userId: quietUserId,
        }),
        true,
    );
    assert.equal(
        (await getDeliveryLifecycleEmailCandidates()).some(
            (candidate) => candidate.notificationId === notificationId,
        ),
        false,
    );

    const providerAttempts = await storage()
        .select({
            providerMessageId: notificationDeliveryAttempts.providerMessageId,
            providerResponseCode:
                notificationDeliveryAttempts.providerResponseCode,
            status: notificationDeliveryAttempts.status,
            userId: notificationDeliveryAttempts.userId,
        })
        .from(notificationDeliveryAttempts)
        .where(
            and(
                eq(notificationDeliveryAttempts.notificationId, notificationId),
                eq(
                    notificationDeliveryAttempts.provider,
                    'delivery_lifecycle_email',
                ),
            ),
        )
        .orderBy(asc(notificationDeliveryAttempts.id));
    assert.deepEqual(
        providerAttempts.map(({ status, userId }) => ({ status, userId })),
        [
            { status: 'dropped', userId: disabledUserId },
            { status: 'failed', userId: quietUserId },
            { status: 'failed', userId: quietUserId },
            { status: 'sent', userId: quietUserId },
        ],
    );
    assert.equal(providerAttempts[3]?.providerMessageId?.length, 128);
    assert.deepEqual(
        providerAttempts.map((attempt) => attempt.providerResponseCode),
        [
            'preference_disabled',
            'claim_expired_before_send',
            'sender_failed',
            'sent',
        ],
    );
    const events = await storage()
        .select({ type: notificationDeliveryEvents.type })
        .from(notificationDeliveryEvents)
        .where(eq(notificationDeliveryEvents.notificationId, notificationId))
        .orderBy(asc(notificationDeliveryEvents.id));
    assert.deepEqual(
        events.map((event) => event.type),
        [
            'failed',
            'queued',
            'failed',
            'queued',
            'failed',
            'failed',
            'queued',
            'sent',
        ],
    );

    const invalidRecipientNotificationId = await createNotification(
        {
            accountId,
            category: 'delivery_updates',
            content: 'Invalid recipient test.',
            header: 'Invalid recipient test',
            metadata,
            timestamp: new Date('2026-07-17T13:00:00.000Z'),
            type: 'delivery_lifecycle',
        },
        { routeDelivery: false },
    );
    await storage()
        .update(users)
        .set({ userName: 'x'.repeat(300) })
        .where(eq(users.id, quietUserId));
    assert.deepEqual(
        await claimDeliveryLifecycleEmailCandidate({
            notificationId: invalidRecipientNotificationId,
            now: new Date('2026-07-17T13:01:00.000Z'),
            userId: quietUserId,
        }),
        { reason: 'invalid_recipient', status: 'unavailable' },
    );
    const invalidRecipientAttempts = await storage()
        .select({
            providerResponseCode:
                notificationDeliveryAttempts.providerResponseCode,
            status: notificationDeliveryAttempts.status,
        })
        .from(notificationDeliveryAttempts)
        .where(
            and(
                eq(
                    notificationDeliveryAttempts.notificationId,
                    invalidRecipientNotificationId,
                ),
                eq(
                    notificationDeliveryAttempts.provider,
                    'delivery_lifecycle_email',
                ),
                eq(notificationDeliveryAttempts.userId, quietUserId),
            ),
        );
    assert.deepEqual(invalidRecipientAttempts, [
        { providerResponseCode: 'invalid_recipient', status: 'dropped' },
    ]);
});

test('final email failure records exhaustion before candidate filtering and alerts health', async () => {
    createTestDb();
    await ensureFarmId();
    const email = `delivery-email-exhaustion-${randomUUID()}@example.com`;
    const userId = await createUserWithPassword(email, 'password');
    const accountId = (await getUser(userId))?.accounts[0]?.accountId;
    assert.ok(accountId);
    const now = new Date('2051-07-16T12:00:00.000Z');
    const requestId = `request:${randomUUID()}`;
    const notificationId = await createNotification(
        {
            accountId,
            category: 'delivery_updates',
            content: 'Exhaustion test.',
            header: 'Exhaustion test',
            metadata: {
                eventVersion: 1,
                milestone: 'arrived',
                requestId,
                retryAttempt: 0,
                runId: `run:${randomUUID()}`,
                source: {
                    id: `arrival:${randomUUID()}`,
                    kind: 'stop-operation',
                    version: 1,
                },
                stopId: '42',
            },
            timestamp: now,
            ttlSeconds: 24 * 60 * 60,
            type: 'delivery_lifecycle',
            userId,
        },
        { routeDelivery: false },
    );
    const candidate = (
        await getDeliveryLifecycleEmailCandidates({ maxAttempts: 1, now })
    ).find((item) => item.notificationId === notificationId);
    assert.ok(candidate);
    const claim = await claimDeliveryLifecycleEmailCandidate({
        ...candidate,
        maxAttempts: 1,
        now,
    });
    assert.equal(claim.status, 'claimed');
    assert.ok(claim.status === 'claimed');
    assert.deepEqual(
        await startDeliveryLifecycleEmailAttempt({
            attemptId: claim.claim.attemptId,
            notificationId,
            now: new Date(now.getTime() + 1_000),
            userId,
        }),
        { email, status: 'started' },
    );
    assert.equal(
        await markDeliveryLifecycleEmailAttemptFailed({
            attemptId: claim.claim.attemptId,
            maxAttempts: 1,
            notificationId,
            now: new Date(now.getTime() + 2_000),
            userId,
        }),
        true,
    );
    assert.equal(
        (
            await getDeliveryLifecycleEmailCandidates({
                maxAttempts: 1,
                now: new Date(now.getTime() + 3_000),
            })
        ).some((item) => item.notificationId === notificationId),
        false,
    );
    const health = await getDeliveryLifecycleNotificationHealth({
        from: now,
        requestId,
        to: new Date(now.getTime() + 3_000),
    });
    assert.equal(health.retryExhaustedCount, 1);
    assert.equal(health.alerts.retryExhausted, true);

    assert.deepEqual(
        await claimDeliveryLifecycleEmailCandidate({
            ...candidate,
            maxAttempts: 1,
            now: new Date(now.getTime() + 4_000),
        }),
        { reason: 'attempts_exhausted', status: 'unavailable' },
    );
    const failedEvents = await storage()
        .select({ metadata: notificationDeliveryEvents.metadata })
        .from(notificationDeliveryEvents)
        .where(
            and(
                eq(notificationDeliveryEvents.notificationId, notificationId),
                eq(notificationDeliveryEvents.type, 'failed'),
            ),
        );
    assert.equal(
        failedEvents.filter(
            ({ metadata }) => metadata.reason === 'attempts_exhausted',
        ).length,
        1,
    );
    assert.equal(
        failedEvents.some(
            ({ metadata }) =>
                metadata.reason === undefined && metadata.retryable === false,
        ),
        true,
    );
});

test('durable email quiet-hour cursors rotate the batch and preserve the actual audit time', async () => {
    createTestDb();
    await ensureFarmId();
    const quietUserId = await createUserWithPassword(
        `delivery-email-quiet-backlog-${randomUUID()}@example.com`,
        'password',
    );
    const immediateUserId = await createUserWithPassword(
        `delivery-email-immediate-${randomUUID()}@example.com`,
        'password',
    );
    const quietUser = await getUser(quietUserId);
    const immediateUser = await getUser(immediateUserId);
    const quietAccountId = quietUser?.accounts[0]?.accountId;
    const immediateAccountId = immediateUser?.accounts[0]?.accountId;
    assert.ok(quietAccountId);
    assert.ok(immediateAccountId);
    await storage()
        .insert(notificationUserChannelPreferences)
        .values({
            category: 'delivery_updates',
            channel: 'email',
            enabled: true,
            quietHoursEndMinute: 6 * 60,
            quietHoursStartMinute: 22 * 60,
            timezone: 'UTC',
            userId: quietUserId,
        });

    const quietNow = new Date('2026-07-20T23:00:00.000Z');
    const createEmailNotification = async ({
        accountId,
        createdAt,
        label,
        userId,
    }: {
        accountId: string;
        createdAt: Date;
        label: string;
        userId: string;
    }) => {
        const notificationId = await createNotification(
            {
                accountId,
                category: 'delivery_updates',
                content: label,
                header: label,
                metadata: {
                    eventVersion: 1,
                    milestone: 'route-started',
                    requestId: `request:${randomUUID()}`,
                    retryAttempt: 0,
                    runId: `run:${randomUUID()}`,
                    stopId: `stop:${randomUUID()}`,
                },
                timestamp: quietNow,
                ttlSeconds: 24 * 60 * 60,
                type: 'delivery_lifecycle',
                userId,
            },
            { routeDelivery: false },
        );
        await storage()
            .update(notifications)
            .set({ createdAt })
            .where(eq(notifications.id, notificationId));
        return notificationId;
    };

    const quietNotificationIds = await Promise.all(
        [0, 1, 2].map(
            async (index) =>
                await createEmailNotification({
                    accountId: quietAccountId,
                    createdAt: new Date(Date.UTC(2000, 0, 1, 0, index, 0, 0)),
                    label: `Quiet ${index}`,
                    userId: quietUserId,
                }),
        ),
    );
    const immediateNotificationId = await createEmailNotification({
        accountId: immediateAccountId,
        createdAt: new Date(Date.UTC(2000, 0, 1, 0, 3, 0, 0)),
        label: 'Immediate',
        userId: immediateUserId,
    });

    const firstBatch = await getDeliveryLifecycleEmailCandidates({
        limit: 2,
        now: quietNow,
    });
    assert.deepEqual(
        firstBatch.map((candidate) => candidate.notificationId),
        quietNotificationIds.slice(0, 2),
    );
    for (const candidate of firstBatch) {
        assert.deepEqual(
            await claimDeliveryLifecycleEmailCandidate({
                ...candidate,
                now: quietNow,
            }),
            { reason: 'quiet_hours', status: 'deferred' },
        );
    }

    const secondBatch = await getDeliveryLifecycleEmailCandidates({
        limit: 2,
        now: quietNow,
    });
    assert.deepEqual(
        secondBatch.map((candidate) => candidate.notificationId),
        [quietNotificationIds[2], immediateNotificationId],
    );
    const quietCandidate = secondBatch[0];
    const immediateCandidate = secondBatch[1];
    assert.ok(quietCandidate);
    assert.ok(immediateCandidate);
    const quietDeferred = await claimDeliveryLifecycleEmailCandidate({
        ...quietCandidate,
        now: quietNow,
    });
    assert.deepEqual(quietDeferred, {
        reason: 'quiet_hours',
        status: 'deferred',
    });
    const immediateClaim = await claimDeliveryLifecycleEmailCandidate({
        ...immediateCandidate,
        now: quietNow,
    });
    assert.equal(immediateClaim.status, 'claimed');
    assert.ok(immediateClaim.status === 'claimed');
    const immediateStart = await startDeliveryLifecycleEmailAttempt({
        attemptId: immediateClaim.claim.attemptId,
        notificationId: immediateNotificationId,
        now: new Date(quietNow.getTime() + 1_000),
        userId: immediateUserId,
    });
    assert.equal(immediateStart.status, 'started');
    assert.equal(
        await markDeliveryLifecycleEmailAttemptSent({
            attemptId: immediateClaim.claim.attemptId,
            notificationId: immediateNotificationId,
            now: new Date(quietNow.getTime() + 2_000),
            userId: immediateUserId,
        }),
        true,
    );

    const deferredAttempts = await storage()
        .select({
            attemptedAt: notificationDeliveryAttempts.attemptedAt,
            id: notificationDeliveryAttempts.id,
        })
        .from(notificationDeliveryAttempts)
        .where(
            and(
                eq(
                    notificationDeliveryAttempts.provider,
                    'delivery_lifecycle_email',
                ),
                eq(
                    notificationDeliveryAttempts.providerResponseCode,
                    'quiet_hours',
                ),
                inArray(
                    notificationDeliveryAttempts.notificationId,
                    quietNotificationIds,
                ),
            ),
        );
    assert.equal(deferredAttempts.length, 3);
    for (const attempt of deferredAttempts) {
        assert.equal(
            attempt.attemptedAt.toISOString(),
            '2026-07-21T06:00:00.000Z',
        );
        const queuedEvent =
            await storage().query.notificationDeliveryEvents.findFirst({
                where: eq(
                    notificationDeliveryEvents.deliveryAttemptId,
                    attempt.id,
                ),
            });
        assert.ok(queuedEvent);
        assert.equal(
            queuedEvent.occurredAt.toISOString(),
            quietNow.toISOString(),
        );
        assert.equal(
            queuedEvent.metadata?.eligibleAt,
            '2026-07-21T06:00:00.000Z',
        );
        assert.equal(queuedEvent.metadata?.reason, 'quiet_hours');
    }

    const newImmediateNotificationId = await createEmailNotification({
        accountId: immediateAccountId,
        createdAt: new Date(Date.UTC(2001, 0, 1)),
        label: 'New immediate update',
        userId: immediateUserId,
    });
    const evenMinute = new Date('2026-07-21T06:00:00.000Z');
    const oddMinute = new Date('2026-07-21T06:01:00.000Z');
    const firstEvenMinuteBatch = await getDeliveryLifecycleEmailCandidates({
        limit: 1,
        now: evenMinute,
    });
    assert.deepEqual(
        firstEvenMinuteBatch.map((candidate) => candidate.notificationId),
        [newImmediateNotificationId],
    );
    const repeatedEvenMinuteBatch = await getDeliveryLifecycleEmailCandidates({
        limit: 1,
        now: evenMinute,
    });
    assert.deepEqual(repeatedEvenMinuteBatch, firstEvenMinuteBatch);
    const oddMinuteBatch = await getDeliveryLifecycleEmailCandidates({
        limit: 1,
        now: oddMinute,
    });
    assert.deepEqual(
        oddMinuteBatch.map((candidate) => candidate.notificationId),
        [quietNotificationIds[0]],
    );
    const fairBatch = await getDeliveryLifecycleEmailCandidates({
        limit: 2,
        now: evenMinute,
    });
    assert.deepEqual(
        fairBatch.map((candidate) => candidate.notificationId),
        [newImmediateNotificationId, quietNotificationIds[0]],
    );
    await storage()
        .update(notificationDeliveryAttempts)
        .set({ status: 'sent' })
        .where(
            and(
                inArray(
                    notificationDeliveryAttempts.notificationId,
                    quietNotificationIds,
                ),
                eq(
                    notificationDeliveryAttempts.provider,
                    'delivery_lifecycle_email',
                ),
            ),
        );
    const oddMinuteFallbackBatch = await getDeliveryLifecycleEmailCandidates({
        limit: 1,
        now: oddMinute,
    });
    assert.deepEqual(
        oddMinuteFallbackBatch.map((candidate) => candidate.notificationId),
        [newImmediateNotificationId],
    );
});

test('delivery lifecycle email quiet-hour cursors resolve Zagreb DST gaps and folds', async () => {
    createTestDb();
    await ensureFarmId();
    const cases = [
        {
            expectedEligibility: '2026-03-29T01:00:00.000Z',
            label: 'spring-forward',
            now: new Date('2026-03-29T00:30:00.000Z'),
        },
        {
            expectedEligibility: '2026-10-25T01:30:00.000Z',
            label: 'fall-back',
            now: new Date('2026-10-24T23:30:00.000Z'),
        },
    ];

    for (const scenario of cases) {
        const email = `delivery-email-${scenario.label}-${randomUUID()}@example.com`;
        const userId = await createUserWithPassword(email, 'password');
        const accountId = (await getUser(userId))?.accounts[0]?.accountId;
        assert.ok(accountId);
        await storage()
            .insert(notificationUserChannelPreferences)
            .values({
                category: 'delivery_updates',
                channel: 'email',
                enabled: true,
                quietHoursEndMinute: 2 * 60 + 30,
                quietHoursStartMinute: 22 * 60,
                timezone: 'Europe/Zagreb',
                userId,
            });
        const notificationId = await createNotification(
            {
                accountId,
                category: 'delivery_updates',
                content: scenario.label,
                header: scenario.label,
                metadata: {
                    eventVersion: 1,
                    milestone: 'route-started',
                    requestId: `request:${randomUUID()}`,
                    retryAttempt: 0,
                    runId: `run:${randomUUID()}`,
                    stopId: `stop:${randomUUID()}`,
                },
                timestamp: scenario.now,
                ttlSeconds: 24 * 60 * 60,
                type: 'delivery_lifecycle',
                userId,
            },
            { routeDelivery: false },
        );

        assert.deepEqual(
            await claimDeliveryLifecycleEmailCandidate({
                notificationId,
                now: scenario.now,
                userId,
            }),
            { reason: 'quiet_hours', status: 'deferred' },
        );
        const attempt =
            await storage().query.notificationDeliveryAttempts.findFirst({
                where: and(
                    eq(
                        notificationDeliveryAttempts.notificationId,
                        notificationId,
                    ),
                    eq(
                        notificationDeliveryAttempts.provider,
                        'delivery_lifecycle_email',
                    ),
                ),
            });
        assert.ok(attempt);
        assert.equal(
            attempt.attemptedAt.toISOString(),
            scenario.expectedEligibility,
        );
    }
});

test('email TTL prevents a retained lifecycle notification from resurrecting after attempt cleanup', async () => {
    createTestDb();
    await ensureFarmId();
    const email = `delivery-email-expiry-${randomUUID()}@example.com`;
    const userId = await createUserWithPassword(email, 'password');
    const user = await getUser(userId);
    const accountId = user?.accounts[0]?.accountId;
    assert.ok(accountId);
    const occurredAt = new Date('2026-07-20T12:00:00.000Z');
    const notificationId = await createNotification(
        {
            accountId,
            category: 'delivery_updates',
            content: 'Expiring delivery update.',
            header: 'Expiring delivery update',
            metadata: {
                eventVersion: 1,
                milestone: 'route-started',
                requestId: `request:${randomUUID()}`,
                retryAttempt: 0,
                runId: `run:${randomUUID()}`,
                stopId: `stop:${randomUUID()}`,
            },
            timestamp: occurredAt,
            ttlSeconds: 60,
            type: 'delivery_lifecycle',
            userId,
        },
        { routeDelivery: false },
    );
    const claimed = await claimDeliveryLifecycleEmailCandidate({
        notificationId,
        now: new Date(occurredAt.getTime() + 10_000),
        userId,
    });
    assert.equal(claimed.status, 'claimed');
    assert.ok(claimed.status === 'claimed');
    assert.deepEqual(
        await startDeliveryLifecycleEmailAttempt({
            attemptId: claimed.claim.attemptId,
            notificationId,
            now: new Date(occurredAt.getTime() + 11_000),
            userId,
        }),
        { email, status: 'started' },
    );
    assert.equal(
        await markDeliveryLifecycleEmailAttemptSent({
            attemptId: claimed.claim.attemptId,
            notificationId,
            now: new Date(occurredAt.getTime() + 12_000),
            userId,
        }),
        true,
    );
    await storage()
        .delete(notificationDeliveryAttempts)
        .where(eq(notificationDeliveryAttempts.id, claimed.claim.attemptId));

    const afterExpiry = new Date(occurredAt.getTime() + 61_000);
    assert.equal(
        (await getDeliveryLifecycleEmailCandidates({ now: afterExpiry })).some(
            (candidate) => candidate.notificationId === notificationId,
        ),
        false,
    );
    assert.deepEqual(
        await claimDeliveryLifecycleEmailCandidate({
            notificationId,
            now: afterExpiry,
            userId,
        }),
        { reason: 'notification_expired', status: 'unavailable' },
    );
    const terminalAttempt =
        await storage().query.notificationDeliveryAttempts.findFirst({
            where: and(
                eq(notificationDeliveryAttempts.notificationId, notificationId),
                eq(
                    notificationDeliveryAttempts.provider,
                    'delivery_lifecycle_email',
                ),
            ),
        });
    assert.ok(terminalAttempt);
    assert.equal(terminalAttempt.status, 'dropped');
    assert.equal(terminalAttempt.providerResponseCode, 'notification_expired');
});

test('delivery lifecycle email enforces the 24-hour fence for null and oversized TTLs after audit cleanup', async () => {
    createTestDb();
    await ensureFarmId();
    const email = `delivery-email-hard-expiry-${randomUUID()}@example.com`;
    const userId = await createUserWithPassword(email, 'password');
    const accountId = (await getUser(userId))?.accounts[0]?.accountId;
    assert.ok(accountId);
    const occurredAt = new Date('2026-07-20T12:00:00.000Z');

    for (const [label, ttlSeconds] of [
        ['null', null],
        ['oversized', 7 * 24 * 60 * 60],
    ] as const) {
        const notificationId = await createNotification(
            {
                accountId,
                category: 'delivery_updates',
                content: `Hard expiry ${label}`,
                header: `Hard expiry ${label}`,
                metadata: {
                    eventVersion: 1,
                    milestone: 'route-started',
                    requestId: `request:${randomUUID()}`,
                    retryAttempt: 0,
                    runId: `run:${randomUUID()}`,
                    stopId: `stop:${randomUUID()}`,
                },
                timestamp: occurredAt,
                ttlSeconds,
                type: 'delivery_lifecycle',
                userId,
            },
            { routeDelivery: false },
        );
        const claimed = await claimDeliveryLifecycleEmailCandidate({
            notificationId,
            now: new Date(occurredAt.getTime() + 1_000),
            userId,
        });
        assert.equal(claimed.status, 'claimed');
        assert.ok(claimed.status === 'claimed');
        assert.deepEqual(
            await startDeliveryLifecycleEmailAttempt({
                attemptId: claimed.claim.attemptId,
                notificationId,
                now: new Date(occurredAt.getTime() + 2_000),
                userId,
            }),
            { email, status: 'started' },
        );
        assert.equal(
            await markDeliveryLifecycleEmailAttemptSent({
                attemptId: claimed.claim.attemptId,
                notificationId,
                now: new Date(occurredAt.getTime() + 3_000),
                userId,
            }),
            true,
        );
        await storage()
            .delete(notificationDeliveryAttempts)
            .where(
                eq(notificationDeliveryAttempts.id, claimed.claim.attemptId),
            );

        const afterHardExpiry = new Date(
            occurredAt.getTime() + 24 * 60 * 60 * 1000 + 1,
        );
        assert.equal(
            (
                await getDeliveryLifecycleEmailCandidates({
                    now: afterHardExpiry,
                })
            ).some((candidate) => candidate.notificationId === notificationId),
            false,
        );
        assert.deepEqual(
            await claimDeliveryLifecycleEmailCandidate({
                notificationId,
                now: afterHardExpiry,
                userId,
            }),
            { reason: 'notification_expired', status: 'unavailable' },
        );
    }
});

test('email start revalidates recipient, policy, quiet hours, TTL, and address after claim', async () => {
    createTestDb();
    await ensureFarmId();
    const baseTime = new Date('2026-07-20T11:59:00.000Z');
    const createClaim = async ({
        claimAt = baseTime,
        label,
        timestamp = baseTime,
        ttlSeconds = 24 * 60 * 60,
    }: {
        claimAt?: Date;
        label: string;
        timestamp?: Date;
        ttlSeconds?: number;
    }) => {
        const email = `delivery-start-${label}-${randomUUID()}@example.com`;
        const userId = await createUserWithPassword(email, 'password');
        const accountId = (await getUser(userId))?.accounts[0]?.accountId;
        assert.ok(accountId);
        const notificationId = await createNotification(
            {
                accountId,
                category: 'delivery_updates',
                content: label,
                header: label,
                metadata: {
                    eventVersion: 1,
                    milestone: 'route-started',
                    requestId: `request:${randomUUID()}`,
                    retryAttempt: 0,
                    runId: `run:${randomUUID()}`,
                    stopId: `stop:${randomUUID()}`,
                },
                timestamp,
                ttlSeconds,
                type: 'delivery_lifecycle',
                userId,
            },
            { routeDelivery: false },
        );
        const claimed = await claimDeliveryLifecycleEmailCandidate({
            notificationId,
            now: claimAt,
            userId,
        });
        assert.equal(claimed.status, 'claimed');
        assert.ok(claimed.status === 'claimed');
        return {
            accountId,
            attemptId: claimed.claim.attemptId,
            email,
            notificationId,
            userId,
        };
    };

    const addressRace = await createClaim({ label: 'address' });
    const currentEmail = `delivery-start-current-${randomUUID()}@example.com`;
    await storage()
        .update(users)
        .set({ userName: currentEmail })
        .where(eq(users.id, addressRace.userId));
    assert.deepEqual(
        await startDeliveryLifecycleEmailAttempt({
            ...addressRace,
            now: new Date(baseTime.getTime() + 30_000),
        }),
        { email: currentEmail, status: 'started' },
    );

    const preferenceRace = await createClaim({ label: 'preference' });
    await storage().insert(notificationUserChannelPreferences).values({
        category: 'delivery_updates',
        channel: 'email',
        enabled: false,
        userId: preferenceRace.userId,
    });
    assert.deepEqual(
        await startDeliveryLifecycleEmailAttempt({
            ...preferenceRace,
            now: new Date(baseTime.getTime() + 30_000),
        }),
        { reason: 'preference_disabled', status: 'skipped' },
    );

    const quietRace = await createClaim({ label: 'quiet' });
    await storage()
        .insert(notificationUserChannelPreferences)
        .values({
            category: 'delivery_updates',
            channel: 'email',
            enabled: true,
            quietHoursEndMinute: 13 * 60,
            quietHoursStartMinute: 12 * 60,
            timezone: 'UTC',
            userId: quietRace.userId,
        });
    assert.deepEqual(
        await startDeliveryLifecycleEmailAttempt({
            ...quietRace,
            now: new Date('2026-07-20T12:00:00.000Z'),
        }),
        { reason: 'quiet_hours', status: 'deferred' },
    );
    const quietAttempt =
        await storage().query.notificationDeliveryAttempts.findFirst({
            where: eq(notificationDeliveryAttempts.id, quietRace.attemptId),
        });
    assert.ok(quietAttempt);
    assert.equal(quietAttempt.providerResponseCode, 'quiet_hours');
    assert.equal(
        quietAttempt.attemptedAt.toISOString(),
        '2026-07-20T13:00:00.000Z',
    );
    const quietEvents =
        await storage().query.notificationDeliveryEvents.findMany({
            where: eq(
                notificationDeliveryEvents.deliveryAttemptId,
                quietRace.attemptId,
            ),
        });
    assert.equal(
        quietEvents.some(
            (event) =>
                event.type === 'queued' &&
                event.metadata?.reason === 'quiet_hours' &&
                event.occurredAt.toISOString() === '2026-07-20T12:00:00.000Z',
        ),
        true,
    );

    const membershipRace = await createClaim({ label: 'membership' });
    await storage()
        .delete(accountUsers)
        .where(
            and(
                eq(accountUsers.accountId, membershipRace.accountId),
                eq(accountUsers.userId, membershipRace.userId),
            ),
        );
    assert.deepEqual(
        await startDeliveryLifecycleEmailAttempt({
            ...membershipRace,
            now: new Date(baseTime.getTime() + 30_000),
        }),
        { reason: 'not_recipient', status: 'unavailable' },
    );

    const roleRace = await createClaim({ label: 'role' });
    await storage()
        .update(users)
        .set({ role: 'driver' })
        .where(eq(users.id, roleRace.userId));
    assert.deepEqual(
        await startDeliveryLifecycleEmailAttempt({
            ...roleRace,
            now: new Date(baseTime.getTime() + 30_000),
        }),
        { reason: 'not_recipient', status: 'unavailable' },
    );

    const expiryRace = await createClaim({
        claimAt: new Date(baseTime.getTime() + 10_000),
        label: 'expiry',
        ttlSeconds: 60,
    });
    assert.deepEqual(
        await startDeliveryLifecycleEmailAttempt({
            ...expiryRace,
            now: new Date(baseTime.getTime() + 60_001),
        }),
        { reason: 'notification_expired', status: 'unavailable' },
    );

    const terminalAttempts = await storage()
        .select({
            id: notificationDeliveryAttempts.id,
            providerResponseCode:
                notificationDeliveryAttempts.providerResponseCode,
            status: notificationDeliveryAttempts.status,
        })
        .from(notificationDeliveryAttempts)
        .where(
            inArray(notificationDeliveryAttempts.id, [
                preferenceRace.attemptId,
                membershipRace.attemptId,
                roleRace.attemptId,
                expiryRace.attemptId,
            ]),
        );
    assert.deepEqual(
        terminalAttempts
            .map(({ providerResponseCode, status }) => ({
                providerResponseCode,
                status,
            }))
            .sort((left, right) =>
                left.providerResponseCode.localeCompare(
                    right.providerResponseCode,
                ),
            ),
        [
            'not_recipient',
            'not_recipient',
            'notification_expired',
            'preference_disabled',
        ]
            .sort((left, right) => left.localeCompare(right))
            .map((providerResponseCode) => ({
                providerResponseCode,
                status: 'dropped',
            })),
    );
    const terminalEvents =
        await storage().query.notificationDeliveryEvents.findMany({
            where: inArray(
                notificationDeliveryEvents.deliveryAttemptId,
                terminalAttempts.map(({ id }) => id),
            ),
        });
    for (const attempt of terminalAttempts) {
        assert.equal(
            terminalEvents.some(
                (event) =>
                    event.deliveryAttemptId === attempt.id &&
                    event.type === 'failed' &&
                    event.metadata?.reason === attempt.providerResponseCode &&
                    event.metadata?.retryable === false,
            ),
            true,
        );
    }
});

test('direct lifecycle email targets are terminalized after role or membership loss', async () => {
    createTestDb();
    await ensureFarmId();
    const roleUserId = await createUserWithPassword(
        `delivery-email-role-loss-${randomUUID()}@example.com`,
        'password',
    );
    const membershipUserId = await createUserWithPassword(
        `delivery-email-membership-loss-${randomUUID()}@example.com`,
        'password',
    );
    const roleAccountId = (await getUser(roleUserId))?.accounts[0]?.accountId;
    const membershipAccountId = (await getUser(membershipUserId))?.accounts[0]
        ?.accountId;
    assert.ok(roleAccountId);
    assert.ok(membershipAccountId);
    const now = new Date('2026-07-20T12:00:00.000Z');
    const createTargeted = async (accountId: string, userId: string) =>
        await createNotification(
            {
                accountId,
                category: 'delivery_updates',
                content: 'Target eligibility test.',
                header: 'Target eligibility test',
                metadata: {
                    eventVersion: 1,
                    milestone: 'route-started',
                    requestId: `request:${randomUUID()}`,
                    retryAttempt: 0,
                    runId: `run:${randomUUID()}`,
                    stopId: `stop:${randomUUID()}`,
                },
                timestamp: now,
                ttlSeconds: 24 * 60 * 60,
                type: 'delivery_lifecycle',
                userId,
            },
            { routeDelivery: false },
        );
    const roleNotificationId = await createTargeted(roleAccountId, roleUserId);
    const membershipNotificationId = await createTargeted(
        membershipAccountId,
        membershipUserId,
    );
    await storage()
        .update(users)
        .set({ role: 'driver' })
        .where(eq(users.id, roleUserId));
    await storage()
        .delete(accountUsers)
        .where(
            and(
                eq(accountUsers.accountId, membershipAccountId),
                eq(accountUsers.userId, membershipUserId),
            ),
        );

    const candidates = await getDeliveryLifecycleEmailCandidates({ now });
    assert.equal(
        candidates.some(
            (candidate) => candidate.notificationId === roleNotificationId,
        ),
        true,
    );
    assert.equal(
        candidates.some(
            (candidate) =>
                candidate.notificationId === membershipNotificationId,
        ),
        true,
    );
    for (const candidate of [
        { notificationId: roleNotificationId, userId: roleUserId },
        {
            notificationId: membershipNotificationId,
            userId: membershipUserId,
        },
    ]) {
        assert.deepEqual(
            await claimDeliveryLifecycleEmailCandidate({
                ...candidate,
                now,
            }),
            { reason: 'not_recipient', status: 'unavailable' },
        );
    }

    await storage()
        .update(users)
        .set({ role: 'user' })
        .where(eq(users.id, roleUserId));
    await storage()
        .insert(accountUsers)
        .values({ accountId: membershipAccountId, userId: membershipUserId });
    const afterRestore = await getDeliveryLifecycleEmailCandidates({
        now: new Date(now.getTime() + 60_000),
    });
    assert.equal(
        afterRestore.some((candidate) =>
            [roleNotificationId, membershipNotificationId].includes(
                candidate.notificationId,
            ),
        ),
        false,
    );
    const terminalAttempts = await storage()
        .select({
            notificationId: notificationDeliveryAttempts.notificationId,
            providerResponseCode:
                notificationDeliveryAttempts.providerResponseCode,
            status: notificationDeliveryAttempts.status,
        })
        .from(notificationDeliveryAttempts)
        .where(
            eq(
                notificationDeliveryAttempts.provider,
                'delivery_lifecycle_email',
            ),
        );
    assert.deepEqual(
        terminalAttempts
            .filter((attempt) =>
                [roleNotificationId, membershipNotificationId].includes(
                    attempt.notificationId,
                ),
            )
            .map((attempt) => ({
                notificationId: attempt.notificationId,
                providerResponseCode: attempt.providerResponseCode,
                status: attempt.status,
            }))
            .sort((left, right) =>
                left.notificationId.localeCompare(right.notificationId),
            ),
        [roleNotificationId, membershipNotificationId]
            .sort((left, right) => left.localeCompare(right))
            .map((notificationId) => ({
                notificationId,
                providerResponseCode: 'not_recipient',
                status: 'dropped',
            })),
    );
});

test('terminal provider rejection drops an email attempt after sending starts', async () => {
    createTestDb();
    await ensureFarmId();
    const email = `delivery-email-rejected-${randomUUID()}@example.com`;
    const userId = await createUserWithPassword(email, 'password');
    const user = await getUser(userId);
    assert.ok(user);
    const accountId = user.accounts[0]?.accountId;
    assert.ok(accountId);
    await storage().insert(notificationUserChannelPreferences).values({
        category: 'delivery_updates',
        channel: 'email',
        enabled: true,
        userId,
    });
    const notificationId = await createNotification(
        {
            accountId,
            category: 'delivery_updates',
            content: 'Terminal provider rejection.',
            header: 'Terminal provider rejection',
            metadata: {
                eventVersion: 1,
                milestone: 'route-started',
                requestId: `request:${randomUUID()}`,
                retryAttempt: 0,
                runId: `run:${randomUUID()}`,
                stopId: `stop:${randomUUID()}`,
            },
            timestamp: new Date('2026-07-19T12:00:00.000Z'),
            type: 'delivery_lifecycle',
            userId,
        },
        { routeDelivery: false },
    );
    const claimed = await claimDeliveryLifecycleEmailCandidate({
        notificationId,
        now: new Date('2026-07-19T12:01:00.000Z'),
        userId,
    });
    assert.equal(claimed.status, 'claimed');
    assert.ok(claimed.status === 'claimed');
    assert.deepEqual(
        await startDeliveryLifecycleEmailAttempt({
            attemptId: claimed.claim.attemptId,
            notificationId,
            now: new Date('2026-07-19T12:01:01.000Z'),
            userId,
        }),
        { email, status: 'started' },
    );
    assert.equal(
        await dropDeliveryLifecycleEmailAttempt({
            attemptId: claimed.claim.attemptId,
            notificationId,
            now: new Date('2026-07-19T12:01:02.000Z'),
            reason: 'provider_rejected',
            userId,
        }),
        true,
    );

    const attempt =
        await storage().query.notificationDeliveryAttempts.findFirst({
            where: eq(notificationDeliveryAttempts.id, claimed.claim.attemptId),
        });
    assert.ok(attempt);
    assert.equal(attempt.status, 'dropped');
    assert.equal(attempt.providerResponseCode, 'provider_rejected');
    const event = await storage().query.notificationDeliveryEvents.findFirst({
        where: eq(
            notificationDeliveryEvents.deliveryAttemptId,
            claimed.claim.attemptId,
        ),
        orderBy: (events, { desc }) => [desc(events.id)],
    });
    assert.ok(event);
    assert.equal(event.type, 'failed');
    assert.equal(event.metadata?.retryable, false);
});
