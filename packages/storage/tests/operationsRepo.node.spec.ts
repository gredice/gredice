import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    acceptOperation,
    assignUserToFarm,
    createAccount,
    createEvent,
    createFarm,
    createOperation,
    events,
    getAllOperations,
    getAppliedRaisedBedOperationsForGarden,
    getAssignableFarmUsersByOperationIds,
    getFarmUserAcceptedOperations,
    getOperationById,
    getOperations,
    getOperationsPage,
    knownEvents,
    knownEventTypes,
    operations,
    storage,
    switchOperationEntity,
    users,
} from '@gredice/storage';
import { and, eq } from 'drizzle-orm';
import {
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
    ensureFarmId,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

async function createOperationsPageTestContext() {
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(gardenId, 'operations-page-block');
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);

    return {
        accountId,
        gardenId,
        raisedBedId,
    };
}

async function createDatedOperation(input: {
    accountId: string;
    gardenId: number;
    raisedBedId: number;
    createdAt: Date;
}) {
    const id = await createOperation({
        accountId: input.accountId,
        entityId: 1,
        entityTypeName: 'operation',
        gardenId: input.gardenId,
        raisedBedId: input.raisedBedId,
        timestamp: input.createdAt,
    });

    await storage()
        .update(operations)
        .set({
            createdAt: input.createdAt,
            timestamp: input.createdAt,
        })
        .where(eq(operations.id, id));

    return id;
}

async function setOperationEventCreatedAt(
    operationId: number,
    type: string,
    createdAt: Date,
) {
    await storage()
        .update(events)
        .set({ createdAt })
        .where(
            and(
                eq(events.aggregateId, operationId.toString()),
                eq(events.type, type),
            ),
        );
}

test('farm-targeted operations are visible and assignable for farm users', async () => {
    createTestDb();

    const userId = randomUUID();
    await storage()
        .insert(users)
        .values({
            id: userId,
            userName: `farm-operation-${userId}@example.com`,
            displayName: 'Farm Operation User',
            role: 'farmer',
            createdAt: new Date(),
            updatedAt: new Date(),
        });

    const farmId = await createFarm({
        name: 'Farm Operations',
        longitude: 0,
        latitude: 0,
    });
    await assignUserToFarm(farmId, userId);

    const operationId = await createOperation({
        entityId: 1,
        entityTypeName: 'operation',
        farmId,
    });
    await acceptOperation(operationId);

    const operation = await getOperationById(operationId);
    assert.strictEqual(operation.farmId, farmId);

    const acceptedOperations = await getFarmUserAcceptedOperations(userId, {
        from: new Date('2000-01-01T00:00:00.000Z'),
    });
    assert.ok(
        acceptedOperations.some((candidate) => candidate.id === operationId),
        'Expected farm-targeted operation to appear in farm user schedule reads',
    );

    const assignableFarmUsersByOperationId =
        await getAssignableFarmUsersByOperationIds([operationId]);
    assert.ok(
        assignableFarmUsersByOperationId[operationId]?.some(
            (candidate) => candidate.id === userId,
        ),
        'Expected farm users to be assignable to farm-targeted operations',
    );
});

test('getOperationsPage uses completion dates for completed operation ordering', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createOperationsPageTestContext();

    const oldOperationId = await createDatedOperation({
        accountId,
        gardenId,
        raisedBedId,
        createdAt: new Date('2026-01-01T08:00:00.000Z'),
    });
    const completedOperationId = await createDatedOperation({
        accountId,
        gardenId,
        raisedBedId,
        createdAt: new Date('2026-02-01T08:00:00.000Z'),
    });
    const createdOperationId = await createDatedOperation({
        accountId,
        gardenId,
        raisedBedId,
        createdAt: new Date('2026-04-01T08:00:00.000Z'),
    });
    const scheduledOperationId = await createDatedOperation({
        accountId,
        gardenId,
        raisedBedId,
        createdAt: new Date('2026-01-15T08:00:00.000Z'),
    });
    const completedScheduledOperationId = await createDatedOperation({
        accountId,
        gardenId,
        raisedBedId,
        createdAt: new Date('2026-01-20T08:00:00.000Z'),
    });

    await createEvent(
        knownEvents.operations.completedV1(completedOperationId.toString(), {
            completedBy: 'test-user',
        }),
    );
    await setOperationEventCreatedAt(
        completedOperationId,
        knownEventTypes.operations.complete,
        new Date('2026-05-08T08:00:00.000Z'),
    );
    await createEvent(
        knownEvents.operations.scheduledV1(scheduledOperationId.toString(), {
            scheduledDate: '2026-05-10T08:00:00.000Z',
        }),
    );
    await setOperationEventCreatedAt(
        scheduledOperationId,
        knownEventTypes.operations.schedule,
        new Date('2026-05-03T08:00:00.000Z'),
    );
    await createEvent(
        knownEvents.operations.scheduledV1(
            completedScheduledOperationId.toString(),
            {
                scheduledDate: '2026-05-12T08:00:00.000Z',
            },
        ),
    );
    await setOperationEventCreatedAt(
        completedScheduledOperationId,
        knownEventTypes.operations.schedule,
        new Date('2026-05-01T08:00:00.000Z'),
    );
    await createEvent(
        knownEvents.operations.completedV1(
            completedScheduledOperationId.toString(),
            {
                completedBy: 'test-user',
            },
        ),
    );
    await setOperationEventCreatedAt(
        completedScheduledOperationId,
        knownEventTypes.operations.complete,
        new Date('2026-05-07T08:00:00.000Z'),
    );

    const firstPage = await getOperationsPage({
        accountId,
        gardenId,
        includeCompleted: true,
        limit: 3,
    });

    assert.deepStrictEqual(
        firstPage.items.map((operation) => operation.id),
        [
            scheduledOperationId,
            completedOperationId,
            completedScheduledOperationId,
        ],
    );
    assert.strictEqual(firstPage.nextCursor, 3);

    const secondPage = await getOperationsPage({
        accountId,
        gardenId,
        includeCompleted: true,
        cursor: firstPage.nextCursor ?? 0,
        limit: 2,
    });

    assert.deepStrictEqual(
        secondPage.items.map((operation) => operation.id),
        [createdOperationId, oldOperationId],
    );
    assert.strictEqual(secondPage.nextCursor, null);
});

test('getOperationsPage returns active operations by newest scheduled date first', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createOperationsPageTestContext();

    const soonerOperationId = await createDatedOperation({
        accountId,
        gardenId,
        raisedBedId,
        createdAt: new Date('2026-06-01T08:00:00.000Z'),
    });
    const laterOperationId = await createDatedOperation({
        accountId,
        gardenId,
        raisedBedId,
        createdAt: new Date('2026-06-02T08:00:00.000Z'),
    });
    const canceledOperationId = await createDatedOperation({
        accountId,
        gardenId,
        raisedBedId,
        createdAt: new Date('2026-06-03T08:00:00.000Z'),
    });

    await createEvent(
        knownEvents.operations.scheduledV1(soonerOperationId.toString(), {
            scheduledDate: '2026-06-10T08:00:00.000Z',
        }),
    );
    await createEvent(
        knownEvents.operations.scheduledV1(laterOperationId.toString(), {
            scheduledDate: '2026-06-12T08:00:00.000Z',
        }),
    );
    await createEvent(
        knownEvents.operations.scheduledV1(canceledOperationId.toString(), {
            scheduledDate: '2026-06-30T08:00:00.000Z',
        }),
    );
    await createEvent(
        knownEvents.operations.canceledV1(canceledOperationId.toString(), {
            canceledBy: 'test-user',
            reason: 'test-cancel',
        }),
    );

    const page = await getOperationsPage({
        accountId,
        gardenId,
        includeCompleted: false,
        limit: 2,
    });

    assert.deepStrictEqual(
        page.items.map((operation) => operation.id),
        [laterOperationId, soonerOperationId],
    );
    assert.strictEqual(page.total, 2);
});

test('completed operations expose completion notes and image URLs', async () => {
    createTestDb();

    const completedBy = randomUUID();
    const operationId = await createOperation({
        entityId: 1,
        entityTypeName: 'operation',
        accountId: randomUUID(),
    });
    await acceptOperation(operationId);

    await createEvent(
        knownEvents.operations.completedV1(operationId.toString(), {
            completedBy,
            images: ['https://cdn.gredice.com/operation-complete.jpg'],
            notes: 'Zaliveno nakon berbe.',
        }),
    );

    const operation = await getOperationById(operationId);

    assert.strictEqual(operation.status, 'pendingVerification');
    assert.strictEqual(operation.completedBy, completedBy);
    assert.deepStrictEqual(operation.imageUrls, [
        'https://cdn.gredice.com/operation-complete.jpg',
    ]);
    assert.strictEqual(operation.completionNotes, 'Zaliveno nakon berbe.');
});

test('pending operation completion evidence updates replace notes and images', async () => {
    createTestDb();

    const completedBy = randomUUID();
    const updatedBy = randomUUID();
    const operationId = await createOperation({
        entityId: 1,
        entityTypeName: 'operation',
        accountId: randomUUID(),
    });
    await acceptOperation(operationId);

    await createEvent(
        knownEvents.operations.completedV1(operationId.toString(), {
            completedBy,
            images: ['https://cdn.gredice.com/original.jpg'],
            notes: 'Original note.',
        }),
    );
    const initialOperation = await getOperationById(operationId);

    await createEvent(
        knownEvents.operations.completionEvidenceUpdatedV1(
            operationId.toString(),
            {
                updatedBy,
                images: ['https://cdn.gredice.com/reviewed.jpg'],
                notes: 'Reviewed note.',
            },
        ),
    );

    const operation = await getOperationById(operationId);

    assert.strictEqual(operation.status, 'pendingVerification');
    assert.strictEqual(operation.completedBy, completedBy);
    assert.deepStrictEqual(operation.imageUrls, [
        'https://cdn.gredice.com/reviewed.jpg',
    ]);
    assert.strictEqual(operation.completionNotes, 'Reviewed note.');
    assert.deepStrictEqual(operation.completedAt, initialOperation.completedAt);
});

test('pending operation completion evidence updates can clear notes and images', async () => {
    createTestDb();

    const operationId = await createOperation({
        entityId: 1,
        entityTypeName: 'operation',
        accountId: randomUUID(),
    });
    await acceptOperation(operationId);

    await createEvent(
        knownEvents.operations.completedV1(operationId.toString(), {
            completedBy: randomUUID(),
            images: ['https://cdn.gredice.com/original.jpg'],
            notes: 'Original note.',
        }),
    );
    await createEvent(
        knownEvents.operations.completionEvidenceUpdatedV1(
            operationId.toString(),
            {
                updatedBy: randomUUID(),
                images: [],
                notes: '',
            },
        ),
    );

    const operation = await getOperationById(operationId);

    assert.deepStrictEqual(operation.imageUrls, []);
    assert.strictEqual(operation.completionNotes, '');
});

test('switchOperationEntity changes only the selected operation entity', async () => {
    createTestDb();

    const accountId = randomUUID();
    const assignedUserId = randomUUID();
    const scheduledDate = '2030-01-05T08:00:00.000Z';
    const operationId = await createOperation({
        entityId: 1,
        entityTypeName: 'operation',
        accountId,
        timestamp: new Date('2030-01-02T08:00:00.000Z'),
    });
    await acceptOperation(operationId);
    await createEvent(
        knownEvents.operations.scheduledV1(operationId.toString(), {
            scheduledDate,
        }),
    );
    await createEvent(
        knownEvents.operations.assignedV1(operationId.toString(), {
            assignedUserId,
            assignedBy: randomUUID(),
        }),
    );

    const originalOperation = await getOperationById(operationId);
    await switchOperationEntity(operationId, {
        entityId: 2,
        entityTypeName: 'operation',
    });

    const switchedOperation = await getOperationById(operationId);
    assert.strictEqual(switchedOperation.entityId, 2);
    assert.strictEqual(switchedOperation.entityTypeName, 'operation');
    assert.strictEqual(switchedOperation.accountId, accountId);
    assert.strictEqual(
        switchedOperation.timestamp.getTime(),
        originalOperation.timestamp.getTime(),
    );
    assert.strictEqual(switchedOperation.isAccepted, true);
    assert.strictEqual(switchedOperation.status, 'planned');
    assert.strictEqual(
        switchedOperation.scheduledDate?.toISOString(),
        scheduledDate,
    );
    assert.strictEqual(switchedOperation.assignedUserId, assignedUserId);
});

test('all operations can be filtered by event-derived status', async () => {
    createTestDb();

    const accountId = randomUUID();
    const from = new Date('2040-01-01T00:00:00.000Z');
    const plannedOperationId = await createOperation({
        entityId: 1,
        entityTypeName: 'operation',
        accountId,
        timestamp: new Date('2040-01-02T00:00:00.000Z'),
    });
    const newOperationId = await createOperation({
        entityId: 2,
        entityTypeName: 'operation',
        accountId,
        timestamp: new Date('2040-01-03T00:00:00.000Z'),
    });
    const pendingOperationId = await createOperation({
        entityId: 3,
        entityTypeName: 'operation',
        accountId,
        timestamp: new Date('2040-01-04T00:00:00.000Z'),
    });

    await createEvent(
        knownEvents.operations.scheduledV1(plannedOperationId.toString(), {
            scheduledDate: '2040-01-05T00:00:00.000Z',
        }),
    );
    await createEvent(
        knownEvents.operations.completedV1(pendingOperationId.toString(), {
            completedBy: randomUUID(),
        }),
    );

    const allOperations = await getAllOperations({
        from,
        status: ['new', 'planned'],
    });
    const operationIds = allOperations.map((operation) => operation.id);

    assert.deepStrictEqual(
        new Set(operationIds),
        new Set([newOperationId, plannedOperationId]),
    );
    assert.ok(!operationIds.includes(pendingOperationId));
});

test('getAppliedRaisedBedOperationsForGarden matches the previous in-memory applied raised-bed filter', async () => {
    createTestDb();

    const accountId = await createAccount();
    const otherAccountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const otherGardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(
        gardenId,
        'garden-applied-operations-block',
    );
    const otherBlockId = await createTestBlock(
        otherGardenId,
        'other-garden-applied-operations-block',
    );
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);
    const otherRaisedBedId = await createTestRaisedBed(
        otherGardenId,
        accountId,
        otherBlockId,
    );

    const pendingRaisedBedOperationId = await createOperation({
        entityId: 1,
        entityTypeName: 'operation',
        accountId,
        gardenId,
        raisedBedId,
        timestamp: new Date('2040-02-01T00:00:00.000Z'),
    });
    const completedRaisedBedOperationId = await createOperation({
        entityId: 2,
        entityTypeName: 'operation',
        accountId,
        gardenId,
        raisedBedId,
        timestamp: new Date('2040-02-02T00:00:00.000Z'),
    });
    const plannedRaisedBedOperationId = await createOperation({
        entityId: 3,
        entityTypeName: 'operation',
        accountId,
        gardenId,
        raisedBedId,
        timestamp: new Date('2040-02-03T00:00:00.000Z'),
    });
    const pendingGardenOperationId = await createOperation({
        entityId: 4,
        entityTypeName: 'operation',
        accountId,
        gardenId,
        timestamp: new Date('2040-02-04T00:00:00.000Z'),
    });
    const pendingOtherGardenOperationId = await createOperation({
        entityId: 5,
        entityTypeName: 'operation',
        accountId,
        gardenId: otherGardenId,
        raisedBedId: otherRaisedBedId,
        timestamp: new Date('2040-02-05T00:00:00.000Z'),
    });
    const pendingOtherAccountOperationId = await createOperation({
        entityId: 6,
        entityTypeName: 'operation',
        accountId: otherAccountId,
        gardenId,
        raisedBedId,
        timestamp: new Date('2040-02-06T00:00:00.000Z'),
    });

    await createEvent(
        knownEvents.operations.completedV1(
            pendingRaisedBedOperationId.toString(),
            {
                completedBy: randomUUID(),
            },
        ),
    );
    await createEvent(
        knownEvents.operations.completedV1(
            completedRaisedBedOperationId.toString(),
            {
                completedBy: randomUUID(),
            },
        ),
    );
    await createEvent(
        knownEvents.operations.verifiedV1(
            completedRaisedBedOperationId.toString(),
            {
                verifiedBy: randomUUID(),
            },
        ),
    );
    await createEvent(
        knownEvents.operations.scheduledV1(
            plannedRaisedBedOperationId.toString(),
            {
                scheduledDate: '2040-02-10T00:00:00.000Z',
            },
        ),
    );
    await createEvent(
        knownEvents.operations.completedV1(
            pendingGardenOperationId.toString(),
            {
                completedBy: randomUUID(),
            },
        ),
    );
    await createEvent(
        knownEvents.operations.completedV1(
            pendingOtherGardenOperationId.toString(),
            {
                completedBy: randomUUID(),
            },
        ),
    );
    await createEvent(
        knownEvents.operations.completedV1(
            pendingOtherAccountOperationId.toString(),
            {
                completedBy: randomUUID(),
            },
        ),
    );

    const oldFilteredOperationIds = (await getOperations(accountId, gardenId))
        .filter(
            (operation) =>
                operation.raisedBedId &&
                (operation.status === 'completed' ||
                    operation.status === 'pendingVerification'),
        )
        .map((operation) => operation.id);
    const boundedOperationIds = (
        await getAppliedRaisedBedOperationsForGarden(accountId, gardenId)
    ).map((operation) => operation.id);

    assert.deepStrictEqual(
        new Set(boundedOperationIds),
        new Set(oldFilteredOperationIds),
    );
    assert.deepStrictEqual(
        new Set(boundedOperationIds),
        new Set([completedRaisedBedOperationId, pendingRaisedBedOperationId]),
    );
});
