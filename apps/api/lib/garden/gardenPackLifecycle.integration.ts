import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import type { BlockData } from '@gredice/directory-types';
import {
    accounts,
    addGardenBoxInventoryItem,
    closeStorage,
    createGardenBlock,
    createGardenStack,
    deleteAccountWithDependencies,
    farms,
    gardenBlocks,
    gardenPackPurchases,
    gardenPackUnitLocations,
    gardens,
    getGardenBoxStoredPackUnits,
    getGardenPackPlacementReplay,
    getGardenPackPlacementUnitForUpdate,
    getGardenPlacementSnapshotForUpdate,
    getPurchasedGardenPack,
    getPurchasedGardenPackAudit,
    recordGardenPackPlacement,
    recordPurchasedGardenPack,
    recycleGardenPackUnitForAccount,
    refundGardenPackUnits,
    storage,
    storeGardenPackBlock,
    updateGardenStack,
    withAccountDeletionFenceTransaction,
    withGardenPlacementTransaction,
    withStoredGardenPackUnit,
    withSunflowerAccountTransaction,
} from '@gredice/storage';
import { gardenPackProductSnapshotSchema } from '@gredice/storage/gardenPackContract';
import { eq, sql } from 'drizzle-orm';
import { deleteRealGardenForAccount } from './gardenDeletionService';
import { prepareGardenPackIntegrationSchema } from './gardenPackIntegrationSchema';
import { createGardenPackLifecycleService } from './gardenPackLifecycleService';
import { createGardenPackPlacementService } from './gardenPackPlacementService';

const enabled =
    process.env.TEST_ENV === '1' &&
    process.env.GREDICE_PACK_LIFECYCLE_TEST === '1';
before(async () => {
    if (!enabled) return;
    await prepareGardenPackIntegrationSchema();
});
after(async () => {
    if (enabled) await closeStorage();
});
const timestamp = '2026-10-01T00:00:00Z';
function block(
    id: number,
    name: string,
    type: string,
    stackable: boolean,
): BlockData {
    return {
        id,
        entityType: { id: 8, name: 'block', label: 'Block' },
        slug: name,
        information: {
            name,
            label: name,
            shortDescription: name,
            fullDescription: name,
        },
        attributes: { height: 1, stackable, type, nightOnlyPurchase: false },
        functions: { raisedBed: false, recycler: false },
        prices: { sunflowers: 9999 },
        createdAt: timestamp,
        updatedAt: timestamp,
    };
}
const directory = [
    block(1, 'Block_Grass', 'terrain', true),
    block(2, 'HarvestPumpkinSquatOrange', 'decoration', false),
];
function service(options: { directoryDown?: boolean; failure?: boolean } = {}) {
    return createGardenPackPlacementService({
        withAccountTransaction: (accountId, callback) =>
            withSunflowerAccountTransaction(accountId, (tx) =>
                withAccountDeletionFenceTransaction(accountId, callback, tx),
            ),
        withGardenTransaction: withGardenPlacementTransaction,
        getReplay: getGardenPackPlacementReplay,
        getUnit: getGardenPackPlacementUnitForUpdate,
        getSnapshot: getGardenPlacementSnapshotForUpdate,
        getBlockData: async () => {
            if (options.directoryDown) throw new Error('Directory down');
            return directory;
        },
        createBlock: createGardenBlock,
        createStack: createGardenStack,
        updateStack: updateGardenStack,
        recordPlacement: async (command, response, tx) => {
            await recordGardenPackPlacement(command, response, tx);
            if (options.failure) throw new Error('Injected write failure');
        },
    });
}
async function fixture(options: { sandbox?: boolean } = {}) {
    const accountId = randomUUID();
    await storage().insert(accounts).values({ id: accountId });
    const [farm] = await storage()
        .insert(farms)
        .values({ name: 'Pack fixture', latitude: 0, longitude: 0 })
        .returning();
    assert.ok(farm);
    const [garden] = await storage()
        .insert(gardens)
        .values({
            accountId,
            farmId: farm.id,
            name: 'Pack garden',
            isSandbox: options.sandbox ?? false,
        })
        .returning();
    assert.ok(garden);
    const groundId = await createGardenBlock(garden.id, 'Block_Grass');
    await createGardenStack(garden.id, { x: 0, y: 0 });
    await updateGardenStack(garden.id, { x: 0, y: 0, blocks: [groundId] });
    const snapshot = gardenPackProductSnapshotSchema.parse({
        contractVersion: 1,
        productId: 'fixture',
        productVersionId: randomUUID(),
        name: { hr: 'Paket' },
        description: { hr: 'Test' },
        previews: ['https://example.test/fixture.webp'],
        currency: 'sunflower',
        chargedSunflowers: 8,
        publication: 'withdrawn',
        availableFrom: null,
        availableUntil: null,
        policy: {
            versionId: 'v1',
            refunds: 'unused-units-paid-value',
            recycling: 'configured-per-unit-value',
            seasonExpiry: 'retain-owned-units',
            gardenDeletion: 'recycle-placed-units-once',
            accountDeletion: 'detach-owner-retain-audit',
        },
        lines: [
            {
                lineId: 'pumpkin',
                entityId: '2',
                modelName: 'HarvestPumpkinSquatOrange',
                variant: null,
                quantity: 2,
                paidSunflowersByUnit: [4, 4],
                recyclingSunflowersByUnit: [1, 0],
            },
        ],
    });
    const grant = await storage().transaction((tx) =>
        recordPurchasedGardenPack(accountId, randomUUID(), snapshot, tx),
    );
    return {
        accountId,
        gardenId: garden.id,
        purchaseId: grant.purchaseId,
        lineId: 'pumpkin',
        unitOrdinal: 1,
        operationId: randomUUID(),
        position: { x: 0, y: 0 },
        expectedExistingBlocks: [groundId],
        variant: null,
    };
}

async function storedFixture() {
    const command = await fixture();
    const placed = await service()(command);
    assert.ok(placed.ok);
    const box = await createGardenBlock(command.gardenId, 'GardenBox');
    await createGardenStack(command.gardenId, { x: 1, y: 0 });
    await updateGardenStack(command.gardenId, { x: 1, y: 0, blocks: [box] });
    return {
        command,
        placed,
        box,
        store: {
            gardenId: command.gardenId,
            blockId: placed.blockId,
            gardenBoxBlockId: box,
            blockIndex: 1,
            sourcePosition: { x: 0, z: 0 },
            operationId: randomUUID(),
        },
    };
}
test('partial-use refunds use immutable paid allocation and exact request replay without catalogue', {
    skip: !enabled,
}, async () => {
    const command = await fixture();
    assert.ok((await service()(command)).ok);
    const refund = {
        purchaseId: command.purchaseId,
        operationId: randomUUID(),
        units: [{ lineId: 'pumpkin', unitOrdinal: 2 }],
    };
    assert.deepEqual(await refundGardenPackUnits(command.accountId, refund), {
        creditedSunflowers: 4,
        refundedQuantity: 1,
        replayed: false,
    });
    assert.deepEqual(await refundGardenPackUnits(command.accountId, refund), {
        creditedSunflowers: 4,
        refundedQuantity: 1,
        replayed: true,
    });
    await assert.rejects(
        refundGardenPackUnits(command.accountId, {
            ...refund,
            operationId: randomUUID(),
        }),
        /Only unused/,
    );
    await assert.rejects(
        refundGardenPackUnits(command.accountId, {
            ...refund,
            units: [{ lineId: 'pumpkin', unitOrdinal: 1 }],
        }),
        /different contents/,
    );
    assert.equal(
        (await getPurchasedGardenPack(command.accountId, command.purchaseId))
            ?.remainingQuantity,
        0,
    );
    assert.equal(
        (
            await getPurchasedGardenPackAudit(
                command.accountId,
                command.purchaseId,
            )
        ).length,
        2,
    );
});
test('refund failure rolls back earlier units and receipt; foreign owner cannot refund', {
    skip: !enabled,
}, async () => {
    const command = await fixture();
    const refund = {
        purchaseId: command.purchaseId,
        operationId: randomUUID(),
        units: [
            { lineId: 'pumpkin', unitOrdinal: 1 },
            { lineId: 'pumpkin', unitOrdinal: 3 },
        ],
    };
    await assert.rejects(
        refundGardenPackUnits(command.accountId, refund),
        /not found/,
    );
    assert.equal(
        (await getPurchasedGardenPack(command.accountId, command.purchaseId))
            ?.remainingQuantity,
        2,
    );
    assert.equal(
        (
            await getPurchasedGardenPackAudit(
                command.accountId,
                command.purchaseId,
            )
        ).length,
        0,
    );
    await assert.rejects(
        refundGardenPackUnits(randomUUID(), {
            ...refund,
            units: [{ lineId: 'pumpkin', unitOrdinal: 1 }],
        }),
    );
});
test('store/retrieve preserves exact identity, immutable provenance and consumed quantity with repeated store cycles', {
    skip: !enabled,
}, async () => {
    const { command, placed, box, store } = await storedFixture();
    const first = await storeGardenPackBlock(command.accountId, store);
    assert.deepEqual(await storeGardenPackBlock(command.accountId, store), {
        ...first,
        replayed: true,
    });
    const exact = await getGardenBoxStoredPackUnits(
        command.accountId,
        command.gardenId,
        box,
    );
    assert.equal(exact.length, 1);
    assert.equal(exact[0]?.blockId, placed.blockId);
    assert.equal(
        (await getPurchasedGardenPack(command.accountId, command.purchaseId))
            ?.remainingQuantity,
        1,
    );
    const retrieve = {
        purchaseId: command.purchaseId,
        lineId: command.lineId,
        unitOrdinal: 1,
        gardenId: command.gardenId,
        gardenBoxBlockId: box,
        operationId: randomUUID(),
    };
    const callback = async (
        _unit: unknown,
        blockId: string,
        tx: Parameters<
            Parameters<typeof withSunflowerAccountTransaction>[1]
        >[0],
    ) => {
        await updateGardenStack(
            command.gardenId,
            {
                x: 0,
                y: 0,
                blocks: [...command.expectedExistingBlocks, blockId],
            },
            tx,
        );
        return { blockId, variant: null, position: { x: 0, y: 0 } };
    };
    const result = await withStoredGardenPackUnit(
        command.accountId,
        retrieve,
        {
            gardenId: command.gardenId,
            gardenBoxBlockId: box,
            purchaseId: command.purchaseId,
            lineId: command.lineId,
            unitOrdinal: 1,
        },
        callback,
        (r) => r,
    );
    assert.equal(result.blockId, placed.blockId);
    assert.deepEqual(
        await withStoredGardenPackUnit(
            command.accountId,
            retrieve,
            {
                gardenId: command.gardenId,
                gardenBoxBlockId: box,
                purchaseId: command.purchaseId,
                lineId: command.lineId,
                unitOrdinal: 1,
            },
            async () => {
                throw Error('must replay');
            },
            (r) => r,
        ),
        result,
    );
    assert.equal(
        (
            await getGardenBoxStoredPackUnits(
                command.accountId,
                command.gardenId,
                box,
            )
        ).length,
        0,
    );
    await storeGardenPackBlock(command.accountId, {
        ...store,
        operationId: randomUUID(),
    });
    assert.equal(
        (
            await getGardenBoxStoredPackUnits(
                command.accountId,
                command.gardenId,
                box,
            )
        ).length,
        1,
    );
    await assert.rejects(
        storage().transaction(async (tx) => {
            // A previously valid retrieve receipt cannot authorize a new retrieval after another store.
            await tx
                .update(gardenPackUnitLocations)
                .set({
                    gardenBoxBlockId: null,
                    lastOperationId: retrieve.operationId,
                })
                .where(eq(gardenPackUnitLocations.blockId, placed.blockId));
            await tx
                .update(gardenBlocks)
                .set({ isDeleted: false })
                .where(eq(gardenBlocks.id, placed.blockId));
        }),
    );
    const pack = await getPurchasedGardenPack(
        command.accountId,
        command.purchaseId,
    );
    assert.equal(pack?.units[0]?.state, 'placed');
    assert.equal(pack?.units[0]?.blockId, placed.blockId);
    assert.equal(pack?.units[0]?.gardenId, command.gardenId);
});
test('combined ordinary/exact capacity rejects eleven units atomically and continues to enforce six entity types', {
    skip: !enabled,
}, async () => {
    const { command, placed, box, store } = await storedFixture();
    await addGardenBoxInventoryItem(command.accountId, command.gardenId, box, {
        entityTypeName: 'block',
        entityId: '2',
        amount: 10,
    });
    await assert.rejects(
        storeGardenPackBlock(command.accountId, store),
        /najviše/,
    );
    assert.equal(
        (
            await getGardenBoxStoredPackUnits(
                command.accountId,
                command.gardenId,
                box,
            )
        ).length,
        0,
    );
    const snapshot = await storage().transaction((tx) =>
        getGardenPlacementSnapshotForUpdate(command.gardenId, tx),
    );
    assert.ok(snapshot?.blocks.some((b) => b.id === placed.blockId));
});
test('recycle ignores changed catalogue price and credits original configured value once; zero never falls back', {
    skip: !enabled,
}, async () => {
    const command = await fixture();
    const placed = await service()(command);
    assert.ok(placed.ok);
    const input = { gardenId: command.gardenId, blockId: placed.blockId };
    assert.deepEqual(
        await recycleGardenPackUnitForAccount(command.accountId, input),
        { blockId: placed.blockId, refundedSunflowers: 1 },
    );
    assert.deepEqual(
        await recycleGardenPackUnitForAccount(command.accountId, input),
        { blockId: placed.blockId, refundedSunflowers: 1 },
    );
    const second = await service()({
        ...command,
        unitOrdinal: 2,
        operationId: randomUUID(),
    });
    assert.ok(second.ok);
    assert.equal(
        (
            await recycleGardenPackUnitForAccount(command.accountId, {
                gardenId: command.gardenId,
                blockId: second.blockId,
            })
        ).refundedSunflowers,
        0,
    );
    assert.equal(
        (await getPurchasedGardenPack(command.accountId, command.purchaseId))
            ?.remainingQuantity,
        0,
    );
});
test('garden deletion recycles placed and stored units once while unused entitlements survive', {
    skip: !enabled,
}, async () => {
    const { command, store } = await storedFixture();
    await storeGardenPackBlock(command.accountId, store);
    assert.deepEqual(
        await deleteRealGardenForAccount({
            accountId: command.accountId,
            gardenId: command.gardenId,
        }),
        { ok: true, deleted: true },
    );
    assert.deepEqual(
        await deleteRealGardenForAccount({
            accountId: command.accountId,
            gardenId: command.gardenId,
        }),
        { ok: true, deleted: false },
    );
    const pack = await getPurchasedGardenPack(
        command.accountId,
        command.purchaseId,
    );
    assert.equal(pack?.remainingQuantity, 1);
    assert.equal(pack?.units[0]?.state, 'recycled');
    assert.equal(
        (
            await getPurchasedGardenPackAudit(
                command.accountId,
                command.purchaseId,
            )
        ).filter((event) => event.kind === 'recycled').length,
        1,
    );
});
test('account deletion detaches owner and retains immutable nonpersonal audit with no accessible location', {
    skip: !enabled,
}, async () => {
    const { command, store } = await storedFixture();
    await storeGardenPackBlock(command.accountId, store);
    await deleteAccountWithDependencies(command.accountId, randomUUID());
    assert.equal(
        await getPurchasedGardenPack(command.accountId, command.purchaseId),
        undefined,
    );
    const [purchase] = await storage()
        .select()
        .from(gardenPackPurchases)
        .where(eq(gardenPackPurchases.id, command.purchaseId));
    assert.equal(purchase?.accountId, null);
    assert.equal(
        (
            await storage()
                .select()
                .from(gardenPackUnitLocations)
                .where(
                    eq(gardenPackUnitLocations.purchaseId, command.purchaseId),
                )
        ).length,
        0,
    );
    await assert.rejects(
        storage()
            .update(gardenPackPurchases)
            .set({ chargedSunflowers: 99 })
            .where(eq(gardenPackPurchases.id, command.purchaseId)),
    );
});
test('stack PATCH uses exact expected source and original allocation, repeats once and rejects foreign owner', {
    skip: !enabled,
}, async () => {
    const command = await fixture();
    const placed = await service()(command);
    assert.ok(placed.ok);
    const { patchGardenStacksForAccount } = await import(
        './gardenStacksPatchService'
    );
    const patch = {
        accountId: command.accountId,
        gardenId: command.gardenId,
        operations: [
            { op: 'test', path: '/0/0/1', value: placed.blockId },
            { op: 'remove', path: '/0/0/1' },
        ],
    } satisfies Parameters<typeof patchGardenStacksForAccount>[0];
    assert.equal(
        (
            await patchGardenStacksForAccount({
                ...patch,
                accountId: randomUUID(),
            })
        ).ok,
        false,
    );
    const stale = {
        ...patch,
        operations: [
            { op: 'test', path: '/0/0/0', value: placed.blockId },
            { op: 'remove', path: '/0/0/0' },
        ],
    } satisfies Parameters<typeof patchGardenStacksForAccount>[0];
    assert.equal((await patchGardenStacksForAccount(stale)).ok, false);
    const first = await patchGardenStacksForAccount(patch);
    assert.ok(first.ok);
    assert.equal(first.refundedSunflowers, 1);
    assert.deepEqual(await patchGardenStacksForAccount(patch), first);
});
test('SQL guards reject missing physical identity, appearance changes, and unaudited stored retrieval', {
    skip: !enabled,
}, async () => {
    const { command, placed, store } = await storedFixture();
    await assert.rejects(
        storage()
            .delete(gardenPackUnitLocations)
            .where(eq(gardenPackUnitLocations.blockId, placed.blockId)),
    );
    await assert.rejects(
        storage()
            .update(gardenPackUnitLocations)
            .set({ unitOrdinal: 2 })
            .where(eq(gardenPackUnitLocations.blockId, placed.blockId)),
    );
    await assert.rejects(
        storage()
            .update(gardenBlocks)
            .set({ variant: 9 })
            .where(eq(gardenBlocks.id, placed.blockId)),
    );
    await storeGardenPackBlock(command.accountId, store);
    await assert.rejects(
        storage().transaction(async (tx) => {
            await tx
                .update(gardenPackUnitLocations)
                .set({ gardenBoxBlockId: null, lastOperationId: null })
                .where(eq(gardenPackUnitLocations.blockId, placed.blockId));
            await tx
                .update(gardenBlocks)
                .set({ isDeleted: false })
                .where(eq(gardenBlocks.id, placed.blockId));
        }),
    );
    assert.equal(
        (
            await getGardenBoxStoredPackUnits(
                command.accountId,
                command.gardenId,
                store.gardenBoxBlockId,
            )
        ).length,
        1,
    );
});

test('retrieve follows the exact receipt pointer even when transaction timestamps sort before storage', {
    skip: !enabled,
}, async () => {
    const { command, box, store } = await storedFixture();
    await storeGardenPackBlock(command.accountId, store);
    const input = {
        purchaseId: command.purchaseId,
        lineId: command.lineId,
        unitOrdinal: 1,
        operationId: randomUUID(),
        gardenId: command.gardenId,
        gardenBoxBlockId: box,
    };
    // Simulate a transaction begun before the store but serialized after it.
    await storage().execute(
        sql.raw(
            "CREATE FUNCTION fixture_earlier_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind = 'retrieve' THEN NEW.created_at := '2000-01-01'; END IF; RETURN NEW; END $$",
        ),
    );
    await storage().execute(
        sql.raw(
            'CREATE TRIGGER fixture_earlier_receipt BEFORE INSERT ON garden_pack_lifecycle_receipts FOR EACH ROW EXECUTE FUNCTION fixture_earlier_receipt()',
        ),
    );
    try {
        const result = await withStoredGardenPackUnit(
            command.accountId,
            input,
            input,
            async (_unit, blockId, innerTx) => {
                await updateGardenStack(
                    command.gardenId,
                    {
                        x: 0,
                        y: 0,
                        blocks: [...command.expectedExistingBlocks, blockId],
                    },
                    innerTx,
                );
                return { blockId, variant: null, position: { x: 0, y: 0 } };
            },
            (response) => response,
        );
        assert.ok(result.blockId);
    } finally {
        await storage().execute(
            sql.raw(
                'DROP TRIGGER fixture_earlier_receipt ON garden_pack_lifecycle_receipts',
            ),
        );
        await storage().execute(
            sql.raw('DROP FUNCTION fixture_earlier_receipt()'),
        );
    }
    const [location] = await storage()
        .select()
        .from(gardenPackUnitLocations)
        .where(eq(gardenPackUnitLocations.purchaseId, command.purchaseId));
    assert.equal(location?.lastOperationId, input.operationId);
});

test('retrieve rejects ambiguous or newly ineligible catalogue contents without changing the stored entitlement', {
    skip: !enabled,
}, async () => {
    const { command, box, store } = await storedFixture();
    await storeGardenPackBlock(command.accountId, store);
    const original = directory[1];
    assert.ok(original);
    const malformedDirectories = [
        [...directory, { ...original }],
        [...directory, { ...original, id: 99 }],
        [
            directory[0],
            {
                ...original,
                attributes: { ...original.attributes, type: 'terrain' },
            },
        ],
        [
            directory[0],
            {
                ...original,
                functions: { ...original.functions, recycler: true },
            },
        ],
        [
            directory[0],
            {
                ...original,
                functions: { ...original.functions, raisedBed: true },
            },
        ],
    ];
    for (const contents of malformedDirectories) {
        const retrieve = createGardenPackLifecycleService({
            getBlockData: async () =>
                contents.filter((entry): entry is BlockData => Boolean(entry)),
        });
        await assert.rejects(
            retrieve(command.accountId, {
                purchaseId: command.purchaseId,
                lineId: command.lineId,
                unitOrdinal: 1,
                operationId: randomUUID(),
                gardenId: command.gardenId,
                gardenBoxBlockId: box,
            }),
        );
        assert.equal(
            (
                await getGardenBoxStoredPackUnits(
                    command.accountId,
                    command.gardenId,
                    box,
                )
            ).length,
            1,
        );
    }
});
