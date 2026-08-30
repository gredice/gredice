import assert from 'node:assert/strict';
import test from 'node:test';
import type { BlockData } from '@gredice/directory-types';
import {
    addGardenBoxInventoryItem,
    createAccount,
    createGardenBlock,
    createGardenStack,
    deleteGardenBlock,
    type GardenPlacementTransaction,
    getAllEvents,
    getGardenBlockForUpdate,
    getGardenBlocks,
    getGardenBoxInventory,
    getGardenMutationAuthorityForUpdate,
    getGardenMutationOperationReceipt,
    getGardenPlacementSnapshotForUpdate,
    getGardenStackForUpdate,
    getGardenStacks,
    knownEventTypes,
    listGardenStructures,
    softDeleteGardenOnce,
    updateGardenStack,
    withGardenBoxInventoryTransaction,
    withGardenMutationOperation,
    withGardenPlacementTransaction,
} from '@gredice/storage';
import {
    createTestGarden,
    ensureFarmId,
} from '../../../../packages/storage/tests/helpers/testHelpers';
import {
    createGardenBoxBlockStorageService,
    type GardenBoxBlockStorageDependencies,
    getGardenBoxBlockStorageOperationId,
} from './gardenBoxBlockStorageService';
import { validatePersistedStructuresAfterBlockMutation } from './gardenOccupancyService';

const storageIntegrationEnabled =
    process.env.TEST_ENV === '1' && Boolean(process.env.POSTGRES_URL);
const timestamp = '2026-08-30T00:00:00.000Z';

function directoryBlock(
    id: number,
    name: string,
    options: Readonly<{ stackable: boolean; type: string }>,
): BlockData {
    return {
        id,
        entityType: { id: 8, name: 'block', label: 'Blok' },
        slug: name.toLowerCase(),
        information: {
            name,
            label: name,
            shortDescription: name,
            fullDescription: name,
        },
        attributes: {
            height: 1,
            stackable: options.stackable,
            type: options.type,
            nightOnlyPurchase: false,
        },
        prices: { sunflowers: 0 },
        functions: { raisedBed: false, recycler: false },
        createdAt: timestamp,
        updatedAt: timestamp,
    };
}

const blockData = [
    directoryBlock(1, 'Block_Grass', {
        stackable: true,
        type: 'terrain',
    }),
    directoryBlock(2, 'GardenBox', {
        stackable: false,
        type: 'decoration',
    }),
    directoryBlock(101, 'Shade', {
        stackable: false,
        type: 'decoration',
    }),
];

function integrationService({
    failAfterInventoryAdd = false,
}: Readonly<{ failAfterInventoryAdd?: boolean }> = {}) {
    const dependencies: GardenBoxBlockStorageDependencies<GardenPlacementTransaction> =
        {
            addGardenBoxInventoryItem: async (
                accountId,
                gardenId,
                gardenBoxBlockId,
                payload,
                transaction,
            ) => {
                await addGardenBoxInventoryItem(
                    accountId,
                    gardenId,
                    gardenBoxBlockId,
                    payload,
                    transaction,
                );
                if (failAfterInventoryAdd) {
                    throw new Error(
                        'Injected failure after real inventory add',
                    );
                }
            },
            deleteGardenBlock,
            getBlockData: async () => blockData,
            getGardenBlockForUpdate,
            getGardenMutationAuthorityForUpdate,
            getGardenMutationOperationReceipt,
            getGardenPlacementSnapshotForUpdate,
            getGardenStackForUpdate,
            listGardenStructures,
            updateGardenStack,
            validatePersistedStructuresAfterBlockMutation,
            withGardenBoxInventoryTransaction: (
                accountId,
                gardenId,
                gardenBoxBlockId,
                callback,
            ) =>
                withGardenBoxInventoryTransaction(
                    accountId,
                    gardenId,
                    gardenBoxBlockId,
                    callback,
                ),
            withGardenMutationOperation: (input, callback, transaction) =>
                withGardenMutationOperation(input, callback, transaction),
            withGardenPlacementTransaction,
        };
    return createGardenBoxBlockStorageService(dependencies);
}

async function fixture() {
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const sourceGroundBlockId = await createGardenBlock(
        gardenId,
        'Block_Grass',
    );
    const sourceBlockId = await createGardenBlock(gardenId, 'Shade');
    const boxGroundBlockId = await createGardenBlock(gardenId, 'Block_Grass');
    const gardenBoxBlockId = await createGardenBlock(gardenId, 'GardenBox');
    await createGardenStack(gardenId, { x: 0, y: 0 });
    await updateGardenStack(gardenId, {
        blocks: [sourceGroundBlockId, sourceBlockId],
        x: 0,
        y: 0,
    });
    await createGardenStack(gardenId, { x: 2, y: 0 });
    await updateGardenStack(gardenId, {
        blocks: [boxGroundBlockId, gardenBoxBlockId],
        x: 2,
        y: 0,
    });
    return {
        accountId,
        boxGroundBlockId,
        gardenBoxBlockId,
        gardenId,
        sourceBlockId,
        sourceGroundBlockId,
    };
}

function commandFromFixture(fixtureData: Awaited<ReturnType<typeof fixture>>) {
    return {
        accountId: fixtureData.accountId,
        blockId: fixtureData.sourceBlockId,
        blockIndex: 1,
        gardenBoxBlockId: fixtureData.gardenBoxBlockId,
        gardenId: fixtureData.gardenId,
        sourcePosition: { x: 0, z: 0 },
    } as const;
}

function inventoryAggregateId(
    fixtureData: Awaited<ReturnType<typeof fixture>>,
) {
    return `inventory:${fixtureData.accountId}:gardenBox:${fixtureData.gardenId.toString()}:${fixtureData.gardenBoxBlockId}`;
}

async function inventoryAddEvents(
    fixtureData: Awaited<ReturnType<typeof fixture>>,
) {
    return getAllEvents(knownEventTypes.inventory.add, [
        inventoryAggregateId(fixtureData),
    ]);
}

function inventorySummary(
    items: readonly Readonly<{
        amount: number;
        entityId: string;
        entityTypeName: string;
    }>[],
) {
    return items.map(({ amount, entityId, entityTypeName }) => ({
        amount,
        entityId,
        entityTypeName,
    }));
}

test('real GardenBox store commits one deletion, inventory event, and receipt and replays without the active source', {
    skip: !storageIntegrationEnabled,
}, async () => {
    const fixtureData = await fixture();
    const command = commandFromFixture(fixtureData);
    const service = integrationService();

    const first = await service(command);
    assert.equal(first.ok, true);
    if (!first.ok) throw new Error('Expected GardenBox store to succeed');
    assert.equal(first.replayed, false);
    assert.deepEqual(
        inventorySummary(
            await getGardenBoxInventory(
                fixtureData.accountId,
                fixtureData.gardenId,
                fixtureData.gardenBoxBlockId,
            ),
        ),
        [{ amount: 1, entityId: '101', entityTypeName: 'block' }],
    );
    const committedInventoryEvents = await inventoryAddEvents(fixtureData);
    assert.equal(committedInventoryEvents.length, 1);
    assert.deepEqual(committedInventoryEvents[0]?.data, {
        amount: 1,
        entityId: '101',
        entityTypeName: 'block',
        source: `gardenBox:store:${getGardenBoxBlockStorageOperationId(fixtureData.sourceBlockId)}`,
    });
    assert.deepEqual(
        (await getGardenStacks(fixtureData.gardenId)).find(
            (stack) => stack.positionX === 0 && stack.positionY === 0,
        )?.blocks,
        [fixtureData.sourceGroundBlockId],
    );

    await withGardenPlacementTransaction(fixtureData.gardenId, (transaction) =>
        softDeleteGardenOnce(fixtureData.gardenId, transaction),
    );
    assert.deepEqual(await service(command), { ...first, replayed: true });
    assert.equal((await inventoryAddEvents(fixtureData)).length, 1);
    assert.equal((await getGardenBlocks(fixtureData.gardenId)).length, 3);
    assert.deepEqual(
        (
            await getGardenMutationOperationReceipt({
                gardenId: fixtureData.gardenId,
                operationId: getGardenBoxBlockStorageOperationId(
                    fixtureData.sourceBlockId,
                ),
            })
        )?.response,
        {
            gardenBoxBlockId: fixtureData.gardenBoxBlockId,
            item: { amount: 1, entityId: '101', entityTypeName: 'block' },
        },
    );
});

test('real GardenBox store rolls source deletion, stack, inventory event, and receipt back together', {
    skip: !storageIntegrationEnabled,
}, async () => {
    const fixtureData = await fixture();
    const command = commandFromFixture(fixtureData);
    const beforeBlocks = await getGardenBlocks(fixtureData.gardenId);
    const beforeStacks = await getGardenStacks(fixtureData.gardenId);

    await assert.rejects(
        integrationService({ failAfterInventoryAdd: true })(command),
        /Injected failure after real inventory add/u,
    );

    assert.deepEqual(await getGardenBlocks(fixtureData.gardenId), beforeBlocks);
    assert.deepEqual(await getGardenStacks(fixtureData.gardenId), beforeStacks);
    assert.deepEqual(
        await getGardenBoxInventory(
            fixtureData.accountId,
            fixtureData.gardenId,
            fixtureData.gardenBoxBlockId,
        ),
        [],
    );
    assert.deepEqual(await inventoryAddEvents(fixtureData), []);
    assert.equal(
        await getGardenMutationOperationReceipt({
            gardenId: fixtureData.gardenId,
            operationId: getGardenBoxBlockStorageOperationId(
                fixtureData.sourceBlockId,
            ),
        }),
        null,
    );
});

test('real GardenBox store rejects changed source payload without another inventory effect', {
    skip: !storageIntegrationEnabled,
}, async () => {
    const fixtureData = await fixture();
    const command = commandFromFixture(fixtureData);
    const service = integrationService();
    assert.equal((await service(command)).ok, true);

    assert.deepEqual(
        await service({
            ...command,
            sourcePosition: { x: 1, z: 0 },
        }),
        {
            ok: false,
            code: 'OPERATION_CONFLICT',
            error: 'Garden mutation operation ID was reused with different input.',
            status: 409,
        },
    );
    assert.equal((await inventoryAddEvents(fixtureData)).length, 1);
    assert.equal((await getGardenBlocks(fixtureData.gardenId)).length, 3);
});
