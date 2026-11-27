import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import {
    addGardenBoxInventoryItem,
    consumeGardenBoxInventoryItem,
    createAccount,
    createGardenBlock,
    createGardenBlocks,
    earnSunflowers,
    earnSunflowersOnce,
    gardenBlockPurchaseDebitReason,
    gardenBlocks,
    getAllEvents,
    getGardenBlock,
    getGardenBlocks,
    getGardenBoxBlockUnitPaidSunflowers,
    getLegacyGardenBlockPaidSunflowers,
    knownEventTypes,
    legacyGardenBlockPurchaseDebitReason,
    legacyGardenBlockPurchaseDebitWindowSeconds,
    spendSunflowers,
    spendSunflowersBatch,
    storage,
    withGardenMutationOperation,
} from '@gredice/storage';
import { eq, sql } from 'drizzle-orm';
import { createTestGarden, ensureFarmId } from './helpers/testHelpers';
import { createTestDb } from './testDb';

async function gardenFixture() {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    return { accountId, gardenId };
}

describe('garden block paid price storage', () => {
    it('stores the paid price given at insert and NULL for legacy-compatible callers', async () => {
        const { gardenId } = await gardenFixture();

        const paidId = await createGardenBlock(
            gardenId,
            'Shade',
            null,
            storage(),
            {
                paidSunflowers: 45,
            },
        );
        const freeId = await createGardenBlock(
            gardenId,
            'Shade',
            null,
            storage(),
            {
                paidSunflowers: 0,
            },
        );
        const variantId = await createGardenBlock(
            gardenId,
            'Rabbit',
            2,
            storage(),
            {
                paidSunflowers: 12,
            },
        );
        const legacyId = await createGardenBlock(gardenId, 'Shade');

        assert.equal(
            (await getGardenBlock(gardenId, paidId))?.paidSunflowers,
            45,
        );
        assert.equal(
            (await getGardenBlock(gardenId, freeId))?.paidSunflowers,
            0,
        );
        const variantBlock = await getGardenBlock(gardenId, variantId);
        assert.equal(variantBlock?.paidSunflowers, 12);
        assert.equal(variantBlock?.variant, 2);
        assert.equal(
            (await getGardenBlock(gardenId, legacyId))?.paidSunflowers,
            null,
        );
    });

    it('rejects invalid paid prices before writing and the column rejects negatives', async () => {
        const { gardenId } = await gardenFixture();

        for (const paidSunflowers of [-1, 1.5, 2_147_483_648, Number.NaN]) {
            await assert.rejects(
                createGardenBlock(gardenId, 'Shade', null, storage(), {
                    paidSunflowers,
                }),
                RangeError,
            );
        }
        assert.deepEqual(await getGardenBlocks(gardenId), []);
        await assert.rejects(
            storage().insert(gardenBlocks).values({
                id: randomUUID(),
                gardenId,
                name: 'Shade',
                paidSunflowers: -5,
            }),
        );
    });

    it('bulk-inserts blocks with paid price and rotation and one placement event each, in order', async () => {
        const { gardenId } = await gardenFixture();

        assert.deepEqual(await createGardenBlocks(gardenId, []), []);
        const ids = await createGardenBlocks(gardenId, [
            { name: 'Shade', paidSunflowers: 30, rotation: 1 },
            { name: 'Shade', paidSunflowers: 30, rotation: 1 },
            { name: 'Bush', paidSunflowers: 0, variant: 3 },
        ]);

        assert.equal(ids.length, 3);
        assert.equal(new Set(ids).size, 3);
        const stored = await getGardenBlocks(gardenId);
        const byId = new Map(stored.map((block) => [block.id, block]));
        assert.deepEqual(
            ids.map((id) => {
                const block = byId.get(id);
                return [
                    block?.name,
                    block?.paidSunflowers,
                    block?.rotation,
                    block?.variant,
                ];
            }),
            [
                ['Shade', 30, 1, null],
                ['Shade', 30, 1, null],
                ['Bush', 0, null, 3],
            ],
        );
        const placedEvents = await getAllEvents(
            knownEventTypes.gardens.blockPlace,
            [gardenId.toString()],
        );
        assert.deepEqual(
            placedEvents.map((event) => event.data),
            [
                { id: ids[0], name: 'Shade', variant: null },
                { id: ids[1], name: 'Shade', variant: null },
                { id: ids[2], name: 'Bush', variant: 3 },
            ],
        );
    });

    it('writes nothing when any bulk block has an invalid paid price', async () => {
        const { gardenId } = await gardenFixture();

        await assert.rejects(
            createGardenBlocks(gardenId, [
                { name: 'Shade', paidSunflowers: 30 },
                { name: 'Shade', paidSunflowers: -30 },
            ]),
            RangeError,
        );

        assert.deepEqual(await getGardenBlocks(gardenId), []);
    });
});

describe('legacy garden block paid price recovery', () => {
    async function legacyPurchase(
        fixture: Awaited<ReturnType<typeof gardenFixture>>,
        amount: number | null,
    ) {
        await earnSunflowersOnce(
            fixture.accountId,
            500,
            `test:legacy-paid-price:${randomUUID()}`,
        );
        const blockId = await createGardenBlock(fixture.gardenId, 'Shade');
        const operationId = randomUUID();
        await withGardenMutationOperation(
            {
                gardenId: fixture.gardenId,
                kind: 'block-purchase',
                operationId,
                payload: { schemaVersion: 1, blockName: 'Shade' },
            },
            async (transaction) => {
                if (amount !== null) {
                    await spendSunflowersBatch(
                        fixture.accountId,
                        [
                            {
                                amount,
                                reason: gardenBlockPurchaseDebitReason(
                                    fixture.gardenId,
                                    operationId,
                                ),
                            },
                        ],
                        transaction,
                    );
                }
                return {
                    response: {
                        id: blockId,
                        position: { x: 0, y: 0 },
                        variant: null,
                    },
                };
            },
        );
        return blockId;
    }

    it('recovers the exact debit of the purchase receipt that created the block', async () => {
        const fixture = await gardenFixture();
        const blockId = await legacyPurchase(fixture, 35);
        await legacyPurchase(fixture, 80);

        assert.equal(
            await getLegacyGardenBlockPaidSunflowers({ ...fixture, blockId }),
            35,
        );
    });

    it('returns null without an exact record, for another account, or another garden', async () => {
        const fixture = await gardenFixture();
        const other = await gardenFixture();
        const paidBlockId = await legacyPurchase(fixture, 35);
        const sandboxLikeBlockId = await legacyPurchase(fixture, null);
        const unrecordedBlockId = await createGardenBlock(
            fixture.gardenId,
            'Shade',
        );

        assert.equal(
            await getLegacyGardenBlockPaidSunflowers({
                ...fixture,
                blockId: sandboxLikeBlockId,
            }),
            null,
        );
        assert.equal(
            await getLegacyGardenBlockPaidSunflowers({
                ...fixture,
                blockId: unrecordedBlockId,
            }),
            null,
        );
        assert.equal(
            await getLegacyGardenBlockPaidSunflowers({
                accountId: other.accountId,
                blockId: paidBlockId,
                gardenId: fixture.gardenId,
            }),
            null,
        );
        assert.equal(
            await getLegacyGardenBlockPaidSunflowers({
                accountId: fixture.accountId,
                blockId: paidBlockId,
                gardenId: other.gardenId,
            }),
            null,
        );
    });
});

describe('legacy garden block paid price recovery before receipts', () => {
    async function fundedFixture() {
        const fixture = await gardenFixture();
        await earnSunflowersOnce(
            fixture.accountId,
            500,
            `test:legacy-debit:${randomUUID()}`,
        );
        return fixture;
    }

    /** Moves the block's creation time; positive seconds move it later. */
    async function shiftBlockCreatedAt(blockId: string, seconds: number) {
        await storage()
            .update(gardenBlocks)
            .set({
                createdAt: sql`${gardenBlocks.createdAt} + make_interval(secs => ${seconds}::double precision)`,
            })
            .where(eq(gardenBlocks.id, blockId));
    }

    it('names the pre-receipt debit after the block type', () => {
        assert.equal(
            legacyGardenBlockPurchaseDebitReason('Shade'),
            'block:Shade',
        );
        assert.equal(legacyGardenBlockPurchaseDebitWindowSeconds, 60);
    });

    it('recovers the block:<name> debit made with the block, in either order', async () => {
        const sequential = await fundedFixture();
        const sequentialBlockId = await createGardenBlock(
            sequential.gardenId,
            'Shade',
        );
        await spendSunflowers(sequential.accountId, 35, 'block:Shade');

        // Until April 2026 the debit and the insert ran in parallel.
        const parallel = await fundedFixture();
        await spendSunflowers(parallel.accountId, 40, 'block:Shade');
        const parallelBlockId = await createGardenBlock(
            parallel.gardenId,
            'Shade',
        );

        assert.equal(
            await getLegacyGardenBlockPaidSunflowers({
                ...sequential,
                blockId: sequentialBlockId,
            }),
            35,
        );
        assert.equal(
            await getLegacyGardenBlockPaidSunflowers({
                ...parallel,
                blockId: parallelBlockId,
            }),
            40,
        );
    });

    it('takes the lowest debit of that block type within the window and only lowers', async () => {
        const fixture = await fundedFixture();
        const blockId = await createGardenBlock(fixture.gardenId, 'Shade');
        await spendSunflowers(fixture.accountId, 35, 'block:Shade');
        await spendSunflowers(fixture.accountId, 30, 'block:Shade');
        await shiftBlockCreatedAt(blockId, -59);

        assert.equal(
            await getLegacyGardenBlockPaidSunflowers({ ...fixture, blockId }),
            30,
        );
    });

    it('ignores other block types, earnings, other accounts, other gardens and debits outside the window', async () => {
        const fixture = await fundedFixture();
        const other = await fundedFixture();
        const blockId = await createGardenBlock(fixture.gardenId, 'Shade');
        await spendSunflowers(fixture.accountId, 5, 'block:Bush');
        await spendSunflowers(fixture.accountId, 6, 'block:Shade2');
        // Old refunds earned under the same reason.
        await earnSunflowers(fixture.accountId, 7, 'block:Shade');
        await spendSunflowers(other.accountId, 8, 'block:Shade');

        assert.equal(
            await getLegacyGardenBlockPaidSunflowers({ ...fixture, blockId }),
            null,
        );
        assert.equal(
            await getLegacyGardenBlockPaidSunflowers({
                accountId: fixture.accountId,
                blockId,
                gardenId: other.gardenId,
            }),
            null,
        );

        await spendSunflowers(fixture.accountId, 9, 'block:Shade');
        assert.equal(
            await getLegacyGardenBlockPaidSunflowers({ ...fixture, blockId }),
            9,
        );
        // The debit is now 61 s before the block, then 61 s after it.
        await shiftBlockCreatedAt(blockId, 61);
        assert.equal(
            await getLegacyGardenBlockPaidSunflowers({ ...fixture, blockId }),
            null,
        );
        await shiftBlockCreatedAt(blockId, -122);
        assert.equal(
            await getLegacyGardenBlockPaidSunflowers({ ...fixture, blockId }),
            null,
        );
    });

    it('prefers the exact purchase receipt over a block:<name> debit', async () => {
        const fixture = await fundedFixture();
        const blockId = await createGardenBlock(fixture.gardenId, 'Shade');
        await spendSunflowers(fixture.accountId, 20, 'block:Shade');
        const operationId = randomUUID();
        await withGardenMutationOperation(
            {
                gardenId: fixture.gardenId,
                kind: 'block-purchase',
                operationId,
                payload: { schemaVersion: 1, blockName: 'Shade' },
            },
            async (transaction) => {
                await spendSunflowersBatch(
                    fixture.accountId,
                    [
                        {
                            amount: 45,
                            reason: gardenBlockPurchaseDebitReason(
                                fixture.gardenId,
                                operationId,
                            ),
                        },
                    ],
                    transaction,
                );
                return {
                    response: {
                        id: blockId,
                        position: { x: 0, y: 0 },
                        variant: null,
                    },
                };
            },
        );

        assert.equal(
            await getLegacyGardenBlockPaidSunflowers({ ...fixture, blockId }),
            45,
        );
    });
});

describe('garden box unit paid price pool', () => {
    async function boxFixture() {
        const fixture = await gardenFixture();
        const gardenBoxBlockId = await createGardenBlock(
            fixture.gardenId,
            'GardenBox',
        );
        const input = { ...fixture, entityId: '101', gardenBoxBlockId };
        const add = (paidSunflowers: number | null | undefined, amount = 1) =>
            addGardenBoxInventoryItem(
                fixture.accountId,
                fixture.gardenId,
                gardenBoxBlockId,
                {
                    amount,
                    entityId: '101',
                    entityTypeName: 'block',
                    ...(paidSunflowers === undefined ? {} : { paidSunflowers }),
                    source: `test:box-pool:${randomUUID()}`,
                },
            );
        const take = (paidSunflowers: number | null | undefined) =>
            consumeGardenBoxInventoryItem(
                fixture.accountId,
                fixture.gardenId,
                gardenBoxBlockId,
                {
                    amount: 1,
                    entityId: '101',
                    entityTypeName: 'block',
                    ...(paidSunflowers === undefined ? {} : { paidSunflowers }),
                    source: 'test:box-pool:take',
                },
            );
        const next = () => getGardenBoxBlockUnitPaidSunflowers(input);
        return { add, fixture, gardenBoxBlockId, next, take };
    }

    it('hands out the cheapest known price first and removes exactly the price taken', async () => {
        const box = await boxFixture();
        assert.equal(await box.next(), null);

        await box.add(30);
        await box.add(10);
        await box.add(20, 2);
        assert.equal(await box.next(), 10);
        await box.take(10);
        assert.equal(await box.next(), 20);
        await box.take(20);
        assert.equal(await box.next(), 20);
        await box.take(20);
        assert.equal(await box.next(), 30);
        await box.take(30);
        assert.equal(await box.next(), null);
    });

    it('prefers known prices over legacy units and returns null when only legacy units remain', async () => {
        const box = await boxFixture();
        await box.add(undefined);
        await box.add(null);
        await box.add(25);

        assert.equal(await box.next(), 25);
        await box.take(25);
        assert.equal(await box.next(), null);
    });

    it('lets unpriced takes consume legacy units first, else the most expensive known unit', async () => {
        const box = await boxFixture();
        await box.add(undefined);
        await box.add(15);
        await box.add(60);

        await box.take(undefined);
        assert.equal(await box.next(), 15);
        await box.take(undefined);
        // The legacy unit was used up, so the unpriced take removed 60.
        assert.equal(await box.next(), 15);
    });

    it('ignores other block types and other boxes', async () => {
        const box = await boxFixture();
        const otherBox = await boxFixture();
        await box.add(40);
        await addGardenBoxInventoryItem(
            box.fixture.accountId,
            box.fixture.gardenId,
            box.gardenBoxBlockId,
            {
                amount: 1,
                entityId: '202',
                entityTypeName: 'block',
                paidSunflowers: 5,
                source: `test:box-pool:${randomUUID()}`,
            },
        );
        await otherBox.add(1);

        assert.equal(await box.next(), 40);
        assert.equal(await otherBox.next(), 1);
    });

    it('rejects invalid unit prices without recording an event', async () => {
        const box = await boxFixture();

        for (const paidSunflowers of [-1, 2.5, 2_147_483_648]) {
            await assert.rejects(box.add(paidSunflowers), RangeError);
        }
        assert.equal(await box.next(), null);
        assert.deepEqual(
            await getAllEvents(knownEventTypes.inventory.add, [
                `inventory:${box.fixture.accountId}:gardenBox:${box.fixture.gardenId.toString()}:${box.gardenBoxBlockId}`,
            ]),
            [],
        );
    });
});
