import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    assignUserToFarm,
    createFarm,
    farms,
    getFarmsForUser,
    storage,
    users,
} from '@gredice/storage';
import { eq } from 'drizzle-orm';
import { createTestDb } from './testDb';

async function createFarmer() {
    const userId = randomUUID();
    await storage()
        .insert(users)
        .values({
            id: userId,
            userName: `farm-dashboard-${userId}@example.com`,
            displayName: 'Farm Dashboard User',
            role: 'farmer',
        });

    return userId;
}

async function createTestFarm(name: string) {
    return createFarm({
        name,
        latitude: 0,
        longitude: 0,
    });
}

test('getFarmsForUser returns only assigned active farms', async () => {
    createTestDb();

    const userId = await createFarmer();
    const otherUserId = await createFarmer();
    const assignedFarmId = await createTestFarm('Assigned farm');
    const otherUsersFarmId = await createTestFarm("Other user's farm");
    const deletedFarmId = await createTestFarm('Deleted assigned farm');

    await Promise.all([
        assignUserToFarm(assignedFarmId, userId),
        assignUserToFarm(otherUsersFarmId, otherUserId),
        assignUserToFarm(deletedFarmId, userId),
    ]);
    await storage()
        .update(farms)
        .set({ isDeleted: true })
        .where(eq(farms.id, deletedFarmId));

    const visibleFarms = await getFarmsForUser(userId);

    assert.deepEqual(
        visibleFarms.map((farm) => farm.id),
        [assignedFarmId],
    );
});
