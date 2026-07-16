import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildWebPushPayload,
    createAndSendTestWebPushNotification,
    processWebPushAttempts,
    type QueuedWebPushAttempt,
    WebPushDeliveryError,
    type WebPushFailure,
    webPushTimeToLiveSeconds,
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
        timestamp: new Date('2026-07-20T12:00:00.000Z'),
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

test('web push provider TTL never extends a notification expiry', () => {
    const now = new Date('2026-07-21T11:59:00.000Z');
    assert.equal(
        webPushTimeToLiveSeconds(
            queuedAttempt({ ttlSeconds: 24 * 60 * 60 }),
            now,
        ),
        60,
    );
    assert.equal(
        webPushTimeToLiveSeconds(
            queuedAttempt({ ttlSeconds: 24 * 60 * 60 }),
            new Date('2026-07-21T12:00:00.000Z'),
        ),
        0,
    );
    assert.equal(
        webPushTimeToLiveSeconds(
            queuedAttempt({
                timestamp: new Date('2026-07-21T11:57:59.500Z'),
                ttlSeconds: 62,
            }),
            now,
        ),
        1,
    );
    assert.equal(webPushTimeToLiveSeconds(queuedAttempt(), now), 24 * 60 * 60);
});

test('buildWebPushPayload strips unsupported Markdown from browser-visible text', () => {
    const payload = buildWebPushPayload(
        queuedAttempt({
            actionLabel: '**Otvori obavijest**',
            actionUrl: '/vrtovi/1',
            content:
                'U gredici **Zabavna Pahuljica** na poziciji **18** proklijala je biljka **Grah Borlotto lingua di fuoco nano**.',
            header: '🌱 **Proklijala** je biljka Grah Borlotto!',
        }),
    );

    assert.deepEqual(JSON.parse(payload), {
        actions: [
            {
                action: 'open',
                title: 'Otvori obavijest',
                url: '/vrtovi/1',
            },
        ],
        body: 'U gredici Zabavna Pahuljica na poziciji 18 proklijala je biljka Grah Borlotto lingua di fuoco nano.',
        category: 'general',
        deliveryAttemptId: 1,
        icon: '/icon.png',
        notificationId: 'notification-1',
        requireInteraction: false,
        tag: 'notification-1',
        title: '🌱 Proklijala je biljka Grah Borlotto!',
        url: '/',
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

test('processWebPushAttempts does not reinterpret accepted finalization errors as provider failures', async () => {
    let failedCalls = 0;
    await assert.rejects(
        processWebPushAttempts({
            attempts: [queuedAttempt()],
            recorders: {
                accepted: async () => {
                    throw new Error('delivery state unavailable');
                },
                failed: async () => {
                    failedCalls += 1;
                },
            },
            send: async () => ({ body: '', headers: {}, statusCode: 201 }),
        }),
        /delivery state unavailable/,
    );
    assert.equal(failedCalls, 0);
});

test('processWebPushAttempts revalidates each queued attempt immediately before provider send', async () => {
    const events: string[] = [];
    const attempts = [
        queuedAttempt({ attemptId: 1 }),
        queuedAttempt({ attemptId: 2 }),
        queuedAttempt({ attemptId: 3 }),
    ];
    const result = await processWebPushAttempts({
        attempts,
        recorders: {
            accepted: async (attempt) => {
                events.push(`accepted-${attempt.attemptId}`);
            },
        },
        revalidate: async (attempt) => {
            events.push(`revalidate-${attempt.attemptId}`);
            if (attempt.attemptId === 1) {
                return { reason: 'eligible_immediate', status: 'eligible' };
            }
            if (attempt.attemptId === 2) {
                return { reason: 'quiet_hours', status: 'deferred' };
            }
            return { reason: 'preference_disabled', status: 'dropped' };
        },
        send: async (attempt) => {
            events.push(`send-${attempt.attemptId}`);
            return { body: '', headers: {}, statusCode: 201 };
        },
    });

    assert.deepEqual(events, [
        'revalidate-1',
        'send-1',
        'accepted-1',
        'revalidate-2',
        'revalidate-3',
    ]);
    assert.deepEqual(result, {
        accepted: 1,
        candidates: 3,
        configured: true,
        failed: 0,
        invalidated: 0,
        retried: 0,
        skipped: 2,
    });
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
        sendQueued: async ({ limit, notificationId } = {}) => {
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
