import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import type { BlockData } from '@gredice/directory-types';
import {
    addGardenBoxInventoryItem,
    closeStorage,
    consumeGardenBoxInventoryItem,
    createAccount,
    createDefaultGardenForAccount,
    createGardenBlock,
    createGardenStack,
    createRaisedBedInTransaction,
    createSandboxGarden,
    deleteGardenBlock,
    earnSunflowersOnce,
    type GardenPlacementTransaction,
    getGardenBlock,
    getGardenBlockForUpdate,
    getGardenBlocks,
    getGardenBoxBlockUnitPaidSunflowers,
    getGardenMutationAuthorityForUpdate,
    getGardenMutationOperationReceipt,
    getGardenPlacementSnapshotForUpdate,
    getGardenStackForUpdate,
    getGardenStacks,
    getLegacyGardenBlockPaidSunflowers,
    getSunflowers,
    listGardenRaisedBedMetadataForUpdate,
    softDeleteGardenBlockOnce,
    softDeleteNewRaisedBedOnce,
    spendSunflowers,
    spendSunflowersBatch,
    updateGardenBlock,
    updateGardenStack,
    updateRaisedBedOrientation,
    withAccountDeletionFenceTransaction,
    withGardenBoxInventoryTransaction,
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
    createGardenBlockMutationService,
    validateRotatedBlockPlacementUnavailable,
} from './gardenBlockMutationService';
import { createGardenBoxBlockPlacementService } from './gardenBoxBlockPlacementService';
import { createGardenBoxBlockStorageService } from './gardenBoxBlockStorageService';
import { planGardenStacksPatch } from './gardenStacksPatchPlanner';
import { createGardenStacksPatchService } from './gardenStacksPatchService';
import { createPurchaseGardenBlockService } from './purchaseGardenBlockService';

const storageIntegrationEnabled =
    process.env.TEST_ENV === '1' && Boolean(process.env.POSTGRES_URL);
const timestamp = '2026-11-26T00:00:00.000Z';

after(async () => {
    if (storageIntegrationEnabled) await closeStorage();
});

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

/** A directory whose Shade price can change between purchase and refund. */
function priceBoard(initialShadePrice: number) {
    let shadePrice = initialShadePrice;
    return {
        blockData: async () => [
            directoryBlock(1, 'Block_Grass', 5),
            directoryBlock(2, 'Raised_Bed', 75),
            directoryBlock(3, 'Shade', shadePrice),
            directoryBlock(4, 'GardenBox', 0),
        ],
        setShadePrice: (price: number) => {
            shadePrice = price;
        },
    };
}

type PriceBoard = ReturnType<typeof priceBoard>;

function purchaseService(
    board: PriceBoard,
    { recordPaidPrice = true }: Readonly<{ recordPaidPrice?: boolean }> = {},
) {
    return createPurchaseGardenBlockService<GardenPlacementTransaction>({
        bustScheduleCache: async () => {},
        createAppearanceVariant: () => undefined,
        createGardenBlock: (
            gardenId,
            blockName,
            variant,
            transaction,
            paidSunflowers,
        ) =>
            createGardenBlock(gardenId, blockName, variant, transaction, {
                // Without it this behaves like a purchase made before prices were stored.
                paidSunflowers: recordPaidPrice ? paidSunflowers : null,
            }),
        createGardenStack,
        createRaisedBedInTransaction: (input, transaction) =>
            createRaisedBedInTransaction(input, transaction),
        debitSunflowers: async (accountId, amount, reason, transaction) => {
            await spendSunflowersBatch(
                accountId,
                [{ amount, reason }],
                transaction,
            );
        },
        getBlockData: board.blockData,
        getGardenLocation: async () => null,
        getGardenMutationAuthorityForUpdate,
        getGardenPlacementSnapshotForUpdate,
        isBlockPurchaseAvailableNow: () => true,
        now: () => new Date(timestamp),
        random: () => 0.25,
        resolveGardenBlockPlacement,
        updateGardenStack,
        withAccountDeletionFenceTransaction,
        withGardenMutationOperation: (input, callback, transaction) =>
            withGardenMutationOperation(input, callback, transaction),
        withGardenPlacementTransaction,
        withSunflowerAccountTransaction: (accountId, callback) =>
            withSunflowerAccountTransaction(accountId, callback),
    });
}

function deleteRecycler(board: PriceBoard) {
    return createGardenBlockMutationService<GardenPlacementTransaction>({
        bustScheduleCache: async () => {},
        earnSunflowersOnce,
        getBlockData: board.blockData,
        getGardenPlacementSnapshotForUpdate,
        getLegacyGardenBlockPaidSunflowers,
        listGardenRaisedBedMetadataForUpdate,
        softDeleteGardenBlockOnce,
        softDeleteNewRaisedBedOnce,
        updateGardenBlock,
        updateGardenStack,
        updateRaisedBedOrientation,
        validateRotatedBlockPlacement: validateRotatedBlockPlacementUnavailable,
        withAccountDeletionFenceTransaction,
        withGardenPlacementTransaction,
        withSunflowerAccountTransaction: (accountId, callback) =>
            withSunflowerAccountTransaction(accountId, callback),
    }).recycleGardenBlockForAccount;
}

function patchRecycler(board: PriceBoard) {
    return createGardenStacksPatchService<GardenPlacementTransaction>({
        bustScheduleCache: async () => {},
        createGardenStack,
        earnSunflowersOnce,
        getBlockData: board.blockData,
        getGardenPlacementSnapshotForUpdate,
        getLegacyGardenBlockPaidSunflowers,
        listGardenRaisedBedMetadataForUpdate,
        planGardenStacksPatch,
        softDeleteGardenBlockOnce,
        softDeleteNewRaisedBedOnce,
        updateGardenStack,
        withAccountDeletionFenceTransaction,
        withGardenPlacementTransaction,
        withSunflowerAccountTransaction: (accountId, callback) =>
            withSunflowerAccountTransaction(accountId, callback),
    });
}

function boxServices(board: PriceBoard) {
    const withBoxTransaction = <Result>(
        accountId: string,
        gardenId: number,
        gardenBoxBlockId: string,
        callback: (transaction: GardenPlacementTransaction) => Promise<Result>,
    ) =>
        withGardenBoxInventoryTransaction(
            accountId,
            gardenId,
            gardenBoxBlockId,
            callback,
        );
    return {
        place: createGardenBoxBlockPlacementService<GardenPlacementTransaction>(
            {
                consumeGardenBoxInventoryItem,
                createGardenBlock: (
                    gardenId,
                    blockName,
                    transaction,
                    paidSunflowers,
                ) =>
                    createGardenBlock(gardenId, blockName, null, transaction, {
                        paidSunflowers,
                    }),
                createGardenStack,
                getBlockData: board.blockData,
                getGardenBlockForUpdate,
                getGardenBoxBlockUnitPaidSunflowers,
                getGardenMutationAuthorityForUpdate,
                getGardenPlacementSnapshotForUpdate,
                resolveGardenBlockPlacement,
                updateGardenStack,
                withGardenBoxInventoryTransaction: withBoxTransaction,
                withGardenMutationOperation: (input, callback, transaction) =>
                    withGardenMutationOperation(input, callback, transaction),
                withGardenPlacementTransaction,
            },
        ),
        store: createGardenBoxBlockStorageService<GardenPlacementTransaction>({
            addGardenBoxInventoryItem,
            deleteGardenBlock,
            getBlockData: board.blockData,
            getGardenBlockForUpdate,
            getGardenMutationAuthorityForUpdate,
            getGardenMutationOperationReceipt,
            getGardenPlacementSnapshotForUpdate,
            getGardenStackForUpdate,
            getLegacyGardenBlockPaidSunflowers,
            updateGardenStack,
            withGardenBoxInventoryTransaction: withBoxTransaction,
            withGardenMutationOperation: (input, callback, transaction) =>
                withGardenMutationOperation(input, callback, transaction),
            withGardenPlacementTransaction,
        }),
    };
}

async function fixture(options: Readonly<{ sandbox?: boolean }> = {}) {
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = options.sandbox
        ? await createSandboxGarden({ accountId })
        : await createTestGarden({ accountId, farmId });
    const groundIds: string[] = [];
    for (const x of [0, 1]) {
        const groundId = await createGardenBlock(gardenId, 'Block_Grass');
        await createGardenStack(gardenId, { x, y: 0 });
        await updateGardenStack(gardenId, { blocks: [groundId], x, y: 0 });
        groundIds.push(groundId);
    }
    await earnSunflowersOnce(
        accountId,
        1_000,
        `test:paid-price-refund:${randomUUID()}`,
    );
    return { accountId, gardenId, groundIds };
}

async function buyShade(
    service: ReturnType<typeof purchaseService>,
    fixtureData: Awaited<ReturnType<typeof fixture>>,
    x: number,
) {
    const groundId = fixtureData.groundIds[x];
    assert.ok(groundId);
    const result = await service({
        accountId: fixtureData.accountId,
        blockName: 'Shade',
        expectedExistingBlocks: [groundId],
        gardenId: fixtureData.gardenId,
        operationId: randomUUID(),
        position: { x, y: 0 },
    });
    if (!result.ok) {
        throw new Error(`Expected the purchase to succeed: ${result.code}`);
    }
    return result.blockId;
}

test('purchase, price rise, recycle: both refund paths pay back exactly the price paid, once', {
    skip: !storageIntegrationEnabled,
}, async () => {
    const fixtureData = await fixture();
    const board = priceBoard(40);
    const buy = purchaseService(board);
    const startBalance = await getSunflowers(fixtureData.accountId);
    const deletedBlockId = await buyShade(buy, fixtureData, 0);
    const patchedBlockId = await buyShade(buy, fixtureData, 1);
    assert.equal(
        (await getGardenBlock(fixtureData.gardenId, deletedBlockId))
            ?.paidSunflowers,
        40,
    );
    assert.equal(await getSunflowers(fixtureData.accountId), startBalance - 80);

    board.setShadePrice(100);
    const recycleByDelete = deleteRecycler(board);
    const deleteCommand = {
        accountId: fixtureData.accountId,
        blockId: deletedBlockId,
        gardenId: fixtureData.gardenId,
    };
    assert.deepEqual(await recycleByDelete(deleteCommand), {
        ok: true,
        blockId: deletedBlockId,
        refundedSunflowers: 40,
    });
    const patchResult = await patchRecycler(board)({
        accountId: fixtureData.accountId,
        gardenId: fixtureData.gardenId,
        operations: [
            { op: 'test', path: '/1/0/1', value: patchedBlockId },
            { op: 'remove', path: '/1/0/1' },
        ],
    });
    assert.equal(patchResult.ok && patchResult.refundedSunflowers, 40);
    assert.equal(await getSunflowers(fixtureData.accountId), startBalance);

    // A retried removal finds no block and cannot pay a second refund.
    const retry = await recycleByDelete(deleteCommand);
    assert.equal(!retry.ok && retry.code, 'BLOCK_NOT_FOUND');
    assert.equal(await getSunflowers(fixtureData.accountId), startBalance);
});

test('a price drop still refunds the price paid', {
    skip: !storageIntegrationEnabled,
}, async () => {
    const fixtureData = await fixture();
    const board = priceBoard(60);
    const blockId = await buyShade(purchaseService(board), fixtureData, 0);
    board.setShadePrice(15);

    const result = await deleteRecycler(board)({
        accountId: fixtureData.accountId,
        blockId,
        gardenId: fixtureData.gardenId,
    });

    assert.equal(result.ok && result.refundedSunflowers, 60);
});

test('legacy blocks refund min(current price, recorded purchase), else the current price', {
    skip: !storageIntegrationEnabled,
}, async () => {
    const fixtureData = await fixture();
    const board = priceBoard(40);
    const legacyBlockId = await buyShade(
        purchaseService(board, { recordPaidPrice: false }),
        fixtureData,
        0,
    );
    const unrecordedBlockId = await createGardenBlock(
        fixtureData.gardenId,
        'Shade',
    );
    const unrecordedStack = (await getGardenStacks(fixtureData.gardenId)).find(
        (stack) => stack.positionX === 1 && stack.positionY === 0,
    );
    assert.ok(unrecordedStack);
    await updateGardenStack(fixtureData.gardenId, {
        blocks: [...unrecordedStack.blocks, unrecordedBlockId],
        x: 1,
        y: 0,
    });
    assert.equal(
        (await getGardenBlock(fixtureData.gardenId, legacyBlockId))
            ?.paidSunflowers,
        null,
    );
    assert.equal(
        await getLegacyGardenBlockPaidSunflowers({
            accountId: fixtureData.accountId,
            blockId: legacyBlockId,
            gardenId: fixtureData.gardenId,
        }),
        40,
    );

    board.setShadePrice(100);
    const recycle = deleteRecycler(board);
    const recorded = await recycle({
        accountId: fixtureData.accountId,
        blockId: legacyBlockId,
        gardenId: fixtureData.gardenId,
    });
    const unrecorded = await recycle({
        accountId: fixtureData.accountId,
        blockId: unrecordedBlockId,
        gardenId: fixtureData.gardenId,
    });

    assert.equal(recorded.ok && recorded.refundedSunflowers, 40);
    assert.equal(unrecorded.ok && unrecorded.refundedSunflowers, 100);
});

test('blocks bought before receipts refund min(current price, their block:<name> debit) on both paths', {
    skip: !storageIntegrationEnabled,
}, async () => {
    const fixtureData = await fixture();
    const board = priceBoard(10);
    // The pre-2026-08-30 purchase: insert the block, put it on the stack,
    // then debit `block:<name>` with no block ID.
    const legacyBlockIds: string[] = [];
    for (const x of [0, 1]) {
        const blockId = await createGardenBlock(fixtureData.gardenId, 'Shade');
        const stack = (await getGardenStacks(fixtureData.gardenId)).find(
            (candidate) =>
                candidate.positionX === x && candidate.positionY === 0,
        );
        assert.ok(stack);
        await updateGardenStack(fixtureData.gardenId, {
            blocks: [...stack.blocks, blockId],
            x,
            y: 0,
        });
        await spendSunflowers(fixtureData.accountId, 10, 'block:Shade');
        legacyBlockIds.push(blockId);
    }
    const [deletedBlockId, patchedBlockId] = legacyBlockIds;
    assert.ok(deletedBlockId && patchedBlockId);
    assert.equal(
        (await getGardenBlock(fixtureData.gardenId, deletedBlockId))
            ?.paidSunflowers,
        null,
    );

    board.setShadePrice(100);
    const before = await getSunflowers(fixtureData.accountId);
    const deleted = await deleteRecycler(board)({
        accountId: fixtureData.accountId,
        blockId: deletedBlockId,
        gardenId: fixtureData.gardenId,
    });
    const patched = await patchRecycler(board)({
        accountId: fixtureData.accountId,
        gardenId: fixtureData.gardenId,
        operations: [
            { op: 'test', path: '/1/0/1', value: patchedBlockId },
            { op: 'remove', path: '/1/0/1' },
        ],
    });

    assert.equal(deleted.ok && deleted.refundedSunflowers, 10);
    assert.equal(patched.ok && patched.refundedSunflowers, 10);
    assert.equal(await getSunflowers(fixtureData.accountId), before + 20);
});

test('a legacy block bought before a price drop refunds the lower current price', {
    skip: !storageIntegrationEnabled,
}, async () => {
    const fixtureData = await fixture();
    const board = priceBoard(40);
    const legacyBlockId = await buyShade(
        purchaseService(board, { recordPaidPrice: false }),
        fixtureData,
        0,
    );
    board.setShadePrice(25);

    const result = await patchRecycler(board)({
        accountId: fixtureData.accountId,
        gardenId: fixtureData.gardenId,
        operations: [
            { op: 'test', path: '/0/0/1', value: legacyBlockId },
            { op: 'remove', path: '/0/0/1' },
        ],
    });

    assert.equal(result.ok && result.refundedSunflowers, 25);
});

test('sandbox purchases store a zero price and recycle without currency', {
    skip: !storageIntegrationEnabled,
}, async () => {
    const fixtureData = await fixture({ sandbox: true });
    const board = priceBoard(40);
    const balance = await getSunflowers(fixtureData.accountId);
    const blockId = await buyShade(purchaseService(board), fixtureData, 0);
    assert.equal(
        (await getGardenBlock(fixtureData.gardenId, blockId))?.paidSunflowers,
        0,
    );

    const result = await deleteRecycler(board)({
        accountId: fixtureData.accountId,
        blockId,
        gardenId: fixtureData.gardenId,
    });

    assert.equal(result.ok && result.refundedSunflowers, 0);
    assert.equal(await getSunflowers(fixtureData.accountId), balance);
});

test('free starter-garden blocks refund nothing', {
    skip: !storageIntegrationEnabled,
}, async () => {
    const accountId = await createAccount();
    await ensureFarmId();
    const gardenId = await createDefaultGardenForAccount({ accountId });
    const blocks = await getGardenBlocks(gardenId);
    assert.ok(blocks.length > 0);
    assert.deepEqual(
        [...new Set(blocks.map((block) => block.paidSunflowers))],
        [0],
    );
    const grass = blocks.find((block) => block.name === 'Block_Grass');
    assert.ok(grass);
    const balance = await getSunflowers(accountId);

    const result = await deleteRecycler(priceBoard(40))({
        accountId,
        blockId: grass.id,
        gardenId,
    });

    assert.deepEqual(result, {
        ok: true,
        blockId: grass.id,
        refundedSunflowers: 0,
    });
    assert.equal(await getSunflowers(accountId), balance);
});

test('a garden box round trip keeps the price paid, including a legacy purchase record', {
    skip: !storageIntegrationEnabled,
}, async () => {
    const fixtureData = await fixture();
    const board = priceBoard(40);
    const legacyBlockId = await buyShade(
        purchaseService(board, { recordPaidPrice: false }),
        fixtureData,
        0,
    );
    const gardenBoxBlockId = await createGardenBlock(
        fixtureData.gardenId,
        'GardenBox',
    );
    const boxGroundId = fixtureData.groundIds[1];
    assert.ok(boxGroundId);
    await updateGardenStack(fixtureData.gardenId, {
        blocks: [boxGroundId, gardenBoxBlockId],
        x: 1,
        y: 0,
    });
    const box = boxServices(board);

    const stored = await box.store({
        accountId: fixtureData.accountId,
        blockId: legacyBlockId,
        blockIndex: 1,
        gardenBoxBlockId,
        gardenId: fixtureData.gardenId,
        sourcePosition: { x: 0, z: 0 },
    });
    assert.equal(stored.ok, true);
    board.setShadePrice(100);
    const placed = await box.place({
        accountId: fixtureData.accountId,
        entityId: '3',
        gardenBoxBlockId,
        gardenId: fixtureData.gardenId,
        operationId: randomUUID(),
    });
    if (!placed.ok) {
        throw new Error(
            `Expected the box placement to succeed: ${placed.code}`,
        );
    }
    assert.notEqual(placed.blockId, legacyBlockId);
    assert.equal(
        (await getGardenBlock(fixtureData.gardenId, placed.blockId))
            ?.paidSunflowers,
        40,
    );

    const refund = await deleteRecycler(board)({
        accountId: fixtureData.accountId,
        blockId: placed.blockId,
        gardenId: fixtureData.gardenId,
    });

    assert.equal(refund.ok && refund.refundedSunflowers, 40);
});
