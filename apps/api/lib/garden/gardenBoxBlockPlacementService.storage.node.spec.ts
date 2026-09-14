import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import type { BlockData } from '@gredice/directory-types';
import {
    addGardenBoxInventoryItem,
    consumeGardenBoxInventoryItem,
    createAccount,
    createGardenBlock,
    createGardenStack,
    type GardenPlacementTransaction,
    getAllEvents,
    getGardenBlockForUpdate,
    getGardenBlocks,
    getGardenBoxInventory,
    getGardenMutationAuthorityForUpdate,
    getGardenMutationOperationReceipt,
    getGardenPlacementSnapshotForUpdate,
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
import { resolveGardenBlockPlacement } from './blockPlacementService';
import {
    createGardenBoxBlockPlacementService,
    type GardenBoxBlockPlacementDependencies,
} from './gardenBoxBlockPlacementService';
import {
    createGardenOccupancyIndexFromStorageSnapshot,
    validatePersistedStructuresAfterBlockMutation,
} from './gardenOccupancyService';

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
    failAfterConsume = false,
}: Readonly<{ failAfterConsume?: boolean }> = {}) {
    const dependencies: GardenBoxBlockPlacementDependencies<GardenPlacementTransaction> =
        {
            consumeGardenBoxInventoryItem: async (
                accountId,
                gardenId,
                gardenBoxBlockId,
                payload,
                transaction,
            ) => {
                await consumeGardenBoxInventoryItem(
                    accountId,
                    gardenId,
                    gardenBoxBlockId,
                    payload,
                    transaction,
                );
                if (failAfterConsume) {
                    throw new Error('Injected failure after real consumption');
                }
            },
            createGardenBlock: (gardenId, blockName, transaction) =>
                createGardenBlock(gardenId, blockName, transaction),
            createGardenOccupancyIndexFromStorageSnapshot,
            createGardenStack,
            getBlockData: async () => blockData,
            getGardenBlockForUpdate,
            getGardenMutationAuthorityForUpdate,
            getGardenPlacementSnapshotForUpdate,
            listGardenStructures,
            resolveGardenBlockPlacement,
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
    return createGardenBoxBlockPlacementService(dependencies);
}

async function fixture() {
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const targetGroundBlockId = await createGardenBlock(
        gardenId,
        'Block_Grass',
    );
    const boxGroundBlockId = await createGardenBlock(gardenId, 'Block_Grass');
    const gardenBoxBlockId = await createGardenBlock(gardenId, 'GardenBox');
    await createGardenStack(gardenId, { x: 0, y: 0 });
    await updateGardenStack(gardenId, {
        blocks: [targetGroundBlockId],
        x: 0,
        y: 0,
    });
    await createGardenStack(gardenId, { x: 2, y: 0 });
    await updateGardenStack(gardenId, {
        blocks: [boxGroundBlockId, gardenBoxBlockId],
        x: 2,
        y: 0,
    });
    await addGardenBoxInventoryItem(accountId, gardenId, gardenBoxBlockId, {
        amount: 1,
        entityId: '101',
        entityTypeName: 'block',
        source: `test:garden-box-place:${randomUUID()}`,
    });
    return {
        accountId,
        boxGroundBlockId,
        gardenBoxBlockId,
        gardenId,
        targetGroundBlockId,
    };
}

function commandFromFixture(
    fixtureData: Awaited<ReturnType<typeof fixture>>,
    operationId = randomUUID(),
) {
    return {
        accountId: fixtureData.accountId,
        entityId: '101',
        gardenBoxBlockId: fixtureData.gardenBoxBlockId,
        gardenId: fixtureData.gardenId,
        operationId,
    } as const;
}

function inventoryAggregateId(
    fixtureData: Awaited<ReturnType<typeof fixture>>,
) {
    return `inventory:${fixtureData.accountId}:gardenBox:${fixtureData.gardenId.toString()}:${fixtureData.gardenBoxBlockId}`;
}

async function consumptionEvents(
    fixtureData: Awaited<ReturnType<typeof fixture>>,
) {
    return getAllEvents(knownEventTypes.inventory.consume, [
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

test('real GardenBox placement commits one receipt, placement, and consumption and replays after soft deletion', {
    skip: !storageIntegrationEnabled,
}, async () => {
    const fixtureData = await fixture();
    const command = commandFromFixture(fixtureData);
    const service = integrationService();

    const first = await service(command);
    assert.equal(first.ok, true);
    if (!first.ok) {
        throw new Error('Expected GardenBox placement to succeed');
    }
    assert.equal(first.replayed, false);
    assert.deepEqual(
        await getGardenBoxInventory(
            fixtureData.accountId,
            fixtureData.gardenId,
            fixtureData.gardenBoxBlockId,
        ),
        [],
    );
    const committedConsumptionEvents = await consumptionEvents(fixtureData);
    assert.equal(committedConsumptionEvents.length, 1);
    assert.deepEqual(committedConsumptionEvents[0]?.data, {
        amount: 1,
        entityId: '101',
        entityTypeName: 'block',
        source: 'gardenBox:place',
    });
    assert.equal(
        (await getGardenStacks(fixtureData.gardenId)).filter((stack) =>
            stack.blocks.includes(first.blockId),
        ).length,
        1,
    );

    await withGardenPlacementTransaction(fixtureData.gardenId, (transaction) =>
        softDeleteGardenOnce(fixtureData.gardenId, transaction),
    );
    const replay = await service(command);

    assert.deepEqual(replay, { ...first, replayed: true });
    assert.equal((await consumptionEvents(fixtureData)).length, 1);
    assert.equal((await getGardenBlocks(fixtureData.gardenId)).length, 4);
    assert.deepEqual(
        (
            await getGardenMutationOperationReceipt({
                gardenId: fixtureData.gardenId,
                operationId: command.operationId,
            })
        )?.response,
        {
            blockId: first.blockId,
            item: first.item,
            position: first.position,
        },
    );
});

test('real GardenBox placement rolls placement, consumption event, and receipt back together', {
    skip: !storageIntegrationEnabled,
}, async () => {
    const fixtureData = await fixture();
    const command = commandFromFixture(fixtureData);
    const beforeBlocks = await getGardenBlocks(fixtureData.gardenId);
    const beforeStacks = await getGardenStacks(fixtureData.gardenId);

    await assert.rejects(
        integrationService({ failAfterConsume: true })(command),
        /Injected failure after real consumption/u,
    );

    assert.deepEqual(
        inventorySummary(
            await getGardenBoxInventory(
                fixtureData.accountId,
                fixtureData.gardenId,
                fixtureData.gardenBoxBlockId,
            ),
        ),
        [
            {
                amount: 1,
                entityId: '101',
                entityTypeName: 'block',
            },
        ],
    );
    assert.deepEqual(await consumptionEvents(fixtureData), []);
    assert.deepEqual(await getGardenBlocks(fixtureData.gardenId), beforeBlocks);
    assert.deepEqual(await getGardenStacks(fixtureData.gardenId), beforeStacks);
    assert.equal(
        await getGardenMutationOperationReceipt({
            gardenId: fixtureData.gardenId,
            operationId: command.operationId,
        }),
        null,
    );
});

test('real GardenBox placement rejects operation payload reuse without another effect', {
    skip: !storageIntegrationEnabled,
}, async () => {
    const fixtureData = await fixture();
    const command = commandFromFixture(fixtureData);
    const service = integrationService();
    assert.equal((await service(command)).ok, true);

    assert.deepEqual(await service({ ...command, entityId: '102' }), {
        ok: false,
        code: 'OPERATION_CONFLICT',
        error: 'Garden mutation operation ID was reused with different input.',
        status: 409,
    });
    assert.equal((await consumptionEvents(fixtureData)).length, 1);
    assert.equal((await getGardenBlocks(fixtureData.gardenId)).length, 4);
});
