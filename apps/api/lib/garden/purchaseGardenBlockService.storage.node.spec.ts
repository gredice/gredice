import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import type { BlockData } from '@gredice/directory-types';
import {
    createAccount,
    createGardenBlock,
    createGardenStack,
    createRaisedBedInTransaction,
    earnSunflowersOnce,
    type GardenPlacementTransaction,
    getGarden,
    getGardenBlocks,
    getGardenMutationAuthorityForUpdate,
    getGardenMutationOperationReceipt,
    getGardenPlacementSnapshotForUpdate,
    getSunflowers,
    listGardenStructures,
    softDeleteGardenOnce,
    spendSunflowersBatch,
    updateGardenStack,
    withAccountDeletionFenceTransaction,
    withGardenMutationOperation,
    withGardenPlacementTransaction,
    withSunflowerAccountTransaction,
} from '@gredice/storage';
import {
    createTestGarden,
    ensureFarmId,
} from '../../../../packages/storage/tests/helpers/testHelpers';
import { resolveGardenBlockPlacement } from './blockPlacementService';
import {
    createGardenOccupancyIndexFromStorageSnapshot,
    validatePersistedStructuresAfterBlockMutation,
} from './gardenOccupancyService';
import {
    createPurchaseGardenBlockService,
    type PurchaseGardenBlockDependencies,
} from './purchaseGardenBlockService';

const storageIntegrationEnabled =
    process.env.TEST_ENV === '1' && Boolean(process.env.POSTGRES_URL);
const timestamp = '2026-08-30T00:00:00.000Z';

function directoryBlock(id: number, name: string, price: number): BlockData {
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
            stackable: name === 'Block_Grass',
            type: name === 'Block_Grass' ? 'terrain' : 'decoration',
            nightOnlyPurchase: false,
        },
        prices: { sunflowers: price },
        functions: { raisedBed: name === 'Raised_Bed', recycler: false },
        createdAt: timestamp,
        updatedAt: timestamp,
    };
}

const blockData = [
    directoryBlock(1, 'Block_Grass', 0),
    directoryBlock(2, 'Raised_Bed', 75),
];

function integrationService(controls: { failAfterDebit: boolean }) {
    const dependencies: PurchaseGardenBlockDependencies<GardenPlacementTransaction> =
        {
            bustScheduleCache: async () => {},
            createAppearanceVariant: () => undefined,
            createGardenBlock: (gardenId, blockName, variant, transaction) =>
                createGardenBlock(gardenId, blockName, variant, transaction),
            createGardenOccupancyIndexFromStorageSnapshot,
            createGardenStack,
            createRaisedBedInTransaction: (input, transaction) =>
                createRaisedBedInTransaction(input, transaction),
            debitSunflowers: async (accountId, amount, reason, transaction) => {
                await spendSunflowersBatch(
                    accountId,
                    [{ amount, reason }],
                    transaction,
                );
                if (controls.failAfterDebit) {
                    throw new Error('Injected failure after real debit');
                }
            },
            getBlockData: async () => blockData,
            getGardenLocation: async () => null,
            getGardenMutationAuthorityForUpdate,
            getGardenPlacementSnapshotForUpdate,
            isBlockPurchaseAvailableNow: () => true,
            listGardenStructures,
            now: () => new Date('2026-08-30T23:00:00.000Z'),
            random: () => 0.25,
            resolveGardenBlockPlacement,
            updateGardenStack,
            validatePersistedStructuresAfterBlockMutation,
            withAccountDeletionFenceTransaction,
            withGardenMutationOperation: (input, callback, transaction) =>
                withGardenMutationOperation(input, callback, transaction),
            withGardenPlacementTransaction,
            withSunflowerAccountTransaction: (accountId, callback) =>
                withSunflowerAccountTransaction(accountId, callback),
        };
    return createPurchaseGardenBlockService(dependencies);
}

async function fixture() {
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const groundId = await createGardenBlock(gardenId, 'Block_Grass');
    await createGardenStack(gardenId, { x: 0, y: 0 });
    await updateGardenStack(gardenId, {
        blocks: [groundId],
        x: 0,
        y: 0,
    });
    await earnSunflowersOnce(
        accountId,
        500,
        `test:block-purchase:${randomUUID()}`,
    );
    return { accountId, gardenId, groundId };
}

test('real purchase transaction persists one raised bed and replays without a second debit', {
    skip: !storageIntegrationEnabled,
}, async () => {
    const { accountId, gardenId, groundId } = await fixture();
    const operationId = randomUUID();
    const service = integrationService({ failAfterDebit: false });
    const beforeBalance = await getSunflowers(accountId);
    const command = {
        accountId,
        blockName: 'Raised_Bed',
        expectedExistingBlocks: [groundId],
        gardenId,
        operationId,
        position: { x: 0, y: 0 },
    } as const;

    const first = await service(command);
    assert.equal(first.ok, true);
    assert.equal((await getGarden(gardenId))?.raisedBeds.length, 1);
    await withGardenPlacementTransaction(gardenId, (transaction) =>
        softDeleteGardenOnce(gardenId, transaction),
    );
    const replay = await service(command);

    assert.equal(replay.ok && replay.replayed, true);
    assert.equal(await getSunflowers(accountId), beforeBalance - 75);
    assert.equal((await getGardenBlocks(gardenId)).length, 2);
    assert.ok(
        await getGardenMutationOperationReceipt({
            gardenId,
            operationId,
        }),
    );
});

test('real purchase transaction rolls block, stack, raised bed, debit, and receipt back together', {
    skip: !storageIntegrationEnabled,
}, async () => {
    const { accountId, gardenId, groundId } = await fixture();
    const operationId = randomUUID();
    const service = integrationService({ failAfterDebit: true });
    const beforeBalance = await getSunflowers(accountId);

    const result = await service({
        accountId,
        blockName: 'Raised_Bed',
        expectedExistingBlocks: [groundId],
        gardenId,
        operationId,
        position: { x: 0, y: 0 },
    });

    assert.equal(!result.ok && result.code, 'OPERATION_FAILED');
    assert.equal(await getSunflowers(accountId), beforeBalance);
    assert.deepEqual(
        (await getGardenBlocks(gardenId)).map((block) => block.id),
        [groundId],
    );
    assert.equal((await getGarden(gardenId))?.raisedBeds.length, 0);
    assert.equal(
        await getGardenMutationOperationReceipt({
            gardenId,
            operationId,
        }),
        null,
    );
});
