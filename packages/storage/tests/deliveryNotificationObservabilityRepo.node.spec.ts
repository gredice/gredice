import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    classifyDeliveryLifecycleNotificationOutcome,
    events,
    getDeliveryLifecycleNotificationDiagnostics,
    getDeliveryLifecycleNotificationHealth,
    notificationDeliveryAttempts,
    notificationDeliveryEvents,
    notifications,
    storage,
} from '@gredice/storage';
import { sql } from 'drizzle-orm';
import { createTestAccount } from './helpers/testHelpers';
import { createTestDb } from './testDb';

type FixtureMilestone =
    | 'route-started'
    | 'near-arrival'
    | 'next-stop'
    | 'delayed'
    | 'arrived'
    | 'delivered'
    | 'exception'
    | 'recovery';

async function createLifecycleNotification({
    accountId,
    metadata = {},
    milestone = 'arrived',
    occurredAt,
    requestId = `request-${randomUUID()}`,
    sourceId = `source:${randomUUID()}`,
}: {
    accountId: string;
    metadata?: Record<string, unknown>;
    milestone?: FixtureMilestone;
    occurredAt: Date;
    requestId?: string;
    sourceId?: string;
}) {
    const notificationId = `notification:${randomUUID()}`;
    await storage()
        .insert(notifications)
        .values({
            accountId,
            category: 'delivery_updates',
            content: `private-message-body-${randomUUID()}`,
            header: `private-message-title-${randomUUID()}`,
            id: notificationId,
            metadata: {
                milestone,
                requestId,
                source: { id: sourceId },
                ...metadata,
            },
            timestamp: occurredAt,
            type: 'delivery_lifecycle',
        });
    return { milestone, notificationId, requestId, sourceId };
}

async function createAttempt({
    accountId,
    attemptedAt,
    channel = 'email',
    notificationId,
    provider = 'delivery_lifecycle_email',
    providerResponseBody,
    providerResponseCode = 'sent',
    status = 'sent',
}: {
    accountId: string;
    attemptedAt: Date;
    channel?: 'in_app' | 'email' | 'push' | 'sms';
    notificationId: string;
    provider?: string | null;
    providerResponseBody?: string;
    providerResponseCode?: string | null;
    status?: 'queued' | 'accepted' | 'sent' | 'failed' | 'dropped';
}) {
    const [attempt] = await storage()
        .insert(notificationDeliveryAttempts)
        .values({
            accountId,
            attemptedAt,
            channel,
            notificationId,
            provider,
            providerResponseBody,
            providerResponseCode,
            status,
        })
        .returning({ id: notificationDeliveryAttempts.id });
    assert.ok(attempt);
    return attempt.id;
}

test('classifies every delivery receipt and distinguishes deferral, suppression, retries, and terminal failure', () => {
    for (const eventType of [
        'queued',
        'accepted',
        'sent',
        'failed',
        'opened',
        'clicked',
        'dismissed',
        'unsubscribed',
    ] as const) {
        assert.equal(
            classifyDeliveryLifecycleNotificationOutcome({
                attemptStatus: 'queued',
                eventType,
                provider: 'private-provider',
                providerResponseCode: 'private-code',
            }),
            eventType,
        );
    }
    assert.equal(
        classifyDeliveryLifecycleNotificationOutcome({
            attemptStatus: 'queued',
            providerResponseCode: 'quiet_hours',
        }),
        'deferred',
    );
    for (const input of [
        { provider: 'router' },
        { providerResponseCode: 'preference_disabled' },
        { providerResponseCode: 'missing_push_subscription' },
    ]) {
        assert.equal(
            classifyDeliveryLifecycleNotificationOutcome({
                attemptStatus: 'dropped',
                ...input,
            }),
            'suppressed',
        );
    }
    assert.equal(
        classifyDeliveryLifecycleNotificationOutcome({
            attemptStatus: 'failed',
            eventRetryable: true,
            eventType: 'failed',
        }),
        'retrying',
    );
    assert.equal(
        classifyDeliveryLifecycleNotificationOutcome({
            attemptStatus: 'failed',
            eventReasonCode: 'notification_expired',
            eventType: 'failed',
        }),
        'suppressed',
    );
    assert.equal(
        classifyDeliveryLifecycleNotificationOutcome({
            attemptStatus: 'failed',
        }),
        'failed',
    );
    assert.equal(
        classifyDeliveryLifecycleNotificationOutcome({
            attemptStatus: 'dropped',
            provider: 'private-provider',
            providerResponseCode: 'private-code',
        }),
        'failed',
    );
});

test('diagnostics classify immutable retry, deferral, and suppression events per attempt', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const now = new Date('2046-07-16T11:00:00.000Z');
    const fixture = await createLifecycleNotification({
        accountId,
        occurredAt: now,
    });
    const terminalPushAttemptId = await createAttempt({
        accountId,
        attemptedAt: new Date(now.getTime() - 5_000),
        channel: 'push',
        notificationId: fixture.notificationId,
        provider: 'web_push',
        providerResponseCode: 'provider_rejected',
        status: 'failed',
    });
    await createAttempt({
        accountId,
        attemptedAt: new Date(now.getTime() - 4_000),
        channel: 'push',
        notificationId: fixture.notificationId,
        provider: 'web_push',
        providerResponseCode: 'queued_background',
        status: 'queued',
    });
    const retryingPushAttemptId = await createAttempt({
        accountId,
        attemptedAt: new Date(now.getTime() - 3_000),
        channel: 'push',
        notificationId: fixture.notificationId,
        provider: 'web_push',
        providerResponseCode: 'retryable_503',
        status: 'queued',
    });
    const deferredEmailAttemptId = await createAttempt({
        accountId,
        attemptedAt: new Date(now.getTime() - 2_000),
        notificationId: fixture.notificationId,
        providerResponseCode: 'notification_expired',
        status: 'dropped',
    });
    await storage()
        .insert(notificationDeliveryEvents)
        .values([
            {
                deliveryAttemptId: terminalPushAttemptId,
                metadata: { provider: 'web_push', willRetry: false },
                notificationId: fixture.notificationId,
                occurredAt: new Date(now.getTime() - 5_000),
                type: 'failed',
            },
            {
                deliveryAttemptId: retryingPushAttemptId,
                metadata: { provider: 'web_push', willRetry: true },
                notificationId: fixture.notificationId,
                occurredAt: new Date(now.getTime() - 3_000),
                type: 'failed',
            },
            {
                deliveryAttemptId: deferredEmailAttemptId,
                metadata: {
                    provider: 'delivery_lifecycle_email',
                    reason: 'quiet_hours',
                },
                notificationId: fixture.notificationId,
                occurredAt: new Date(now.getTime() - 2_000),
                type: 'queued',
            },
            {
                deliveryAttemptId: deferredEmailAttemptId,
                metadata: {
                    provider: 'delivery_lifecycle_email',
                    reason: 'notification_expired',
                    retryable: false,
                },
                notificationId: fixture.notificationId,
                occurredAt: new Date(now.getTime() - 1_000),
                type: 'failed',
            },
        ]);

    const diagnostics = await getDeliveryLifecycleNotificationDiagnostics({
        from: new Date(now.getTime() - 10_000),
        requestId: fixture.requestId,
        to: now,
    });
    assert.equal(
        diagnostics.items.some(
            ({ attemptId, outcome }) =>
                attemptId === terminalPushAttemptId && outcome === 'failed',
        ),
        true,
    );
    assert.equal(
        diagnostics.items.some(
            ({ attemptId, outcome }) =>
                attemptId === retryingPushAttemptId && outcome === 'retrying',
        ),
        true,
    );
    assert.equal(
        diagnostics.items.some(
            ({ attemptId, outcome, reasonCode }) =>
                attemptId === deferredEmailAttemptId &&
                outcome === 'deferred' &&
                reasonCode === 'quiet_hours',
        ),
        true,
    );
    assert.equal(
        diagnostics.items.some(
            ({ attemptId, outcome, reasonCode }) =>
                attemptId === deferredEmailAttemptId &&
                outcome === 'suppressed' &&
                reasonCode === 'notification_expired',
        ),
        true,
    );
});

test('diagnostics apply exact lifecycle filters and return only the privacy-safe projection', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const now = new Date('2046-07-16T12:00:00.000Z');
    const privateValues = {
        address: `private-address-${randomUUID()}`,
        contact: `private-contact-${randomUUID()}`,
        latitude: `private-latitude-${randomUUID()}`,
        longitude: `private-longitude-${randomUUID()}`,
        message: `private-message-${randomUUID()}`,
        provider: `private-provider-${randomUUID()}`,
        providerBody: `private-provider-body-${randomUUID()}`,
        providerCode: `private-provider-code-${randomUUID()}`,
        qr: `private-qr-${randomUUID()}`,
    };
    const target = await createLifecycleNotification({
        accountId,
        metadata: {
            address: privateValues.address,
            contact: privateValues.contact,
            latitude: privateValues.latitude,
            longitude: privateValues.longitude,
            message: privateValues.message,
            qr: privateValues.qr,
        },
        milestone: 'arrived',
        occurredAt: now,
        requestId: `request-${randomUUID()}`,
        sourceId: `delivery-event:${randomUUID()}`,
    });
    const failedAttemptId = await createAttempt({
        accountId,
        attemptedAt: now,
        channel: 'push',
        notificationId: target.notificationId,
        provider: privateValues.provider,
        providerResponseBody: privateValues.providerBody,
        providerResponseCode: privateValues.providerCode,
        status: 'failed',
    });
    const openedAttemptId = await createAttempt({
        accountId,
        attemptedAt: new Date(now.getTime() - 1),
        channel: 'email',
        notificationId: target.notificationId,
        provider: 'delivery_lifecycle_email',
        providerResponseCode: 'sent',
        status: 'sent',
    });
    await storage()
        .insert(notificationDeliveryEvents)
        .values({
            deliveryAttemptId: openedAttemptId,
            metadata: {
                address: privateValues.address,
                latitude: privateValues.latitude,
                reason: 'attempts_exhausted',
            },
            notificationId: target.notificationId,
            occurredAt: new Date(now.getTime() + 1),
            type: 'opened',
        });
    await createLifecycleNotification({
        accountId,
        milestone: 'delivered',
        occurredAt: now,
    });
    const failed = await getDeliveryLifecycleNotificationDiagnostics({
        channel: 'push',
        from: new Date(now.getTime() - 1_000),
        milestone: target.milestone,
        now,
        outcome: 'failed',
        requestId: target.requestId,
        sourceId: target.sourceId,
        to: new Date(now.getTime() + 1_000),
    });
    assert.equal(failed.items.length, 1);
    assert.deepEqual(failed.items[0], {
        attemptId: failedAttemptId,
        channel: 'push',
        kind: 'attempt',
        milestone: 'arrived',
        notificationId: target.notificationId,
        occurredAt: now,
        outcome: 'failed',
        provider: 'unknown',
        reasonCode: 'unknown',
        recordId: `0:${String(failedAttemptId).padStart(20, '0')}`,
        requestId: target.requestId,
        sourceId: target.sourceId,
    });

    const decisionSourceIds = [
        `route-progress:${randomUUID()}`,
        `arrival:${randomUUID()}`,
    ];
    await storage()
        .insert(events)
        .values([
            {
                aggregateId: target.requestId,
                createdAt: new Date(now.getTime() + 2),
                data: {
                    address: privateValues.address,
                    decision: 'suppressed',
                    milestone: target.milestone,
                    reason: 'eta_threshold_already_emitted',
                    sourceId: decisionSourceIds[0],
                },
                type: 'delivery.request.lifecycle_notification.decision',
                version: 1,
            },
            {
                aggregateId: target.requestId,
                createdAt: new Date(now.getTime() + 3),
                data: {
                    decision: 'suppressed',
                    latitude: privateValues.latitude,
                    milestone: target.milestone,
                    reason: 'idempotency_reused',
                    sourceId: decisionSourceIds[1],
                },
                type: 'delivery.request.lifecycle_notification.decision',
                version: 1,
            },
        ]);
    const decisions = await getDeliveryLifecycleNotificationDiagnostics({
        from: new Date(now.getTime() - 1_000),
        now,
        outcome: 'suppressed',
        requestId: target.requestId,
        to: new Date(now.getTime() + 1_000),
    });
    assert.deepEqual(
        decisions.items.map(
            ({
                attemptId,
                channel,
                kind,
                notificationId,
                outcome,
                reasonCode,
                requestId,
                sourceId,
            }) => ({
                attemptId,
                channel,
                kind,
                notificationId,
                outcome,
                reasonCode,
                requestId,
                sourceId,
            }),
        ),
        [
            {
                attemptId: null,
                channel: null,
                kind: 'decision',
                notificationId: null,
                outcome: 'suppressed',
                reasonCode: 'idempotency_reused',
                requestId: target.requestId,
                sourceId: decisionSourceIds[1],
            },
            {
                attemptId: null,
                channel: null,
                kind: 'decision',
                notificationId: null,
                outcome: 'suppressed',
                reasonCode: 'eta_threshold_already_emitted',
                requestId: target.requestId,
                sourceId: decisionSourceIds[0],
            },
        ],
    );
    const exactDecision = await getDeliveryLifecycleNotificationDiagnostics({
        from: new Date(now.getTime() - 1_000),
        now,
        requestId: target.requestId,
        sourceId: decisionSourceIds[0],
        to: new Date(now.getTime() + 1_000),
    });
    assert.equal(exactDecision.items.length, 1);
    assert.equal(
        exactDecision.items[0]?.reasonCode,
        'eta_threshold_already_emitted',
    );
    const firstCombinedPage = await getDeliveryLifecycleNotificationDiagnostics(
        {
            from: new Date(now.getTime() - 1_000),
            limit: 1,
            now,
            requestId: target.requestId,
            to: new Date(now.getTime() + 1_000),
        },
    );
    assert.equal(firstCombinedPage.items[0]?.sourceId, decisionSourceIds[1]);
    assert.ok(firstCombinedPage.nextCursor);
    const secondCombinedPage =
        await getDeliveryLifecycleNotificationDiagnostics({
            cursor: firstCombinedPage.nextCursor,
            from: new Date(now.getTime() - 1_000),
            limit: 1,
            now,
            requestId: target.requestId,
            to: new Date(now.getTime() + 1_000),
        });
    assert.equal(secondCombinedPage.items[0]?.sourceId, decisionSourceIds[0]);
    const channelOnly = await getDeliveryLifecycleNotificationDiagnostics({
        channel: 'push',
        from: new Date(now.getTime() - 1_000),
        now,
        requestId: target.requestId,
        to: new Date(now.getTime() + 1_000),
    });
    assert.equal(
        channelOnly.items.every(({ kind }) => kind === 'attempt'),
        true,
    );

    const opened = await getDeliveryLifecycleNotificationDiagnostics({
        from: new Date(now.getTime() - 1_000),
        now,
        outcome: 'opened',
        requestId: target.requestId,
        to: new Date(now.getTime() + 1_000),
    });
    assert.equal(opened.items.length, 1);
    assert.equal(opened.items[0]?.provider, 'email');
    assert.equal(opened.items[0]?.reasonCode, 'attempts_exhausted');

    const legacy = await createLifecycleNotification({
        accountId,
        metadata: { source: null },
        milestone: 'near-arrival',
        occurredAt: now,
    });
    await createAttempt({
        accountId,
        attemptedAt: now,
        notificationId: legacy.notificationId,
    });
    const retained = await getDeliveryLifecycleNotificationDiagnostics({
        from: new Date(now.getTime() - 1_000),
        now,
        requestId: legacy.requestId,
        to: new Date(now.getTime() + 1_000),
    });
    assert.equal(retained.items.length, 1);
    assert.equal(retained.items[0]?.sourceId, null);

    const serialized = JSON.stringify([failed, opened, decisions]);
    for (const privateValue of Object.values(privateValues)) {
        assert.equal(serialized.includes(privateValue), false);
    }
    for (const forbiddenField of [
        'accountId',
        'userId',
        'providerResponseBody',
        'header',
        'content',
        'metadata',
        'address',
        'latitude',
        'longitude',
        'qr',
        'contact',
    ]) {
        assert.equal(serialized.includes(`"${forbiddenField}"`), false);
    }
});

test('diagnostics use stable cursors, a 24-hour default, a 200-row page cap, and a 180-day time cap', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const now = new Date('2047-07-16T12:00:00.000Z');
    const fixture = await createLifecycleNotification({
        accountId,
        occurredAt: now,
    });
    for (let index = 0; index < 201; index += 1) {
        await createAttempt({
            accountId,
            attemptedAt: new Date(now.getTime() - index),
            notificationId: fixture.notificationId,
        });
    }
    await createAttempt({
        accountId,
        attemptedAt: new Date(now.getTime() - 25 * 60 * 60 * 1000),
        notificationId: fixture.notificationId,
    });

    const first = await getDeliveryLifecycleNotificationDiagnostics({
        limit: 1,
        now,
        requestId: fixture.requestId,
    });
    assert.equal(first.items.length, 1);
    assert.ok(first.nextCursor);
    const second = await getDeliveryLifecycleNotificationDiagnostics({
        cursor: first.nextCursor,
        limit: 1,
        now,
        requestId: fixture.requestId,
    });
    assert.equal(second.items.length, 1);
    assert.notEqual(second.items[0]?.recordId, first.items[0]?.recordId);

    const maximumPage = await getDeliveryLifecycleNotificationDiagnostics({
        limit: 10_000,
        now,
        requestId: fixture.requestId,
    });
    assert.equal(maximumPage.items.length, 200);
    assert.ok(maximumPage.nextCursor);
    assert.equal(
        maximumPage.items.some(
            ({ occurredAt }) =>
                occurredAt.getTime() < now.getTime() - 24 * 60 * 60 * 1000,
        ),
        false,
    );

    await assert.rejects(
        getDeliveryLifecycleNotificationDiagnostics({
            from: new Date(now.getTime() - 181 * 24 * 60 * 60 * 1000),
            now,
            requestId: fixture.requestId,
        }),
        /must not exceed 180 days/,
    );
    await assert.rejects(
        getDeliveryLifecycleNotificationDiagnostics({
            cursor: 'not-a-cursor',
            now,
        }),
        /cursor is invalid/,
    );
    await assert.rejects(
        getDeliveryLifecycleNotificationDiagnostics({
            now,
            sourceId: '../private-source',
        }),
        /bounded opaque identifier/,
    );
});

test('diagnostic cursors preserve rows with distinct database timestamps inside one millisecond', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const now = new Date('2047-07-16T12:00:00.123Z');
    const attemptFixture = await createLifecycleNotification({
        accountId,
        occurredAt: now,
    });
    const olderAttemptId = await createAttempt({
        accountId,
        attemptedAt: now,
        notificationId: attemptFixture.notificationId,
    });
    const newerAttemptId = await createAttempt({
        accountId,
        attemptedAt: now,
        notificationId: attemptFixture.notificationId,
    });
    await storage().execute(
        sql`update notification_delivery_attempts
            set attempted_at = case
                when id = ${olderAttemptId} then '2047-07-16 12:00:00.123900'::timestamp
                else '2047-07-16 12:00:00.123400'::timestamp
            end
            where id in (${olderAttemptId}, ${newerAttemptId})`,
    );

    const firstAttemptPage = await getDeliveryLifecycleNotificationDiagnostics({
        from: new Date(now.getTime() - 1_000),
        limit: 1,
        requestId: attemptFixture.requestId,
        to: new Date(now.getTime() + 1_000),
    });
    assert.ok(firstAttemptPage.nextCursor);
    const secondAttemptPage = await getDeliveryLifecycleNotificationDiagnostics(
        {
            cursor: firstAttemptPage.nextCursor,
            from: new Date(now.getTime() - 1_000),
            limit: 1,
            requestId: attemptFixture.requestId,
            to: new Date(now.getTime() + 1_000),
        },
    );
    assert.equal(secondAttemptPage.items.length, 1);
    assert.notEqual(
        secondAttemptPage.items[0]?.attemptId,
        firstAttemptPage.items[0]?.attemptId,
    );

    const decisionRequestId = `request-${randomUUID()}`;
    const decisionSourceIds = [
        `arrival:${randomUUID()}`,
        `arrival:${randomUUID()}`,
    ];
    const decisionRows = await storage()
        .insert(events)
        .values(
            decisionSourceIds.map((sourceId) => ({
                aggregateId: decisionRequestId,
                data: {
                    decision: 'suppressed',
                    milestone: 'arrived',
                    reason: 'idempotency_reused',
                    sourceId,
                },
                type: 'delivery.request.lifecycle_notification.decision',
                version: 1,
            })),
        )
        .returning({ id: events.id });
    assert.equal(decisionRows.length, 2);
    await storage().execute(
        sql`update events
            set created_at = case
                when id = ${decisionRows[0]?.id} then '2047-07-16 12:00:00.123900'::timestamp
                else '2047-07-16 12:00:00.123400'::timestamp
            end
            where id in (${decisionRows[0]?.id}, ${decisionRows[1]?.id})`,
    );

    const firstDecisionPage = await getDeliveryLifecycleNotificationDiagnostics(
        {
            from: new Date(now.getTime() - 1_000),
            limit: 1,
            requestId: decisionRequestId,
            to: new Date(now.getTime() + 1_000),
        },
    );
    assert.ok(firstDecisionPage.nextCursor);
    const secondDecisionPage =
        await getDeliveryLifecycleNotificationDiagnostics({
            cursor: firstDecisionPage.nextCursor,
            from: new Date(now.getTime() - 1_000),
            limit: 1,
            requestId: decisionRequestId,
            to: new Date(now.getTime() + 1_000),
        });
    assert.equal(secondDecisionPage.items.length, 1);
    assert.notEqual(
        secondDecisionPage.items[0]?.sourceId,
        firstDecisionPage.items[0]?.sourceId,
    );
});

async function createTerminalHealthFixture({
    failures,
    now,
    requestId,
    successes,
}: {
    failures: number;
    now: Date;
    requestId: string;
    successes: number;
}) {
    const accountId = await createTestAccount();
    const fixture = await createLifecycleNotification({
        accountId,
        occurredAt: now,
        requestId,
    });
    await storage()
        .insert(notificationDeliveryAttempts)
        .values([
            ...Array.from({ length: failures }, (_, index) => ({
                accountId,
                attemptedAt: new Date(now.getTime() - index),
                channel: 'email' as const,
                notificationId: fixture.notificationId,
                provider: 'delivery_lifecycle_email',
                providerResponseCode: 'sender_failed',
                status: 'failed' as const,
            })),
            ...Array.from({ length: successes }, (_, index) => ({
                accountId,
                attemptedAt: new Date(now.getTime() - failures - index),
                channel: 'email' as const,
                notificationId: fixture.notificationId,
                provider: 'delivery_lifecycle_email',
                providerResponseCode: 'sent',
                status: 'sent' as const,
            })),
            ...Array.from({ length: 10 }, (_, index) => ({
                accountId,
                attemptedAt: new Date(
                    now.getTime() - failures - successes - index,
                ),
                channel: 'email' as const,
                notificationId: fixture.notificationId,
                provider: 'router',
                providerResponseCode: 'preference_disabled',
                status: 'failed' as const,
            })),
            {
                accountId,
                attemptedAt: now,
                channel: 'email' as const,
                notificationId: fixture.notificationId,
                provider: 'delivery_lifecycle_email',
                providerResponseCode: 'invalid_recipient',
                status: 'dropped' as const,
            },
            {
                accountId,
                attemptedAt: now,
                channel: 'email' as const,
                notificationId: fixture.notificationId,
                provider: 'delivery_lifecycle_email',
                providerResponseCode: 'quiet_hours',
                status: 'queued' as const,
            },
        ]);
}

test('health applies the exact systemic failure warning and critical thresholds', async () => {
    createTestDb();
    const now = new Date('2048-07-16T12:00:00.000Z');
    const fixtures = [
        {
            expected: 'healthy',
            failures: 5,
            requestId: `health-under-volume-${randomUUID()}`,
            successes: 4,
        },
        {
            expected: 'healthy',
            failures: 3,
            requestId: `health-under-rate-${randomUUID()}`,
            successes: 17,
        },
        {
            expected: 'warning',
            failures: 3,
            requestId: `health-warning-${randomUUID()}`,
            successes: 7,
        },
        {
            expected: 'warning',
            failures: 5,
            requestId: `health-below-critical-rate-${randomUUID()}`,
            successes: 6,
        },
        {
            expected: 'critical',
            failures: 5,
            requestId: `health-critical-${randomUUID()}`,
            successes: 5,
        },
    ] as const;
    for (const fixture of fixtures) {
        await createTerminalHealthFixture({ ...fixture, now });
        const health = await getDeliveryLifecycleNotificationHealth({
            now,
            requestId: fixture.requestId,
        });
        const email = health.channels.find(
            ({ channel }) => channel === 'email',
        );
        assert.ok(email);
        assert.equal(email.failureCount, fixture.failures);
        assert.equal(email.terminalCount, fixture.failures + fixture.successes);
        assert.equal(email.severity, fixture.expected);
        assert.equal(health.severity, fixture.expected);
        assert.equal(
            health.alerts.systemicFailure,
            fixture.expected !== 'healthy',
        );
    }

    const rejectedRequestId = `health-provider-rejected-${randomUUID()}`;
    const accountId = await createTestAccount();
    const rejected = await createLifecycleNotification({
        accountId,
        occurredAt: now,
        requestId: rejectedRequestId,
    });
    await storage()
        .insert(notificationDeliveryAttempts)
        .values([
            ...Array.from({ length: 3 }, () => ({
                accountId,
                attemptedAt: now,
                channel: 'email' as const,
                notificationId: rejected.notificationId,
                provider: 'delivery_lifecycle_email',
                providerResponseCode: 'provider_rejected',
                status: 'dropped' as const,
            })),
            ...Array.from({ length: 7 }, () => ({
                accountId,
                attemptedAt: now,
                channel: 'email' as const,
                notificationId: rejected.notificationId,
                provider: 'delivery_lifecycle_email',
                providerResponseCode: 'sent',
                status: 'sent' as const,
            })),
        ]);
    const rejectedHealth = await getDeliveryLifecycleNotificationHealth({
        now,
        requestId: rejectedRequestId,
    });
    assert.deepEqual(rejectedHealth.channels, [
        {
            channel: 'email',
            failureCount: 3,
            failureRate: 0.3,
            severity: 'warning',
            terminalCount: 10,
        },
    ]);
});

test('health alerts on stale eligible queues, ambiguous sends, and retry exhaustion without counting quiet deferrals', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const now = new Date('2049-07-16T12:00:00.000Z');
    const requestId = `health-queues-${randomUUID()}`;
    const fixture = await createLifecycleNotification({
        accountId,
        occurredAt: now,
        requestId,
    });
    const staleAt = new Date(now.getTime() - 11 * 60 * 1000);
    await storage()
        .insert(notificationDeliveryAttempts)
        .values([
            ...Array.from({ length: 5 }, () => ({
                accountId,
                attemptedAt: staleAt,
                channel: 'push' as const,
                notificationId: fixture.notificationId,
                provider: 'web_push_queue',
                providerResponseCode: 'queued_background',
                status: 'queued' as const,
            })),
            ...Array.from({ length: 3 }, () => ({
                accountId,
                attemptedAt: staleAt,
                channel: 'push' as const,
                notificationId: fixture.notificationId,
                provider: 'web_push_queue',
                providerResponseCode: 'quiet_hours',
                status: 'queued' as const,
            })),
            {
                accountId,
                attemptedAt: staleAt,
                channel: 'email' as const,
                notificationId: fixture.notificationId,
                provider: 'delivery_lifecycle_email',
                providerResponseCode: 'sending',
                status: 'queued' as const,
            },
            ...Array.from({ length: 3 }, (_, index) => ({
                accountId,
                attemptedAt: new Date(staleAt.getTime() + index),
                channel: 'email' as const,
                notificationId: fixture.notificationId,
                provider: 'delivery_lifecycle_email',
                providerResponseCode: 'sender_failed',
                status: 'failed' as const,
            })),
            ...Array.from({ length: 5 }, () => ({
                accountId,
                attemptedAt: new Date(now.getTime() - 9 * 60 * 1000),
                channel: 'push' as const,
                notificationId: fixture.notificationId,
                provider: 'web_push_queue',
                providerResponseCode: 'queued_background',
                status: 'queued' as const,
            })),
        ]);
    const exhaustedAttemptId = await createAttempt({
        accountId,
        attemptedAt: new Date(now.getTime() - 5 * 60 * 1000),
        notificationId: fixture.notificationId,
        providerResponseCode: 'sender_failed',
        status: 'failed',
    });
    await storage()
        .insert(notificationDeliveryEvents)
        .values({
            deliveryAttemptId: exhaustedAttemptId,
            metadata: {
                provider: 'delivery_lifecycle_email',
                reason: 'attempts_exhausted',
                retryable: false,
            },
            notificationId: fixture.notificationId,
            occurredAt: new Date(now.getTime() - 4 * 60 * 1000),
            type: 'failed',
        });

    const health = await getDeliveryLifecycleNotificationHealth({
        now,
        requestId,
    });
    assert.equal(health.staleEligibleQueueCount, 5);
    assert.equal(health.ambiguousEmailSendingCount, 1);
    assert.equal(health.retryExhaustedCount, 1);
    assert.deepEqual(health.alerts, {
        ambiguousEmailSending: true,
        retryExhausted: true,
        staleEligibleQueue: true,
        systemicFailure: false,
    });
    assert.equal(
        JSON.stringify(health).includes(fixture.notificationId),
        false,
    );
});

test('health counts retry exhaustion only when its explicit event is inside the requested window', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const now = new Date('2050-07-16T12:00:00.000Z');
    const fixture = await createLifecycleNotification({
        accountId,
        occurredAt: now,
    });
    const recentAttemptId = await createAttempt({
        accountId,
        attemptedAt: new Date(now.getTime() - 2 * 60 * 1000),
        notificationId: fixture.notificationId,
        providerResponseCode: 'sender_failed',
        status: 'failed',
    });
    const oldAttemptId = await createAttempt({
        accountId,
        attemptedAt: new Date(now.getTime() - 20 * 60 * 1000),
        notificationId: fixture.notificationId,
        providerResponseCode: 'sender_failed',
        status: 'failed',
    });
    await storage()
        .insert(notificationDeliveryEvents)
        .values([
            {
                deliveryAttemptId: recentAttemptId,
                metadata: {
                    provider: 'delivery_lifecycle_email',
                    reason: 'attempts_exhausted',
                    retryable: false,
                },
                notificationId: fixture.notificationId,
                occurredAt: new Date(now.getTime() - 60 * 1000),
                type: 'failed',
            },
            {
                deliveryAttemptId: oldAttemptId,
                metadata: {
                    provider: 'delivery_lifecycle_email',
                    reason: 'attempts_exhausted',
                    retryable: false,
                },
                notificationId: fixture.notificationId,
                occurredAt: new Date(now.getTime() - 16 * 60 * 1000),
                type: 'failed',
            },
        ]);

    const health = await getDeliveryLifecycleNotificationHealth({
        now,
        requestId: fixture.requestId,
    });
    assert.equal(health.retryExhaustedCount, 1);
    assert.equal(health.alerts.retryExhausted, true);
});
