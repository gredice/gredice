import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    acceptOperation,
    assignUserToFarm,
    createEvent,
    createFarm,
    createOperation,
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
