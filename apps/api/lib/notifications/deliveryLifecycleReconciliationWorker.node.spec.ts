import assert from 'node:assert/strict';
import test from 'node:test';
import type { DeliveryLifecycleReconciliationCandidate } from '@gredice/storage';
import {
    deliveryLifecycleReconciliationEnabled,
    deliveryLifecycleReconciliationStartedAt,
    processDeliveryLifecycleReconciliation,
    reconciledDeliveryLifecycleEvent,
} from './deliveryLifecycleReconciliationWorker';

const rolloutStartedAt = '2026-07-16T12:00:00.000Z';

function candidate(
    overrides: Partial<DeliveryLifecycleReconciliationCandidate> = {},
): DeliveryLifecycleReconciliationCandidate {
    return {
        accountId: 'account-1',
        eventId: 11,
        milestone: 'arrived',
        occurredAt: new Date('2026-07-16T12:00:00.000Z'),
        requestId: 'request-1',
        retryAttempt: 0,
        runId: 'run-1',
        sourceKind: 'stop-operation',
        sourceVersion: 2,
        stopId: 42,
        ...overrides,
    };
}

function enableReconciliation(t: test.TestContext) {
    const keys = [
        'GREDICE_DELIVERY_NOTIFICATION_RECONCILIATION_ENABLED',
        'GREDICE_DELIVERY_NOTIFICATIONS_ENABLED',
        'GREDICE_DELIVERY_NOTIFICATION_ROLLOUT_STARTED_AT',
    ] as const;
    const previous = new Map(keys.map((key) => [key, process.env[key]]));
    t.after(() => {
        for (const key of keys) {
            const value = previous.get(key);
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });
    process.env.GREDICE_DELIVERY_NOTIFICATION_RECONCILIATION_ENABLED = 'true';
    process.env.GREDICE_DELIVERY_NOTIFICATIONS_ENABLED = 'true';
    process.env.GREDICE_DELIVERY_NOTIFICATION_ROLLOUT_STARTED_AT =
        rolloutStartedAt;
}

test('delivery lifecycle reconciliation requires both flags and an exact rollout boundary', () => {
    assert.equal(
        deliveryLifecycleReconciliationEnabled(
            undefined,
            'true',
            rolloutStartedAt,
        ),
        false,
    );
    assert.equal(
        deliveryLifecycleReconciliationEnabled(
            'true',
            undefined,
            rolloutStartedAt,
        ),
        false,
    );
    assert.equal(
        deliveryLifecycleReconciliationEnabled('true', 'true', undefined),
        false,
    );
    assert.equal(
        deliveryLifecycleReconciliationEnabled('true', 'true', '2026-07-16'),
        false,
    );
    assert.equal(
        deliveryLifecycleReconciliationEnabled(
            ' TRUE ',
            'true',
            rolloutStartedAt,
        ),
        true,
    );
    assert.deepEqual(
        deliveryLifecycleReconciliationStartedAt(rolloutStartedAt),
        new Date(rolloutStartedAt),
    );
});

test('reconciliation reconstructs only the bounded authoritative event', () => {
    const event = reconciledDeliveryLifecycleEvent(
        candidate({
            exception: {
                outcome: 'deferred',
                reason: 'customer-unavailable',
            },
            milestone: 'exception',
            sourceKind: 'exception-operation',
        }),
    );
    assert.equal(event.milestone, 'exception');
    assert.equal(event.requestId, 'request-1');
    assert.equal(event.source.id, 'delivery-event:11');
    assert.equal(JSON.stringify(event).includes('latitude'), false);
});

test('reconciliation publishes missing rows, marks success, and leaves failures pending', async (t) => {
    enableReconciliation(t);
    const created: string[] = [];
    const marked: number[] = [];
    const result = await processDeliveryLifecycleReconciliation({
        now: new Date('2026-07-16T13:00:00.000Z'),
        dependencies: {
            getCandidates: async () => ({
                candidates: [
                    candidate(),
                    candidate({
                        eventId: 12,
                        milestone: 'delivered',
                        requestId: 'request-2',
                    }),
                ],
                skipped: [],
                sourceCount: 2,
            }),
            filterMissing: async (candidates) =>
                candidates.map((candidate) => ({
                    ...candidate,
                    userId: `user:${candidate.requestId}`,
                })),
            create: async (notification) => {
                const requestId = String(notification.metadata?.requestId);
                if (requestId === 'request-1') throw new Error('transient');
                assert.equal(notification.userId, 'user:request-2');
                created.push(requestId);
                return 'notification-id';
            },
            markProcessed: async ({ sourceEventId }) => {
                marked.push(sourceEventId);
            },
        },
    });
    assert.deepEqual(result, {
        enabled: true,
        failed: 1,
        missing: 2,
        published: 1,
        scanned: 2,
        skipped: 0,
    });
    assert.deepEqual(created, ['request-2']);
    assert.deepEqual(marked, [12]);
});

test('reconciliation acknowledges an existing notification and terminally skips invalid sources', async (t) => {
    enableReconciliation(t);
    const calls: Array<{
        completed: boolean;
        reason: string;
        sourceEventId: number;
    }> = [];
    const result = await processDeliveryLifecycleReconciliation({
        dependencies: {
            getCandidates: async ({ startedAt, limit }) => {
                assert.deepEqual(startedAt, new Date(rolloutStartedAt));
                assert.equal(limit, 1);
                return {
                    candidates: [candidate()],
                    skipped: [
                        {
                            eventId: 10,
                            reason: 'invalid-source-event',
                            requestId: 'request-invalid',
                        },
                    ],
                    sourceCount: 2,
                };
            },
            filterMissing: async () => [],
            create: async () => {
                throw new Error('existing rows must not be republished');
            },
            markProcessed: async ({ completed, reason, sourceEventId }) => {
                calls.push({ completed, reason, sourceEventId });
            },
        },
        limit: 1,
    });
    assert.deepEqual(calls, [
        {
            completed: true,
            reason: 'already-published',
            sourceEventId: 11,
        },
        {
            completed: false,
            reason: 'invalid-source-event',
            sourceEventId: 10,
        },
    ]);
    assert.deepEqual(result, {
        enabled: true,
        failed: 0,
        missing: 0,
        published: 0,
        scanned: 2,
        skipped: 1,
    });
});

test('reconciliation marks a source only after every recipient exists and retries only the missing recipient', async (t) => {
    enableReconciliation(t);
    const source = candidate();
    const created: string[] = [];
    const marked: number[] = [];
    let successfulRecipientSettled = false;
    const firstResult = await processDeliveryLifecycleReconciliation({
        dependencies: {
            getCandidates: async () => ({
                candidates: [source],
                skipped: [],
                sourceCount: 1,
            }),
            filterMissing: async () => [
                { ...source, userId: 'user-1' },
                { ...source, userId: 'user-2' },
            ],
            create: async (notification) => {
                assert.ok(notification.userId);
                created.push(notification.userId);
                if (notification.userId === 'user-2') {
                    throw new Error('recipient write failed');
                }
                await new Promise<void>((resolve) => setImmediate(resolve));
                successfulRecipientSettled = true;
                return `notification:${notification.userId}`;
            },
            markProcessed: async ({ sourceEventId }) => {
                marked.push(sourceEventId);
            },
        },
    });
    assert.deepEqual(firstResult, {
        enabled: true,
        failed: 1,
        missing: 1,
        published: 0,
        scanned: 1,
        skipped: 0,
    });
    assert.deepEqual(created.sort(), ['user-1', 'user-2']);
    assert.equal(successfulRecipientSettled, true);
    assert.equal(marked.length, 0);

    created.length = 0;
    const retryResult = await processDeliveryLifecycleReconciliation({
        dependencies: {
            getCandidates: async () => ({
                candidates: [source],
                skipped: [],
                sourceCount: 1,
            }),
            filterMissing: async () => [{ ...source, userId: 'user-2' }],
            create: async (notification) => {
                assert.equal(notification.userId, 'user-2');
                created.push(notification.userId);
                return 'notification:user-2';
            },
            markProcessed: async ({ sourceEventId }) => {
                marked.push(sourceEventId);
            },
        },
    });
    assert.deepEqual(retryResult, {
        enabled: true,
        failed: 0,
        missing: 1,
        published: 1,
        scanned: 1,
        skipped: 0,
    });
    assert.deepEqual(created, ['user-2']);
    assert.deepEqual(marked, [source.eventId]);
});

test('a durable route-progress source recovers a failed fast publish with the same recipient idempotency key', async (t) => {
    enableReconciliation(t);
    const source = candidate({
        eventId: 91,
        milestone: 'next-stop',
        sourceKind: 'route-progress',
        sourceVersion: 7,
    });
    const idempotencyKeys: string[] = [];
    const marked: number[] = [];
    const dependencies = {
        getCandidates: async () => ({
            candidates: [source],
            skipped: [],
            sourceCount: 1,
        }),
        filterMissing: async () => [{ ...source, userId: 'route-user' }],
        markProcessed: async ({ sourceEventId }: { sourceEventId: number }) => {
            marked.push(sourceEventId);
        },
    };

    const failed = await processDeliveryLifecycleReconciliation({
        dependencies: {
            ...dependencies,
            create: async (_notification, options) => {
                idempotencyKeys.push(options?.idempotencyKey ?? '');
                throw new Error('transient notification write');
            },
        },
    });
    assert.equal(failed.failed, 1);
    assert.deepEqual(marked, []);

    const recovered = await processDeliveryLifecycleReconciliation({
        dependencies: {
            ...dependencies,
            create: async (_notification, options) => {
                idempotencyKeys.push(options?.idempotencyKey ?? '');
                return 'route-progress-notification';
            },
        },
    });
    assert.deepEqual(recovered, {
        enabled: true,
        failed: 0,
        missing: 1,
        published: 1,
        scanned: 1,
        skipped: 0,
    });
    assert.equal(idempotencyKeys.length, 2);
    assert.ok(idempotencyKeys[0]);
    assert.equal(idempotencyKeys[0], idempotencyKeys[1]);
    assert.deepEqual(marked, [source.eventId]);
});
