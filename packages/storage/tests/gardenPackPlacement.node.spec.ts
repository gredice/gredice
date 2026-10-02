import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import type { BlockData } from '@gredice/directory-types';
import {
    accounts,
    closeStorage,
    createGardenBlock,
    createGardenStack,
    deleteGardenBlock,
    events,
    farms,
    GardenPackLifecyclePendingError,
    gardenBlocks,
    gardens,
    getGardenPackPlacementReplay,
    getGardenPackPlacementUnitForUpdate,
    getGardenPlacementSnapshotForUpdate,
    getPurchasedGardenPack,
    getPurchasedGardenPackAudit,
    recordGardenPackPlacement,
    recordPurchasedGardenPack,
    softDeleteGardenBlockOnce,
    softDeleteGardenOnce,
    storage,
    updateGardenBlock,
    updateGardenStack,
    withAccountDeletionFenceTransaction,
    withGardenPlacementTransaction,
    withSunflowerAccountTransaction,
} from '@gredice/storage';
import { gardenPackProductSnapshotSchema } from '@gredice/storage/gardenPackContract';
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api';
import { eq, sql } from 'drizzle-orm';
import { createGardenPackPlacementService } from '../../../apps/api/lib/garden/gardenPackPlacementService';
import * as completeSchema from '../src/schema';
import { gardenPackIntegritySql } from '../src/schema/gardenPackIntegrity';

const enabled =
    process.env.TEST_ENV === '1' &&
    process.env.GREDICE_PACK_PLACEMENT_TEST === '1';
before(async () => {
    if (!enabled) return;
    const statements = await generateMigration(
        generateDrizzleJson({}),
        generateDrizzleJson(completeSchema),
    );
    // Drizzle emits some foreign keys before their supporting unique indexes.
    const foreignKeys = statements.filter((statement) =>
        statement.includes('FOREIGN KEY'),
    );
    for (const statement of [
        ...statements.filter((statement) => !statement.includes('FOREIGN KEY')),
        ...foreignKeys,
    ])
        await storage().execute(sql.raw(statement));
    await storage().execute(sql.raw(gardenPackIntegritySql));
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
            await options.prepare?.();
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
        chargedSunflowers: 4,
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
                quantity: 1,
                paidSunflowersByUnit: [4],
                recyclingSunflowersByUnit: [1],
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
test('real transaction: no debit, exact replay without directory, and full command conflicts', {
    skip: !enabled,
}, async () => {
    const command = await fixture();
    const first = await service()(command);
    assert.ok(first.ok);
    const audit = await getPurchasedGardenPackAudit(
        command.accountId,
        command.purchaseId,
    );
    assert.equal(audit.length, 1);
    assert.equal(audit[0]?.creditedSunflowers, 0);
    assert.deepEqual(await service({ directoryDown: true })(command), {
        ...first,
        replayed: true,
    });
    for (const changed of [
        { ...command, gardenId: command.gardenId + 1 },
        { ...command, position: { x: 1, y: 0 } },
        { ...command, unitOrdinal: 2 },
        { ...command, expectedExistingBlocks: [] },
        {
            ...command,
            variant: {
                versionId: 'entity-appearance:v1',
                appearance: { id: 'bay' },
            },
        },
    ]) {
        const result = await service()(changed);
        assert.ok(!result.ok);
        assert.equal(result.code, 'OPERATION_CONFLICT');
    }
    assert.equal(
        (
            await storage()
                .select()
                .from(events)
                .where(eq(events.aggregateId, command.accountId))
        ).length,
        0,
    );
    const pack = await getPurchasedGardenPack(
        command.accountId,
        command.purchaseId,
    );
    assert.equal(pack?.remainingQuantity, 0);
});
test('real multiconnection last-unit race grants one block and one receipt', {
    skip: !enabled,
}, async () => {
    const command = await fixture();
    const results = await Promise.all([
        service()(command),
        service()({ ...command, operationId: randomUUID() }),
    ]);
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.equal(
        (
            await getPurchasedGardenPackAudit(
                command.accountId,
                command.purchaseId,
            )
        ).length,
        1,
    );
    assert.equal(
        (
            await storage()
                .select()
                .from(gardenBlocks)
                .where(eq(gardenBlocks.gardenId, command.gardenId))
        ).length,
        2,
    );
});
test('foreign owner, foreign garden, sandbox, full space and wrong appearance preserve quantity', {
    skip: !enabled,
}, async () => {
    const command = await fixture();
    const foreign = await fixture();
    const sandbox = await fixture({ sandbox: true });
    const full = await fixture();
    const occupying = await createGardenBlock(
        full.gardenId,
        'HarvestPumpkinSquatOrange',
    );
    await updateGardenStack(full.gardenId, {
        x: 0,
        y: 0,
        blocks: [...full.expectedExistingBlocks, occupying],
    });
    for (const changed of [
        { ...command, accountId: foreign.accountId },
        { ...command, gardenId: foreign.gardenId },
        { ...sandbox },
        {
            ...full,
            expectedExistingBlocks: [...full.expectedExistingBlocks, occupying],
        },
        {
            ...command,
            variant: {
                versionId: 'entity-appearance:v1',
                appearance: { id: 'bay' },
            },
        },
    ])
        assert.equal((await service()(changed)).ok, false);
    assert.equal(
        (await getPurchasedGardenPack(command.accountId, command.purchaseId))
            ?.remainingQuantity,
        1,
    );
});
test('failure after consumption rolls block, stack, quantity and receipt back', {
    skip: !enabled,
}, async () => {
    const command = await fixture();
    await assert.rejects(service({ failure: true })(command), /Injected/);
    assert.equal(
        (await getPurchasedGardenPack(command.accountId, command.purchaseId))
            ?.remainingQuantity,
        1,
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
    assert.equal(
        (
            await storage()
                .select()
                .from(gardenBlocks)
                .where(eq(gardenBlocks.gardenId, command.gardenId))
        ).length,
        1,
    );
});
test('ordinary move remains allowed but unsafe store/recycle/variant/garden deletion fail closed', {
    skip: !enabled,
}, async () => {
    const command = await fixture();
    const result = await service()(command);
    assert.ok(result.ok);
    await assert.rejects(
        deleteGardenBlock(command.gardenId, result.blockId),
        GardenPackLifecyclePendingError,
    );
    await assert.rejects(
        storage().transaction((tx) =>
            softDeleteGardenBlockOnce(command.gardenId, result.blockId, tx),
        ),
        GardenPackLifecyclePendingError,
    );
    await assert.rejects(
        updateGardenBlock(command.gardenId, { id: result.blockId, variant: 1 }),
        GardenPackLifecyclePendingError,
    );
    await assert.rejects(
        storage().transaction((tx) =>
            softDeleteGardenOnce(command.gardenId, tx),
        ),
        GardenPackLifecyclePendingError,
    );
    assert.equal(
        await updateGardenBlock(command.gardenId, {
            id: result.blockId,
            rotation: 1,
        }),
        true,
    );
    assert.equal(
        (await getPurchasedGardenPack(command.accountId, command.purchaseId))
            ?.remainingQuantity,
        0,
    );
});

test('directory preparation performs real shared-client reads before economic locks', {
    skip: !enabled,
}, async () => {
    const command = await fixture();
    let reads = 0;
    const result = await service({
        prepare: async () => {
            await withSunflowerAccountTransaction(
                command.accountId,
                async (tx) => {
                    const rows = await tx
                        .select({ id: gardens.id })
                        .from(gardens)
                        .where(eq(gardens.id, command.gardenId));
                    assert.equal(rows.length, 1);
                    reads++;
                },
            );
            await storage()
                .select({ id: gardens.id })
                .from(gardens)
                .where(eq(gardens.id, command.gardenId));
        },
    })(command);
    assert.equal(result.ok, true);
    assert.equal(reads, 1);
});

test('a concurrent exact receipt committed during failed preparation wins over directory outage', {
    skip: !enabled,
}, async () => {
    const command = await fixture();
    const result = await service({
        prepare: async () => {
            assert.equal((await service()(command)).ok, true);
            throw new Error('Preparation outage after competing commit');
        },
    })(command);
    assert.equal(result.ok && result.replayed, true);
    assert.equal(
        (
            await getPurchasedGardenPackAudit(
                command.accountId,
                command.purchaseId,
            )
        ).length,
        1,
    );
});
