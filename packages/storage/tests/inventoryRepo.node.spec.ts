import assert from 'node:assert/strict';
import test from 'node:test';
import {
    addGardenBoxInventoryItem,
    addInventoryItem,
    createAccount,
    createGardenBlock,
    GARDEN_BOX_BLOCK_STACK_LIMIT,
    GARDEN_BOX_BLOCK_STACK_SIZE,
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
        { entityTypeName: 'block', entityId: '101', amount: 2 },
        { entityTypeName: 'block', entityId: '7', amount: 1 },
    ]);
    await setGardenBoxInventory(accountId, gardenId, secondBoxId, [
        { entityTypeName: 'block', entityId: '101', amount: 4 },
    ]);

    assert.deepEqual(itemSummary(await getInventory(accountId)), [
        { entityTypeName: 'plantSort', entityId: '101', amount: 5 },
    ]);
    assert.deepEqual(
        itemSummary(
            await getGardenBoxInventory(accountId, gardenId, firstBoxId),
        ),
        [
            { entityTypeName: 'block', entityId: '101', amount: 2 },
            { entityTypeName: 'block', entityId: '7', amount: 1 },
        ],
    );
    assert.deepEqual(
        itemSummary(
            await getGardenBoxInventory(accountId, gardenId, secondBoxId),
        ),
        [{ entityTypeName: 'block', entityId: '101', amount: 4 }],
    );
});

test('setGardenBoxInventory replaces contents and collapses duplicate items', async () => {
    createTestDb();

    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const boxId = await createGardenBlock(gardenId, 'GardenBox');

    await setGardenBoxInventory(accountId, gardenId, boxId, [
        { entityTypeName: 'block', entityId: '101', amount: 5 },
        { entityTypeName: 'block', entityId: '7', amount: 2 },
    ]);
    await setGardenBoxInventory(accountId, gardenId, boxId, [
        { entityTypeName: 'block', entityId: '101', amount: 1 },
        { entityTypeName: 'block', entityId: '101', amount: 2 },
        { entityTypeName: 'block', entityId: '7', amount: 0 },
    ]);

    assert.deepEqual(
        itemSummary(await getGardenBoxInventory(accountId, gardenId, boxId)),
        [{ entityTypeName: 'block', entityId: '101', amount: 3 }],
    );
});

test('setGardenBoxInventory enforces garden box block stack limits', async () => {
    createTestDb();

    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const boxId = await createGardenBlock(gardenId, 'GardenBox');

    await setGardenBoxInventory(
        accountId,
        gardenId,
        boxId,
        Array.from({ length: GARDEN_BOX_BLOCK_STACK_LIMIT }, (_, index) => ({
            entityTypeName: 'block',
            entityId: `block-${index.toString()}`,
            amount: GARDEN_BOX_BLOCK_STACK_SIZE,
        })),
    );

    await assert.rejects(
        setGardenBoxInventory(accountId, gardenId, boxId, [
            ...Array.from(
                { length: GARDEN_BOX_BLOCK_STACK_LIMIT + 1 },
                (_, index) => ({
                    entityTypeName: 'block',
                    entityId: `block-${index.toString()}`,
                    amount: 1,
                }),
            ),
        ]),
        /najviše 6 različitih blokova/u,
    );

    await assert.rejects(
        setGardenBoxInventory(accountId, gardenId, boxId, [
            {
                entityTypeName: 'block',
                entityId: 'block-1',
                amount: GARDEN_BOX_BLOCK_STACK_SIZE + 1,
            },
        ]),
        /najviše 10 blokova iste vrste/u,
    );

    await assert.rejects(
        setGardenBoxInventory(accountId, gardenId, boxId, [
            { entityTypeName: 'plantSort', entityId: '101', amount: 1 },
        ]),
        /samo blokove/u,
    );
});

test('addGardenBoxInventoryItem rejects a seventh stack or an eleventh block in one stack', async () => {
    createTestDb();

    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const boxId = await createGardenBlock(gardenId, 'GardenBox');

    await setGardenBoxInventory(
        accountId,
        gardenId,
        boxId,
        Array.from({ length: GARDEN_BOX_BLOCK_STACK_LIMIT }, (_, index) => ({
            entityTypeName: 'block',
            entityId: `block-${index.toString()}`,
            amount: index === 0 ? GARDEN_BOX_BLOCK_STACK_SIZE : 1,
        })),
    );

    await assert.rejects(
        addGardenBoxInventoryItem(accountId, gardenId, boxId, {
            entityTypeName: 'block',
            entityId: 'new-block',
            amount: 1,
        }),
        /najviše 6 različitih blokova/u,
    );

    await assert.rejects(
        addGardenBoxInventoryItem(accountId, gardenId, boxId, {
            entityTypeName: 'block',
            entityId: 'block-0',
            amount: 1,
        }),
        /najviše 10 blokova iste vrste/u,
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
