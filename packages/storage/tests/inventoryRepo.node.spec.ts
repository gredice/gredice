import assert from 'node:assert/strict';
import test from 'node:test';
import {
    addInventoryItem,
    createAccount,
    createGardenBlock,
    getGardenBoxBlocksForAccount,
    getGardenBoxInventory,
    getInventory,
    setGardenBoxInventory,
} from '@gredice/storage';
import { createTestGarden, ensureFarmId } from './helpers/testHelpers';
import { createTestDb } from './testDb';

function itemSummary(
    items: Array<{
        entityTypeName: string;
        entityId: string;
        amount: number;
    }>,
) {
    return items
        .map((item) => ({
            entityTypeName: item.entityTypeName,
            entityId: item.entityId,
            amount: item.amount,
        }))
        .sort((a, b) =>
            `${a.entityTypeName}-${a.entityId}`.localeCompare(
                `${b.entityTypeName}-${b.entityId}`,
            ),
        );
}

test('garden box inventory is scoped per box and separate from account inventory', async () => {
    createTestDb();

    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const firstBoxId = await createGardenBlock(gardenId, 'GardenBox');
    const secondBoxId = await createGardenBlock(gardenId, 'GardenBox');

    await addInventoryItem(accountId, {
        entityTypeName: 'plantSort',
        entityId: '101',
        amount: 5,
    });
    await setGardenBoxInventory(accountId, gardenId, firstBoxId, [
        { entityTypeName: 'plantSort', entityId: '101', amount: 2 },
        { entityTypeName: 'operation', entityId: '7', amount: 1 },
    ]);
    await setGardenBoxInventory(accountId, gardenId, secondBoxId, [
        { entityTypeName: 'plantSort', entityId: '101', amount: 4 },
    ]);

    assert.deepEqual(itemSummary(await getInventory(accountId)), [
        { entityTypeName: 'plantSort', entityId: '101', amount: 5 },
    ]);
    assert.deepEqual(
        itemSummary(
            await getGardenBoxInventory(accountId, gardenId, firstBoxId),
        ),
        [
            { entityTypeName: 'operation', entityId: '7', amount: 1 },
            { entityTypeName: 'plantSort', entityId: '101', amount: 2 },
        ],
    );
    assert.deepEqual(
        itemSummary(
            await getGardenBoxInventory(accountId, gardenId, secondBoxId),
        ),
        [{ entityTypeName: 'plantSort', entityId: '101', amount: 4 }],
    );
});

test('setGardenBoxInventory replaces contents and collapses duplicate items', async () => {
    createTestDb();

    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const boxId = await createGardenBlock(gardenId, 'GardenBox');

    await setGardenBoxInventory(accountId, gardenId, boxId, [
        { entityTypeName: 'plantSort', entityId: '101', amount: 5 },
        { entityTypeName: 'operation', entityId: '7', amount: 2 },
    ]);
    await setGardenBoxInventory(accountId, gardenId, boxId, [
        { entityTypeName: 'plantSort', entityId: '101', amount: 1 },
        { entityTypeName: 'plantSort', entityId: '101', amount: 2 },
        { entityTypeName: 'operation', entityId: '7', amount: 0 },
    ]);

    assert.deepEqual(
        itemSummary(await getGardenBoxInventory(accountId, gardenId, boxId)),
        [{ entityTypeName: 'plantSort', entityId: '101', amount: 3 }],
    );
});

test('getGardenBoxBlocksForAccount returns active GardenBox blocks for only that account', async () => {
    createTestDb();

    const accountId = await createAccount();
    const otherAccountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const otherGardenId = await createTestGarden({
        accountId: otherAccountId,
        farmId,
    });
    const boxId = await createGardenBlock(gardenId, 'GardenBox');
    await createGardenBlock(gardenId, 'Bucket');
    await createGardenBlock(otherGardenId, 'GardenBox');

    const boxes = await getGardenBoxBlocksForAccount(accountId);
    assert.deepEqual(
        boxes.map((box) => ({
            blockId: box.blockId,
            gardenId: box.gardenId,
        })),
        [{ blockId: boxId, gardenId }],
    );
});
