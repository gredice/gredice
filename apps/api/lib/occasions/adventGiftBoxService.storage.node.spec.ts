import assert from 'node:assert/strict';
import test from 'node:test';
import type { BlockData } from '@gredice/directory-types';
import {
    addInventoryItem,
    createAccount,
    createGardenBlock,
    createGardenStack,
    createSandboxGarden,
    deleteGardenStack,
    type GardenPlacementTransaction,
    getAllEvents,
    getGardenBlocks,
    getGardenMutationAuthorityForUpdate,
    getGardenMutationOperationReceipt,
    getGardenPlacementSnapshotForUpdate,
    getGardenStacks,
    getInventory,
    knownEventTypes,
    listGardenStructuresForUpdate,
    softDeleteGardenBlockOnce,
    softDeleteGardenOnce,
    updateGardenStack,
    withAccountDeletionFenceTransaction,
    withGardenMutationOperation,
    withGardenPlacementTransaction,
    withInventoryAccountTransaction,
} from '@gredice/storage';
import {
    createTestGarden,
    ensureFarmId,
} from '../../../../packages/storage/tests/helpers/testHelpers';
import { validatePersistedStructuresAfterBlockMutation } from '../garden/gardenOccupancyService';
import {
    type AdventGiftBoxDependencies,
    createAdventGiftBoxService,
    type GiftBoxReward,
    getAdventGiftBoxOperationId,
} from './adventGiftBoxService';

const storageIntegrationEnabled =
    process.env.TEST_ENV === '1' && Boolean(process.env.POSTGRES_URL);
const timestamp = '2026-08-30T00:00:00.000Z';
const reward: GiftBoxReward = {
    kind: 'plant',
    entityTypeName: 'plantSort',
    entityId: '42',
    title: 'Rajčica',
};

function directoryBlock(id: number, name: string): BlockData {
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
            stackable: true,
            type: 'terrain',
            nightOnlyPurchase: false,
        },
        prices: { sunflowers: 0 },
        functions: { raisedBed: false, recycler: false },
        createdAt: timestamp,
        updatedAt: timestamp,
    };
}

const blockData = [directoryBlock(1, 'Block_Grass')];

function integrationService({
    failAfterBlockDelete = false,
}: Readonly<{ failAfterBlockDelete?: boolean }> = {}) {
    const dependencies: AdventGiftBoxDependencies<GardenPlacementTransaction> =
        {
            addInventoryItem,
            deleteGardenStack,
            getGardenMutationAuthorityForUpdate,
            getGardenPlacementSnapshotForUpdate,
            getBlockData: async () => blockData,
            isAdventSeasonOver: () => true,
            listGardenStructuresForUpdate,
            loadGiftBoxRewardCatalog: async () => ({
                operations: [],
                plants: [{ entityId: reward.entityId, title: reward.title }],
            }),
            pickGiftBoxReward: async () => reward,
            softDeleteGardenBlockOnce: async (
                gardenId,
                blockId,
                transaction,
            ) => {
                const result = await softDeleteGardenBlockOnce(
                    gardenId,
                    blockId,
                    transaction,
                );
                if (failAfterBlockDelete) {
                    throw new Error(
                        'Injected failure after real block deletion',
                    );
                }
                return result;
            },
            updateGardenStack,
            validatePersistedStructuresAfterBlockMutation,
            withAccountDeletionFenceTransaction,
            withGardenMutationOperation: (input, callback, transaction) =>
                withGardenMutationOperation(input, callback, transaction),
            withGardenPlacementTransaction,
            withInventoryAccountTransaction,
        };
    return createAdventGiftBoxService(dependencies);
}

async function fixture() {
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const groundBlockId = await createGardenBlock(gardenId, 'Block_Grass');
    const giftBlockId = await createGardenBlock(gardenId, 'GiftBox_RedWhite');
    await createGardenStack(gardenId, { x: 2, y: -3 });
    await updateGardenStack(gardenId, {
        blocks: [groundBlockId, giftBlockId],
        x: 2,
        y: -3,
    });
    return { accountId, gardenId, giftBlockId, groundBlockId };
}

function commandFromFixture(fixtureData: Awaited<ReturnType<typeof fixture>>) {
    return {
        accountId: fixtureData.accountId,
        blockId: fixtureData.giftBlockId,
        gardenId: fixtureData.gardenId,
        timeZone: 'Europe/Zagreb',
    } as const;
}

async function inventoryAddedEvents(accountId: string) {
    return getAllEvents(knownEventTypes.inventory.add, [
        `inventory:${accountId}`,
    ]);
}

test('real gift transaction commits one inventory event, block/stack mutation, and replayable receipt', {
    skip: !storageIntegrationEnabled,
}, async () => {
    const fixtureData = await fixture();
    const command = commandFromFixture(fixtureData);
    const service = integrationService();

    assert.deepEqual(await service(command), {
        ok: true,
        replayed: false,
        reward,
    });
    await withGardenPlacementTransaction(fixtureData.gardenId, (transaction) =>
        softDeleteGardenOnce(fixtureData.gardenId, transaction),
    );
    assert.deepEqual(await service(command), {
        ok: true,
        replayed: true,
        reward,
    });

    assert.deepEqual(
        (await getInventory(fixtureData.accountId)).map((item) => ({
            amount: item.amount,
            entityId: item.entityId,
            entityTypeName: item.entityTypeName,
        })),
        [{ amount: 1, entityId: '42', entityTypeName: 'plantSort' }],
    );
    const inventoryEvents = await inventoryAddedEvents(fixtureData.accountId);
    assert.equal(inventoryEvents.length, 1);
    assert.deepEqual(inventoryEvents[0]?.data, {
        amount: 1,
        entityId: '42',
        entityTypeName: 'plantSort',
        source: `advent-gift-box:${fixtureData.gardenId.toString()}:${fixtureData.giftBlockId}`,
    });
    assert.deepEqual(
        (await getGardenBlocks(fixtureData.gardenId)).map((block) => block.id),
        [fixtureData.groundBlockId],
    );
    assert.deepEqual(
        (await getGardenStacks(fixtureData.gardenId)).map((stack) => ({
            blocks: stack.blocks,
            x: stack.positionX,
            y: stack.positionY,
        })),
        [
            {
                blocks: [fixtureData.groundBlockId],
                x: 2,
                y: -3,
            },
        ],
    );
    assert.deepEqual(
        (
            await getGardenMutationOperationReceipt({
                gardenId: fixtureData.gardenId,
                operationId: getAdventGiftBoxOperationId(
                    fixtureData.giftBlockId,
                ),
            })
        )?.response,
        { reward },
    );
});

test('sandbox gift boxes cannot mint real account inventory or a receipt', {
    skip: !storageIntegrationEnabled,
}, async () => {
    const accountId = await createAccount();
    await ensureFarmId();
    const gardenId = await createSandboxGarden({ accountId });
    const groundBlockId = await createGardenBlock(gardenId, 'Block_Grass');
    const giftBlockId = await createGardenBlock(gardenId, 'GiftBox_RedWhite');
    await createGardenStack(gardenId, { x: 4, y: -2 });
    await updateGardenStack(gardenId, {
        blocks: [groundBlockId, giftBlockId],
        x: 4,
        y: -2,
    });

    assert.deepEqual(
        await integrationService()({
            accountId,
            blockId: giftBlockId,
            gardenId,
            timeZone: 'Europe/Zagreb',
        }),
        {
            ok: false,
            code: 'SANDBOX_GIFT_UNAVAILABLE',
            error: 'Poklon kutije nisu dostupne u probnom vrtu.',
            status: 400,
        },
    );
    assert.deepEqual(await getInventory(accountId), []);
    assert.deepEqual(await inventoryAddedEvents(accountId), []);
    assert.deepEqual(
        (await getGardenBlocks(gardenId)).map((block) => block.id),
        [groundBlockId, giftBlockId],
    );
    assert.deepEqual(
        (await getGardenStacks(gardenId)).map((stack) => stack.blocks),
        [[groundBlockId, giftBlockId]],
    );
    assert.equal(
        await getGardenMutationOperationReceipt({
            gardenId,
            operationId: getAdventGiftBoxOperationId(giftBlockId),
        }),
        null,
    );
});

test('real gift transaction rolls inventory, block, stack, and receipt back together', {
    skip: !storageIntegrationEnabled,
}, async () => {
    const fixtureData = await fixture();
    const command = commandFromFixture(fixtureData);

    await assert.rejects(
        integrationService({ failAfterBlockDelete: true })(command),
        /Injected failure after real block deletion/u,
    );

    assert.deepEqual(await getInventory(fixtureData.accountId), []);
    assert.deepEqual(await inventoryAddedEvents(fixtureData.accountId), []);
    assert.deepEqual(
        (await getGardenBlocks(fixtureData.gardenId)).map((block) => block.id),
        [fixtureData.groundBlockId, fixtureData.giftBlockId],
    );
    assert.deepEqual(
        (await getGardenStacks(fixtureData.gardenId)).map(
            (stack) => stack.blocks,
        ),
        [[fixtureData.groundBlockId, fixtureData.giftBlockId]],
    );
    assert.equal(
        await getGardenMutationOperationReceipt({
            gardenId: fixtureData.gardenId,
            operationId: getAdventGiftBoxOperationId(fixtureData.giftBlockId),
        }),
        null,
    );
});

test('real gift transaction rejects a conflicting durable payload without effects', {
    skip: !storageIntegrationEnabled,
}, async () => {
    const fixtureData = await fixture();
    const command = commandFromFixture(fixtureData);
    const operationId = getAdventGiftBoxOperationId(fixtureData.giftBlockId);
    await withGardenMutationOperation(
        {
            gardenId: fixtureData.gardenId,
            kind: 'gift-open',
            operationId,
            payload: {
                accountId: fixtureData.accountId,
                blockId: `${fixtureData.giftBlockId}-conflict`,
            },
        },
        async () => ({ response: { reward } }),
    );

    assert.deepEqual(await integrationService()(command), {
        ok: false,
        code: 'OPERATION_CONFLICT',
        error: 'Identitet otvaranja već je korišten za drugi zahtjev.',
        status: 409,
    });
    assert.deepEqual(await getInventory(fixtureData.accountId), []);
    assert.deepEqual(await inventoryAddedEvents(fixtureData.accountId), []);
    assert.deepEqual(
        (await getGardenBlocks(fixtureData.gardenId)).map((block) => block.id),
        [fixtureData.groundBlockId, fixtureData.giftBlockId],
    );
    assert.deepEqual(
        (await getGardenStacks(fixtureData.gardenId)).map(
            (stack) => stack.blocks,
        ),
        [[fixtureData.groundBlockId, fixtureData.giftBlockId]],
    );
});
