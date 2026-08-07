import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    assignUserToFarm,
    createAccount,
    createFarm,
    createGarden,
    getFarmUserRaisedBeds,
    storage,
    users,
} from '@gredice/storage';
import { eq } from 'drizzle-orm';
import { farms } from '../src/schema';
import { createTestBlock, createTestRaisedBed } from './helpers/testHelpers';
import { createTestDb } from './testDb';

async function createTestUser() {
    const userId = randomUUID();
    await storage()
        .insert(users)
        .values({
            id: userId,
            userName: `${userId}@example.com`,
            role: 'user',
        });
    return userId;
}

async function createFarmRaisedBed({
    farmId,
    isSandbox = false,
    name,
}: {
    farmId: number;
    isSandbox?: boolean;
    name: string;
}) {
    const accountId = await createAccount();
    const gardenId = await createGarden({
        accountId,
        farmId,
        isSandbox,
        name,
    });
    const blockId = await createTestBlock(gardenId, `${name} block`);
    return createTestRaisedBed(gardenId, accountId, blockId);
}

test('getFarmUserRaisedBeds returns only beds from active assigned non-sandbox farms with their farm id', async () => {
    createTestDb();
    const userId = await createTestUser();
    const otherUserId = await createTestUser();
    const activeFarmId = await createFarm({
        name: `Active assigned farm ${randomUUID()}`,
        latitude: 45.8,
        longitude: 15.9,
    });
    const otherFarmId = await createFarm({
        name: `Other user's farm ${randomUUID()}`,
        latitude: 45.9,
        longitude: 16,
    });
    const deletedFarmId = await createFarm({
        name: `Deleted assigned farm ${randomUUID()}`,
        latitude: 46,
        longitude: 16.1,
    });

    await Promise.all([
        assignUserToFarm(activeFarmId, userId),
        assignUserToFarm(deletedFarmId, userId),
        assignUserToFarm(otherFarmId, otherUserId),
    ]);

    const activeRaisedBedId = await createFarmRaisedBed({
        farmId: activeFarmId,
        name: `Active assigned garden ${randomUUID()}`,
    });
    const otherUsersRaisedBedId = await createFarmRaisedBed({
        farmId: otherFarmId,
        name: `Other user's garden ${randomUUID()}`,
    });
    const deletedFarmRaisedBedId = await createFarmRaisedBed({
        farmId: deletedFarmId,
        name: `Deleted assigned farm garden ${randomUUID()}`,
    });
    const sandboxRaisedBedId = await createFarmRaisedBed({
        farmId: activeFarmId,
        isSandbox: true,
        name: `Sandbox garden ${randomUUID()}`,
    });

    await storage()
        .update(farms)
        .set({ isDeleted: true })
        .where(eq(farms.id, deletedFarmId));

    const raisedBeds = await getFarmUserRaisedBeds(userId);

    assert.deepStrictEqual(
        raisedBeds.map((raisedBed) => ({
            farmId: raisedBed.farmId,
            id: raisedBed.id,
        })),
        [{ farmId: activeFarmId, id: activeRaisedBedId }],
    );
    assert.ok(
        !raisedBeds.some((raisedBed) =>
            [
                otherUsersRaisedBedId,
                deletedFarmRaisedBedId,
                sandboxRaisedBedId,
            ].includes(raisedBed.id),
        ),
    );
});
