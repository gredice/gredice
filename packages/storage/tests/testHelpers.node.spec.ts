import assert from 'node:assert/strict';
import test from 'node:test';
import { createFarm, farms, getFarms, storage } from '@gredice/storage';
import { eq, inArray } from 'drizzle-orm';
import { ensureFarmId } from './helpers/testHelpers';
import { createTestDb } from './testDb';

test('ensureFarmId creates and reuses an active farm when only deleted farms exist', async (t) => {
    createTestDb();

    const originalFarms = await getFarms();
    const originalFarmIds = new Set(originalFarms.map((farm) => farm.id));
    t.after(async () => {
        const createdFarmIds = (await getFarms())
            .filter((farm) => !originalFarmIds.has(farm.id))
            .map((farm) => farm.id);
        if (createdFarmIds.length > 0) {
            await storage()
                .delete(farms)
                .where(inArray(farms.id, createdFarmIds));
        }

        for (const farm of originalFarms) {
            await storage()
                .update(farms)
                .set({ isDeleted: farm.isDeleted })
                .where(eq(farms.id, farm.id));
        }
    });

    const deletedFarmId = await createFarm({
        name: 'Deleted helper farm',
        latitude: 0,
        longitude: 0,
    });
    const allFarmIds = (await getFarms()).map((farm) => farm.id);
    await storage()
        .update(farms)
        .set({ isDeleted: true })
        .where(inArray(farms.id, allFarmIds));

    const activeFarmId = await ensureFarmId();
    const activeFarm = (await getFarms()).find(
        (farm) => farm.id === activeFarmId,
    );

    assert.ok(activeFarm);
    assert.equal(activeFarm.isDeleted, false);
    assert.notEqual(activeFarm.id, deletedFarmId);
    assert.equal(await ensureFarmId(), activeFarmId);
});
