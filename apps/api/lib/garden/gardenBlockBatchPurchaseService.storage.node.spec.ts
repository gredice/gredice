import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import type { BlockData } from '@gredice/directory-types';
import {
    appendBlocksToGardenStacks,
    closeStorage,
    createAccount,
    createGardenBlock,
    createGardenBlocks,
    createGardenStack,
    createSandboxGarden,
    deleteGardenStack,
    earnSunflowersOnce,
    type GardenPlacementTransaction,
    gardenBlocks,
    gardenStacks,
    getAllEvents,
    getGardenBlocks,
    getGardenMutationAuthorityForUpdate,
    getGardenMutationOperationReceipt,
    getGardenPlacementSnapshotForUpdate,
    getLegacyGardenBlockPaidSunflowers,
    getSunflowers,
    knownEventTypes,
    listGardenRaisedBedMetadataForUpdate,
    softDeleteGardenBlockOnce,
    softDeleteNewRaisedBedOnce,
    spendSunflowersBatch,
    storage,
    updateGardenBlock,
    updateGardenStack,
    updateRaisedBedOrientation,
    withAccountDeletionFenceTransaction,
    withGardenMutationOperation,
    withGardenPlacementTransaction,
    withSunflowerAccountTransaction,
} from '@gredice/storage';
import { gardenBlockBatchPurchaseBodySchema } from '@gredice/storage/gardenBlockBatchPurchaseContract';
import { asc, eq } from 'drizzle-orm';
import {
    createTestGarden,
    ensureFarmId,
} from '../../../../packages/storage/tests/helpers/testHelpers';
import {
    createGardenBlockBatchPurchaseService,
    type GardenBlockBatchPurchaseCommand,
    isGardenBlockBatchPurchaseReplay,
} from './gardenBlockBatchPurchaseService';
import {
    createGardenBlockMutationService,
    validateRotatedBlockPlacementUnavailable,
} from './gardenBlockMutationService';

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
        functions: { raisedBed: false, recycler: false },
        createdAt: timestamp,
        updatedAt: timestamp,
    };
}

function priceBoard(initialBushPrice: number) {
    let bushPrice = initialBushPrice;
    return {
        blockData: async () => [
            directoryBlock(1, 'Block_Grass', 5),
            directoryBlock(2, 'Bush', bushPrice),
        ],
        setBushPrice: (price: number) => {
            bushPrice = price;
        },
    };
}

type PriceBoard = ReturnType<typeof priceBoard>;

function batchService(
    board: PriceBoard,
    controls: Readonly<{ failAfterBulkWrites?: boolean }> = {},
) {
    return createGardenBlockBatchPurchaseService<GardenPlacementTransaction>({
        appendBlocksToGardenStacks: async (gardenId, stacks, transaction) => {
            await appendBlocksToGardenStacks(gardenId, stacks, transaction);
            if (controls.failAfterBulkWrites) {
                throw new Error('Injected failure after the bulk writes');
            }
        },
        createGardenBlocks: (gardenId, blocks, transaction) =>
            createGardenBlocks(gardenId, blocks, transaction),
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

/**
 * Grass at (0,0) and (1,0), a soft-deleted stack at (2,0) and nothing at
 * (3,0), so one batch covers existing, revived and new stacks.
 */
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
    await createGardenStack(gardenId, { x: 2, y: 0 });
    await deleteGardenStack(gardenId, { x: 2, y: 0 });
    await earnSunflowersOnce(
        accountId,
        2_000,
        `test:block-batch:${randomUUID()}`,
    );
    return { accountId, gardenId, groundIds };
}

function batchCommand(
    data: Awaited<ReturnType<typeof fixture>>,
    overrides: Partial<GardenBlockBatchPurchaseCommand> = {},
): GardenBlockBatchPurchaseCommand {
    return {
        accountId: data.accountId,
        gardenId: data.gardenId,
        operationId: randomUUID(),
        blockName: 'Bush',
        rotation: 5,
        expectedUnitPrice: 10,
        placements: [
            {
                position: { x: 0, y: 0 },
                expectedExistingBlocks: [data.groundIds[0] ?? ''],
            },
            {
                position: { x: 1, y: 0 },
                expectedExistingBlocks: [data.groundIds[1] ?? ''],
            },
            { position: { x: 2, y: 0 }, expectedExistingBlocks: [] },
            { position: { x: 3, y: 0 }, expectedExistingBlocks: [] },
        ],
        ...overrides,
    };
}

async function stackRows(gardenId: number) {
    return storage()
        .select({
            id: gardenStacks.id,
            blocks: gardenStacks.blocks,
            isDeleted: gardenStacks.isDeleted,
            positionX: gardenStacks.positionX,
            positionY: gardenStacks.positionY,
        })
        .from(gardenStacks)
        .where(eq(gardenStacks.gardenId, gardenId))
        .orderBy(asc(gardenStacks.id));
}

async function spendEvents(accountId: string) {
    return (
        await getAllEvents(knownEventTypes.accounts.spendSunflowers, [
            accountId,
        ])
    ).map((event) => event.data);
}

test('a real batch persists rotated paid blocks, every stack kind, one debit and one receipt', {
    skip: !storageIntegrationEnabled,
}, async () => {
    const data = await fixture();
    const board = priceBoard(10);
    const service = batchService(board);
    const command = batchCommand(data);
    const beforeBalance = await getSunflowers(data.accountId);
    const deletedStackId = (await stackRows(data.gardenId)).find(
        (row) => row.positionX === 2,
    )?.id;

    const result = await service(command);

    assert.ok(result.ok, JSON.stringify(result));
    assert.equal(result.replayed, false);
    assert.equal(result.rotation, 1);
    assert.equal(result.chargedSunflowers, 40);
    assert.deepEqual(
        result.placements.map((placement) => placement.position),
        command.placements.map((placement) => placement.position),
    );
    const placedIds = result.placements.map((placement) => placement.id);
    const blocksById = new Map(
        (await getGardenBlocks(data.gardenId)).map((block) => [
            block.id,
            block,
        ]),
    );
    assert.deepEqual(
        placedIds.map((id) => {
            const block = blocksById.get(id);
            return [block?.name, block?.rotation, block?.paidSunflowers];
        }),
        placedIds.map(() => ['Bush', 1, 10]),
    );
    const rows = await stackRows(data.gardenId);
    assert.deepEqual(
        rows.map((row) => [
            row.positionX,
            row.positionY,
            row.isDeleted,
            row.blocks,
        ]),
        [
            [0, 0, false, [data.groundIds[0], placedIds[0]]],
            [1, 0, false, [data.groundIds[1], placedIds[1]]],
            [2, 0, false, [placedIds[2]]],
            [3, 0, false, [placedIds[3]]],
        ],
    );
    assert.equal(rows[2]?.id, deletedStackId);
    assert.equal(await getSunflowers(data.accountId), beforeBalance - 40);
    const spends = await spendEvents(data.accountId);
    assert.deepEqual(spends, [
        {
            amount: 40,
            reason: `gardenBlock:${data.gardenId.toString()}:expand:${command.operationId}`,
        },
    ]);
    const receipt = await getGardenMutationOperationReceipt({
        gardenId: data.gardenId,
        operationId: command.operationId,
    });
    assert.equal(receipt?.kind, 'block-purchase-batch');
    const placedEvents = await getAllEvents(
        knownEventTypes.gardens.blockPlace,
        [data.gardenId.toString()],
    );
    assert.deepEqual(
        placedEvents
            .map((event) => event.data)
            .filter(
                (event) =>
                    event !== null &&
                    typeof event === 'object' &&
                    'name' in event &&
                    event.name === 'Bush',
            ),
        placedIds.map((id) => ({ id, name: 'Bush', variant: null })),
    );

    const replay = await service(command);
    assert.ok(replay.ok);
    assert.equal(replay.replayed, true);
    assert.deepEqual(replay.placements, result.placements);
    assert.equal(await getSunflowers(data.accountId), beforeBalance - 40);
    assert.equal((await spendEvents(data.accountId)).length, 1);
    assert.equal((await getGardenBlocks(data.gardenId)).length, 6);

    // The route lets exactly this retry pass a denied rate limit: it matches
    // the stored receipt's payload hash (rotation 5 and 1 normalize alike).
    const { accountId: _accountId, gardenId: _gardenId, ...rawBody } = command;
    const replayBody = gardenBlockBatchPurchaseBodySchema.parse(rawBody);
    const isReplay = (body: typeof replayBody, gardenId = data.gardenId) =>
        isGardenBlockBatchPurchaseReplay({ body, gardenId });
    assert.equal(await isReplay(replayBody), true);
    assert.equal(await isReplay({ ...replayBody, rotation: 1 }), true);
    assert.equal(
        await isReplay({ ...replayBody, expectedUnitPrice: 11 }),
        false,
    );
    assert.equal(
        await isReplay({ ...replayBody, operationId: randomUUID() }),
        false,
    );
    assert.equal(await isReplay(replayBody, data.gardenId + 1_000_000), false);

    // OPEN-7: each copy refunds what was paid for it, not today's price.
    board.setBushPrice(100);
    const refund = await deleteRecycler(board)({
        accountId: data.accountId,
        blockId: placedIds[3] ?? '',
        gardenId: data.gardenId,
    });
    assert.deepEqual(refund, {
        ok: true,
        blockId: placedIds[3],
        refundedSunflowers: 10,
    });
});

test('a failure after the bulk writes rolls back blocks, stacks, debit and receipt together', {
    skip: !storageIntegrationEnabled,
}, async () => {
    const data = await fixture();
    const command = batchCommand(data);
    const beforeBalance = await getSunflowers(data.accountId);
    const beforeRows = await stackRows(data.gardenId);
    const beforeBlocks = await getGardenBlocks(data.gardenId);
    const originalError = console.error;
    console.error = () => {};
    try {
        const result = await batchService(priceBoard(10), {
            failAfterBulkWrites: true,
        })(command);
        assert.ok(!result.ok);
        assert.equal(result.code, 'OPERATION_FAILED');
        assert.equal(result.status, 500);
    } finally {
        console.error = originalError;
    }

    assert.equal(await getSunflowers(data.accountId), beforeBalance);
    assert.deepEqual(await stackRows(data.gardenId), beforeRows);
    assert.deepEqual(
        (await getGardenBlocks(data.gardenId)).map((block) => block.id),
        beforeBlocks.map((block) => block.id),
    );
    assert.deepEqual(await spendEvents(data.accountId), []);
    assert.equal(
        await getGardenMutationOperationReceipt({
            gardenId: data.gardenId,
            operationId: command.operationId,
        }),
        null,
    );

    const retried = await batchService(priceBoard(10))(command);
    assert.ok(retried.ok);
    assert.equal(retried.replayed, false);
    assert.equal(await getSunflowers(data.accountId), beforeBalance - 40);
});

test('a real sandbox batch is free and records a paid price of 0', {
    skip: !storageIntegrationEnabled,
}, async () => {
    const data = await fixture({ sandbox: true });
    const beforeBalance = await getSunflowers(data.accountId);
    const result = await batchService(priceBoard(10))(
        batchCommand(data, { expectedUnitPrice: 0 }),
    );

    assert.ok(result.ok, JSON.stringify(result));
    assert.equal(result.chargedSunflowers, 0);
    assert.equal(await getSunflowers(data.accountId), beforeBalance);
    assert.deepEqual(await spendEvents(data.accountId), []);
    const blocksById = new Map(
        (await getGardenBlocks(data.gardenId)).map((block) => [
            block.id,
            block,
        ]),
    );
    for (const placement of result.placements) {
        assert.equal(blocksById.get(placement.id)?.paidSunflowers, 0);
    }
});

test('99 placements on seven-high stacks complete in one transaction within the time budget', {
    skip: !storageIntegrationEnabled,
}, async (context) => {
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    await earnSunflowersOnce(
        accountId,
        2_000,
        `test:block-batch-budget:${randomUUID()}`,
    );
    const stacks: { x: number; y: number; blocks: string[] }[] = [];
    const groundRows: (typeof gardenBlocks.$inferInsert)[] = [];
    for (let x = 0; x < 10; x++) {
        for (let y = 0; y < 10; y++) {
            if (x === 0 && y === 0) continue;
            const ids = Array.from({ length: 7 }, () => randomUUID());
            for (const id of ids) {
                groundRows.push({ id, gardenId, name: 'Block_Grass' });
            }
            stacks.push({ x, y, blocks: ids });
        }
    }
    await storage().insert(gardenBlocks).values(groundRows);
    await appendBlocksToGardenStacks(gardenId, stacks);

    const command: GardenBlockBatchPurchaseCommand = {
        accountId,
        gardenId,
        operationId: randomUUID(),
        blockName: 'Bush',
        rotation: 2,
        expectedUnitPrice: 10,
        placements: stacks.map((stack) => ({
            position: { x: stack.x, y: stack.y },
            expectedExistingBlocks: stack.blocks,
        })),
    };
    const startedAt = performance.now();
    const result = await batchService(priceBoard(10))(command);
    const elapsedMs = performance.now() - startedAt;
    context.diagnostic(
        `99-placement garden block batch took ${elapsedMs.toFixed(0)} ms`,
    );

    assert.ok(result.ok, JSON.stringify(result));
    assert.equal(result.placements.length, 99);
    assert.equal(result.chargedSunflowers, 990);
    assert.ok(elapsedMs < 5_000, `took ${elapsedMs.toFixed(0)} ms`);
    const rows = await stackRows(gardenId);
    assert.equal(rows.length, 99);
    assert.ok(rows.every((row) => row.blocks.length === 8));
});
