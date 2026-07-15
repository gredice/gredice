import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    acceptOperation,
    assignUserToFarm,
    createEvent,
    createFarm,
    createOperation,
    events,
    getFarmUserPendingVerificationOperations,
    knownEvents,
    knownEventTypes,
    storage,
    users,
} from '@gredice/storage';
import { and, eq } from 'drizzle-orm';
import { createTestDb } from './testDb';

async function createTestUser() {
    const userId = randomUUID();
    await storage()
        .insert(users)
        .values({
            id: userId,
            userName: `${userId}@example.com`,
            role: 'farmer',
        });
    return userId;
}

async function createAcceptedFarmOperation(farmId: number, timestamp: Date) {
    const operationId = await createOperation({
        entityId: 1,
        entityTypeName: 'operation',
        farmId,
        timestamp,
    });
    await acceptOperation(operationId);
    return operationId;
}

test('pending operation read keeps old outstanding work and excludes terminal or unrelated work', async () => {
    createTestDb();
    const userId = await createTestUser();
    const otherUserId = await createTestUser();
    const farmId = await createFarm({
        name: `Pending operation farm ${randomUUID()}`,
        latitude: 45.8,
        longitude: 15.9,
    });
    const otherFarmId = await createFarm({
        name: `Other pending operation farm ${randomUUID()}`,
        latitude: 45.9,
        longitude: 16,
    });
    await Promise.all([
        assignUserToFarm(farmId, userId),
        assignUserToFarm(otherFarmId, otherUserId),
    ]);

    const oldPendingOperationId = await createAcceptedFarmOperation(
        farmId,
        new Date('2000-01-01T08:00:00.000Z'),
    );
    const verifiedOperationId = await createAcceptedFarmOperation(
        farmId,
        new Date('2000-01-02T08:00:00.000Z'),
    );
    const untouchedOperationId = await createAcceptedFarmOperation(
        farmId,
        new Date('2000-01-03T08:00:00.000Z'),
    );
    const otherFarmPendingOperationId = await createAcceptedFarmOperation(
        otherFarmId,
        new Date('2000-01-04T08:00:00.000Z'),
    );

    for (const operationId of [
        oldPendingOperationId,
        verifiedOperationId,
        otherFarmPendingOperationId,
    ]) {
        await createEvent(
            knownEvents.operations.completedV1(operationId.toString(), {
                completedBy: randomUUID(),
            }),
        );
    }
    await storage()
        .update(events)
        .set({ createdAt: new Date('2000-01-05T08:00:00.000Z') })
        .where(
            and(
                eq(events.aggregateId, oldPendingOperationId.toString()),
                eq(events.type, knownEventTypes.operations.complete),
            ),
        );
    await createEvent(
        knownEvents.operations.verifiedV1(verifiedOperationId.toString(), {
            verifiedBy: randomUUID(),
        }),
    );

    const pendingOperations =
        await getFarmUserPendingVerificationOperations(userId);
    const pendingOperationIds = pendingOperations.map(
        (operation) => operation.id,
    );

    assert.deepStrictEqual(pendingOperationIds, [oldPendingOperationId]);
    assert.ok(!pendingOperationIds.includes(verifiedOperationId));
    assert.ok(!pendingOperationIds.includes(untouchedOperationId));
    assert.ok(!pendingOperationIds.includes(otherFarmPendingOperationId));
});
