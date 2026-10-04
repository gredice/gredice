import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    accountUsers,
    createNotification,
    createUserWithPassword,
    deliveryRequests,
    events,
    filterMissingDeliveryLifecycleNotifications,
    getDeliveryLifecycleReconciliationCandidates,
    getUser,
    knownEventTypes,
    markDeliveryLifecycleNotificationProcessed,
    operations,
    storage,
    users,
} from '@gredice/storage';
import { createTestAccount, ensureFarmId } from './helpers/testHelpers';
import { createTestDb } from './testDb';

test('lifecycle reconciliation drains oldest pending source beyond one batch and advances by durable marker', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const [operation] = await storage()
        .insert(operations)
        .values({
            accountId,
            entityId: 99_001,
            entityTypeName: 'operation',
        })
        .returning({ id: operations.id });
    assert.ok(operation);
    const requestId = randomUUID();
    await storage().insert(deliveryRequests).values({
        id: requestId,
        operationId: operation.id,
    });
    const startedAt = new Date('2035-01-01T00:00:00.000Z');
    const sourceRows = await storage()
        .insert(events)
        .values(
            Array.from({ length: 501 }, (_, index) => {
                const occurredAt = new Date(startedAt.getTime() + index + 1);
                return {
                    aggregateId: requestId,
                    createdAt: occurredAt,
                    data: {
                        clientOperationId: `pickup-${index}`,
                        occurredAt: occurredAt.toISOString(),
                        retryAttempt: 0,
                        routeRevision: index + 1,
                        runId: 'run-oldest-first',
                        stopId: 77,
                    },
                    type: knownEventTypes.delivery.requestRouteStarted,
                    version: 1,
                };
            }),
        )
        .returning({ id: events.id });
    const firstSourceEventId = sourceRows[0]?.id;
    const secondSourceEventId = sourceRows[1]?.id;
    assert.ok(firstSourceEventId);
    assert.ok(secondSourceEventId);

    const firstBatch = await getDeliveryLifecycleReconciliationCandidates({
        limit: 1,
        startedAt,
    });
    assert.equal(firstBatch.sourceCount, 1);
    assert.equal(firstBatch.candidates[0]?.eventId, firstSourceEventId);

    await markDeliveryLifecycleNotificationProcessed({
        completed: true,
        processedAt: new Date('2035-01-01T01:00:00.000Z'),
        reason: 'already-published',
        requestId,
        skipped: false,
        sourceEventId: firstSourceEventId,
    });

    const nextBatch = await getDeliveryLifecycleReconciliationCandidates({
        limit: 1,
        startedAt,
    });
    assert.equal(nextBatch.candidates[0]?.eventId, secondSourceEventId);
});

test('lifecycle reconciliation terminally classifies invalid identifiers and unknown source versions', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const [operation] = await storage()
        .insert(operations)
        .values({
            accountId,
            entityId: 99_002,
            entityTypeName: 'operation',
        })
        .returning({ id: operations.id });
    assert.ok(operation);
    const requestId = randomUUID();
    const unsafeRequestId = `unsafe/request-${randomUUID()}`;
    await storage()
        .insert(deliveryRequests)
        .values([
            { id: requestId, operationId: operation.id },
            { id: unsafeRequestId, operationId: operation.id },
        ]);
    const startedAt = new Date('2040-01-01T00:00:00.000Z');
    const occurredAt = new Date('2040-01-01T00:01:00.000Z');
    const transitionData = {
        clientOperationId: 'operation-1',
        occurredAt: occurredAt.toISOString(),
        retryAttempt: 0,
        routeRevision: 1,
        runId: 'run-1',
        stopId: 42,
    };
    await storage()
        .insert(events)
        .values([
            {
                aggregateId: requestId,
                createdAt: occurredAt,
                data: { ...transitionData, runId: '   ' },
                type: knownEventTypes.delivery.requestRouteStarted,
                version: 1,
            },
            {
                aggregateId: requestId,
                createdAt: new Date(occurredAt.getTime() + 1),
                data: transitionData,
                type: knownEventTypes.delivery.requestArrived,
                version: 2,
            },
            {
                aggregateId: requestId,
                createdAt: new Date(occurredAt.getTime() + 2),
                data: {
                    fulfilledAt: occurredAt.toISOString(),
                    handoffVerification: {
                        retryAttempt: 0,
                        runId: 'run-1',
                        stopId: 42,
                    },
                },
                type: knownEventTypes.delivery.requestFulfilled,
                version: 1,
            },
            {
                aggregateId: unsafeRequestId,
                createdAt: new Date(occurredAt.getTime() + 3),
                data: transitionData,
                type: knownEventTypes.delivery.requestRouteStarted,
                version: 1,
            },
        ]);

    const pending = await getDeliveryLifecycleReconciliationCandidates({
        limit: 10,
        startedAt,
    });
    assert.equal(pending.candidates.length, 0);
    assert.equal(pending.skipped.length, 4);
    assert.ok(
        pending.skipped.every(
            ({ reason }) => reason === 'invalid-source-event',
        ),
    );
});

test('lifecycle reconciliation expands current account recipients and retries only missing rows', async () => {
    createTestDb();
    await ensureFarmId();
    const firstUserId = await createUserWithPassword(
        `lifecycle-recipient-first-${randomUUID()}@example.test`,
        'password',
    );
    const firstUser = await getUser(firstUserId);
    assert.ok(firstUser);
    const accountId = firstUser.accounts[0]?.accountId;
    assert.ok(accountId);
    const secondUserId = await createUserWithPassword(
        `lifecycle-recipient-second-${randomUUID()}@example.test`,
        'password',
    );
    const driverUserId = randomUUID();
    await storage()
        .insert(users)
        .values({
            displayName: 'Lifecycle driver',
            id: driverUserId,
            role: 'driver',
            userName: `lifecycle-driver-${driverUserId}@example.test`,
        });
    await storage()
        .insert(accountUsers)
        .values([
            { accountId, userId: secondUserId },
            { accountId, userId: driverUserId },
        ]);
    const candidate = {
        accountId,
        eventId: 123,
        milestone: 'arrived' as const,
        occurredAt: new Date('2041-01-01T00:00:00.000Z'),
        requestId: randomUUID(),
        retryAttempt: 0,
        runId: 'run-recipient-fanout',
        sourceKind: 'stop-operation' as const,
        sourceVersion: 1,
        stopId: 42,
    };

    const initialMissing = await filterMissingDeliveryLifecycleNotifications([
        candidate,
    ]);
    assert.deepEqual(
        initialMissing.map(({ userId }) => userId).sort(),
        [firstUserId, secondUserId].sort(),
    );

    await createNotification(
        {
            accountId,
            category: 'delivery_updates',
            content: 'Dostava je stigla.',
            header: 'Dostava',
            metadata: {
                milestone: candidate.milestone,
                requestId: candidate.requestId,
                retryAttempt: candidate.retryAttempt,
                runId: candidate.runId,
                stopId: String(candidate.stopId),
            },
            timestamp: candidate.occurredAt,
            type: 'delivery_lifecycle',
            userId: firstUserId,
        },
        { routeDelivery: false },
    );
    const retryMissing = await filterMissingDeliveryLifecycleNotifications([
        candidate,
    ]);
    assert.deepEqual(
        retryMissing.map(({ userId }) => userId),
        [secondUserId],
    );
});
