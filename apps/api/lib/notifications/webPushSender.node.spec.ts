import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildWebPushPayload,
    createAndSendTestWebPushNotification,
    processWebPushAttempts,
    type QueuedWebPushAttempt,
    WebPushDeliveryError,
    type WebPushFailure,
} from './webPushSender';

function queuedAttempt(
    overrides: Partial<QueuedWebPushAttempt> = {},
): QueuedWebPushAttempt {
    return {
        accountId: 'account-1',
        actionLabel: null,
        actionUrl: null,
        attemptId: 1,
        auth: 'auth-secret',
        category: 'general',
        collapseKey: null,
        content: 'Body',
        endpoint: 'https://push.example.com/send/1',
        header: 'Title',
        iconUrl: null,
        imageUrl: null,
        linkUrl: null,
        notificationId: 'notification-1',
        p256dh: 'p256dh-key',
        priority: 'normal',
        pushSubscriptionId: 'subscription-1',
        safeImageUrl: null,
        safeLinkUrl: null,
        subscriptionFailCount: 0,
        threadKey: null,
        ttlSeconds: null,
        urgency: null,
        userId: 'user-1',
        ...overrides,
    };
}

test('buildWebPushPayload serializes notification content without subscription secrets', () => {
    const payload = buildWebPushPayload(
        queuedAttempt({
            actionLabel: 'Otvori',
            actionUrl: '/vrtovi/1',
            safeLinkUrl: '/obavijesti',
        }),
    );

    assert.equal(payload.includes('auth-secret'), false);
    assert.equal(payload.includes('p256dh-key'), false);
    assert.deepEqual(JSON.parse(payload), {
        actions: [
            {
                action: 'open',
                title: 'Otvori',
                url: '/vrtovi/1',
            },
        ],
        body: 'Body',
        category: 'general',
        deliveryAttemptId: 1,
        icon: '/icon.png',
        notificationId: 'notification-1',
        requireInteraction: false,
        tag: 'notification-1',
        title: 'Title',
        url: '/obavijesti',
    });
});

test('processWebPushAttempts records accepted provider success', async () => {
    const accepted: QueuedWebPushAttempt[] = [];
    const failed: WebPushFailure[] = [];
    const result = await processWebPushAttempts({
        attempts: [queuedAttempt()],
        recorders: {
            accepted: async (attempt) => {
                accepted.push(attempt);
            },
            failed: async (_attempt, failure) => {
                failed.push(failure);
            },
        },
        send: async () => ({ body: '', headers: {}, statusCode: 201 }),
    });

    assert.equal(result.accepted, 1);
    assert.equal(result.failed, 0);
    assert.equal(result.retried, 0);
    assert.equal(accepted.length, 1);
    assert.equal(failed.length, 0);
});

test('processWebPushAttempts keeps retryable provider failures queued below retry limit', async () => {
    const failures: WebPushFailure[] = [];
    const result = await processWebPushAttempts({
        attempts: [queuedAttempt({ subscriptionFailCount: 0 })],
        maxRetryFailures: 3,
        recorders: {
            failed: async (_attempt, failure) => {
                failures.push(failure);
            },
        },
        send: async () => {
            throw new WebPushDeliveryError(
                'temporary outage',
                503,
                'try later',
            );
        },
    });

    assert.equal(result.accepted, 0);
    assert.equal(result.failed, 0);
    assert.equal(result.retried, 1);
    assert.equal(failures[0]?.providerResponseCode, 'retryable_503');
    assert.equal(failures[0]?.willRetry, true);
});

test('processWebPushAttempts marks retryable provider failures failed at retry limit', async () => {
    const failures: WebPushFailure[] = [];
    const result = await processWebPushAttempts({
        attempts: [queuedAttempt({ subscriptionFailCount: 2 })],
        maxRetryFailures: 3,
        recorders: {
            failed: async (_attempt, failure) => {
                failures.push(failure);
            },
        },
        send: async () => {
            throw new WebPushDeliveryError(
                'still unavailable',
                503,
                'try later',
            );
        },
    });

    assert.equal(result.failed, 1);
    assert.equal(result.retried, 0);
    assert.equal(failures[0]?.providerResponseCode, 'failed_503');
    assert.equal(failures[0]?.willRetry, false);
});

test('processWebPushAttempts invalidates expired push subscriptions', async () => {
    const failures: WebPushFailure[] = [];
    const result = await processWebPushAttempts({
        attempts: [queuedAttempt()],
        recorders: {
            failed: async (_attempt, failure) => {
                failures.push(failure);
            },
        },
        send: async () => {
            throw new WebPushDeliveryError('gone', 410, 'expired endpoint');
        },
    });

    assert.equal(result.failed, 1);
    assert.equal(result.invalidated, 1);
    assert.equal(result.retried, 0);
    assert.equal(failures[0]?.invalidSubscription, true);
    assert.equal(failures[0]?.providerResponseCode, 'invalid_410');
});

test('createAndSendTestWebPushNotification creates a test notification and reports targeted devices', async () => {
    const result = await createAndSendTestWebPushNotification({
        accountId: 'account-1',
        createNotificationForTest: async (notification) => {
            assert.equal(notification.accountId, 'account-1');
            assert.equal(notification.userId, 'user-1');
            assert.equal(notification.category, 'test');
            assert.equal(notification.primaryChannel, 'push');
            return 'notification-1';
        },
        sendQueued: async ({ limit, notificationId }) => {
            assert.equal(limit, 10);
            assert.equal(notificationId, 'notification-1');
            return {
                accepted: 1,
                candidates: 2,
                configured: true,
                failed: 1,
                invalidated: 0,
                retried: 0,
                skipped: 0,
            };
        },
        userId: 'user-1',
    });

    assert.equal(result.notificationId, 'notification-1');
    assert.equal(result.targeted, 2);
    assert.equal(result.accepted, 1);
    assert.equal(result.failed, 1);
});
