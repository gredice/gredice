import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    acceptOperation,
    assignUserToFarm,
    createEvent,
    createFarm,
    createOperation,
    getAllOperations,
    getAssignableFarmUsersByOperationIds,
    getFarmUserAcceptedOperations,
    getOperationById,
    knownEvents,
    storage,
    users,
} from '@gredice/storage';
import { createTestDb } from './testDb';

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

    const operations = await getAllOperations({
        from,
        status: ['new', 'planned'],
    });
    const operationIds = operations.map((operation) => operation.id);

    assert.deepStrictEqual(
        new Set(operationIds),
        new Set([newOperationId, plannedOperationId]),
    );
    assert.ok(!operationIds.includes(pendingOperationId));
});
