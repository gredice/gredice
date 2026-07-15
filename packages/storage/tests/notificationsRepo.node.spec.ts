import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    accountUsers,
    backfillNotificationRolloutDefaults,
    cancelNotificationCampaign,
    cleanupNotificationRetention,
    createNotification,
    createNotificationCampaign,
    createNotificationWithStatus,
    createUserWithPassword,
    deliverNotificationOperatorAlert,
    enqueueNotificationCampaign,
    enqueuePushDeliveryAttemptsForNotification,
    gardens,
    getNotificationCampaign,
    getNotificationDeliverySummary,
    getNotificationsByAccount,
    getUser,
    notificationCampaigns,
    notificationDeliveryAttempts,
    notificationRolloutDefaultDeviceLabel,
    notifications,
    notificationUserChannelPreferences,
    previewNotificationCampaignAudience,
    recordNotificationDeliveryEvent,
    routeNotificationDelivery,
    storage,
    users,
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

test('createNotificationWithStatus reports only the first idempotent insert as created', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const idempotencyKey = `checkout-fulfillment:${randomUUID()}`;
    const notification = {
        accountId,
        header: 'Checkout fulfillment incident',
        content: 'Operator action is required',
        timestamp: new Date('2026-07-15T08:00:00.000Z'),
    };

    const first = await createNotificationWithStatus(notification, {
        idempotencyKey,
        routeDelivery: false,
    });
    const retry = await createNotificationWithStatus(notification, {
        idempotencyKey,
        routeDelivery: false,
    });

    assert.equal(first.created, true);
    assert.equal(retry.created, false);
    assert.equal(retry.notificationId, first.notificationId);
    const matchingNotifications = await storage()
        .select({ id: notifications.id })
        .from(notifications)
        .where(eq(notifications.id, first.notificationId));
    assert.deepEqual(matchingNotifications, [{ id: first.notificationId }]);
});

test('operator alert delivery retries a failure and skips after success', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const notificationId = await createNotification(
        {
            accountId,
            header: 'Checkout fulfillment incident',
            content: 'Operator action is required',
            timestamp: new Date('2026-07-15T08:00:00.000Z'),
        },
        {
            idempotencyKey: `checkout-fulfillment:${randomUUID()}`,
            routeDelivery: false,
        },
    );
    let deliveryCalls = 0;

    const failed = await deliverNotificationOperatorAlert(
        notificationId,
        async () => {
            deliveryCalls += 1;
            throw new Error('transient Slack failure');
        },
    );
    assert.equal(failed.status, 'failed');

    const retried = await deliverNotificationOperatorAlert(
        notificationId,
        async () => {
            deliveryCalls += 1;
        },
    );
    assert.equal(retried.status, 'sent');

    const repeated = await deliverNotificationOperatorAlert(
        notificationId,
        async () => {
            deliveryCalls += 1;
            throw new Error('successful delivery must not run again');
        },
    );
    assert.deepEqual(repeated, {
        attempted: false,
        status: 'already_sent',
    });
    assert.equal(deliveryCalls, 2);

    const [notification] = await storage()
        .select({ metadata: notifications.metadata })
        .from(notifications)
        .where(eq(notifications.id, notificationId));
    assert.ok(notification);
    const operatorAlertDelivery = notification.metadata.operatorAlertDelivery;
    assert.ok(
        operatorAlertDelivery && typeof operatorAlertDelivery === 'object',
    );
    assert.equal('attemptCount' in operatorAlertDelivery, true);
    assert.equal(operatorAlertDelivery.attemptCount, 2);
    assert.equal('lastAttemptAt' in operatorAlertDelivery, true);
    assert.equal(typeof operatorAlertDelivery.lastAttemptAt, 'string');
    assert.equal('sentAt' in operatorAlertDelivery, true);
    assert.equal(typeof operatorAlertDelivery.sentAt, 'string');
    assert.equal('status' in operatorAlertDelivery, true);
    assert.equal(operatorAlertDelivery.status, 'sent');
});

test('createNotification resumes an interrupted idempotent delivery without duplicates', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const idempotencyKey = `schedule-task:operation-completed:${randomUUID()}`;
    const notification = {
        accountId,
        header: 'Task completed',
        content: 'A completed task notification',
        timestamp: new Date('2026-07-15T08:00:00.000Z'),
    };

    // Model a request interrupted after the durable notification row was
    // written but before delivery routing completed.
    const interruptedNotificationId = await createNotification(notification, {
        idempotencyKey,
        routeDelivery: false,
    });
    const retryNotificationId = await createNotification(notification, {
        idempotencyKey,
    });
    const repeatedRetryNotificationId = await createNotification(notification, {
        idempotencyKey,
    });

    assert.equal(retryNotificationId, interruptedNotificationId);
    assert.equal(repeatedRetryNotificationId, interruptedNotificationId);

    const matchingNotifications = await storage()
        .select({ id: notifications.id })
        .from(notifications)
        .where(eq(notifications.id, interruptedNotificationId));
    assert.deepEqual(matchingNotifications, [
        { id: interruptedNotificationId },
    ]);

    const attempts = await storage()
        .select({
            channel: notificationDeliveryAttempts.channel,
            provider: notificationDeliveryAttempts.provider,
            userId: notificationDeliveryAttempts.userId,
        })
        .from(notificationDeliveryAttempts)
        .where(
            eq(
                notificationDeliveryAttempts.notificationId,
                interruptedNotificationId,
            ),
        );
    assert.equal(
        attempts.filter((attempt) => attempt.provider === 'router').length,
        3,
    );
    assert.equal(
        new Set(
            attempts.map(
                (attempt) =>
                    `${attempt.userId ?? 'account'}:${attempt.channel}:${attempt.provider}`,
            ),
        ).size,
        attempts.length,
    );
});

test('createNotification rejects an explicitly empty idempotency key', async () => {
    createTestDb();
    const accountId = await createTestAccount();

    await assert.rejects(
        createNotification(
            {
                accountId,
                header: 'Invalid idempotency key',
                content: 'This notification must not be created',
                timestamp: new Date(),
            },
            { idempotencyKey: '   ' },
        ),
        /idempotency key cannot be empty/i,
    );
});

test('createNotification serializes concurrent idempotent routing and push queueing', async () => {
    createTestDb();
    await ensureFarmId();
    const userId = await createUserWithPassword(
        `push-idempotency-${randomUUID()}@example.com`,
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
            endpoint: `https://example.com/idempotency-${subscriptionId}`,
            p256dh: 'k',
            auth: 'a',
            enabled: true,
            permissionState: 'granted',
        });

    const idempotencyKey = `schedule-task:planting-completed:${randomUUID()}`;
    const notification = {
        accountId,
        userId,
        header: 'Concurrent task completion',
        content: 'One notification and one queued push are expected',
        timestamp: new Date('2026-07-15T09:00:00.000Z'),
    };
    const notificationIds = await Promise.all(
        Array.from({ length: 8 }, () =>
            createNotification(notification, { idempotencyKey }),
        ),
    );
    assert.equal(new Set(notificationIds).size, 1);
    const [notificationId] = notificationIds;
    assert.ok(notificationId);

    const matchingNotifications = await storage()
        .select({ id: notifications.id })
        .from(notifications)
        .where(eq(notifications.id, notificationId));
    assert.deepEqual(matchingNotifications, [{ id: notificationId }]);

    const attempts = await storage()
        .select({
            channel: notificationDeliveryAttempts.channel,
            provider: notificationDeliveryAttempts.provider,
            pushSubscriptionId: notificationDeliveryAttempts.pushSubscriptionId,
            userId: notificationDeliveryAttempts.userId,
        })
        .from(notificationDeliveryAttempts)
        .where(eq(notificationDeliveryAttempts.notificationId, notificationId));
    const routerAttempts = attempts.filter(
        (attempt) => attempt.provider === 'router',
    );
    assert.deepEqual(
        routerAttempts
            .map((attempt) => `${attempt.userId}:${attempt.channel}`)
            .sort(),
        [`${userId}:email`, `${userId}:in_app`, `${userId}:push`],
    );
    assert.deepEqual(
        attempts
            .filter((attempt) => attempt.provider === 'web_push_queue')
            .map((attempt) => ({
                channel: attempt.channel,
                pushSubscriptionId: attempt.pushSubscriptionId,
                userId: attempt.userId,
            })),
        [
            {
                channel: 'push',
                pushSubscriptionId: subscriptionId,
                userId,
            },
        ],
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
    const rolloutUserDates = [
        '1900-01-01T00:00:00.000Z',
        '1900-01-02T00:00:00.000Z',
    ];

    for (const [index, suffix] of ['first', 'second'].entries()) {
        const userId = await createUserWithPassword(
            `rollout-limit-${suffix}-${randomUUID()}@example.com`,
            'password',
        );
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
