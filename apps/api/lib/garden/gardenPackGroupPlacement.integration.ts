import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import type { BlockData } from '@gredice/directory-types';
import { autumnArrangements } from '@gredice/js/autumnArrangements';
import {
    getGardenPackLayoutCells,
    resolveGardenPackLayoutPlacements,
} from '@gredice/js/gardenPackLayouts';
import {
    accounts,
    closeStorage,
    createGardenBlock,
    createGardenStack,
    earnSunflowersOnce,
    farms,
    gardenBlocks,
    gardenPackGroupMemberOperationId,
    gardenPackUnitEvents,
    gardenPackUnits,
    gardens,
    getGardenPackPlacementReplay,
    getGardenPlacementSnapshotForUpdate,
    getPurchasedGardenPack,
    listGardenRaisedBedMetadataForUpdate,
    recordPurchasedGardenPack,
    recycleGardenPackUnitForAccount,
    softDeleteGardenBlockOnce,
    softDeleteNewRaisedBedOnce,
    storage,
    storeGardenPackBlock,
    sunflowerLedgerEntries,
    updateGardenBlock,
    updateGardenStack,
    updateRaisedBedOrientation,
    withAccountDeletionFenceTransaction,
    withGardenPlacementTransaction,
    withStoredGardenPackUnit,
    withSunflowerAccountTransaction,
} from '@gredice/storage';
import { gardenPackProductSnapshotSchema } from '@gredice/storage/gardenPackContract';
import type { GardenPackGroupPlacementCommand } from '@gredice/storage/gardenPackGroupPlacementContract';
import { gardenPackPlacementBodySchema } from '@gredice/storage/gardenPackPlacementContract';
import { and, eq } from 'drizzle-orm';
import { createGardenBlockMutationService } from './gardenBlockMutationService';
import {
    createGardenPackGroupPlacementService,
    gardenPackGroupPlacementDependencies,
} from './gardenPackGroupPlacementService';
import { prepareGardenPackIntegrationSchema } from './gardenPackIntegrationSchema';
import { getOwnedGardenPackLayouts } from './gardenPackLayouts';
import { planGardenStacksPatch } from './gardenStacksPatchPlanner';
import { createGardenStacksPatchService } from './gardenStacksPatchService';
import { validateRotatedBlockPlacement } from './rotatedBlockPlacementValidation';

before(prepareGardenPackIntegrationSchema);
after(closeStorage);
const timestamp = '2026-10-01T00:00:00Z';
function block(
    id: number,
    name: string,
    width = 1,
    stackable = false,
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
        attributes: {
            height: 1,
            type: stackable ? 'terrain' : 'decoration',
            stackable,
            spanWidth: width,
            spanDepth: 1,
            nightOnlyPurchase: false,
        },
        functions: { raisedBed: false, recycler: false },
        prices: { sunflowers: 9999 },
        createdAt: timestamp,
        updatedAt: timestamp,
    };
}
const models = [
    ...new Set(
        autumnArrangements.flatMap((a) =>
            a.placements
                .filter((p) => p.role === 'included')
                .map((p) => p.entityName),
        ),
    ),
];
const directory = [
    block(1, 'Block_Grass', 1, true),
    ...models.map((name, index) =>
        block(
            index + 2,
            name,
            ['FallenLog', 'AutumnBlanketBench'].includes(name) ? 2 : 1,
        ),
    ),
];
function service(
    options: {
        down?: boolean;
        fail?: boolean;
        blocks?: BlockData[];
        prepare?: () => Promise<void>;
    } = {},
) {
    return createGardenPackGroupPlacementService({
        ...gardenPackGroupPlacementDependencies,
        getBlockData: async () => {
            await options.prepare?.();
            if (options.down) throw new Error('Unavailable');
            return options.blocks ?? directory;
        },
        recordGroup: async (...args) => {
            await gardenPackGroupPlacementDependencies.recordGroup(...args);
            if (options.fail) throw new Error('Injected rollback');
        },
    });
}
async function fixture(index = 0, rotation = 0) {
    const arrangement = autumnArrangements[index];
    assert.ok(arrangement);
    const productId = ['autumn-harvest', 'autumn-woodland', 'autumn-evening'][
        index
    ];
    const accountId = randomUUID();
    await storage().insert(accounts).values({ id: accountId });
    const [farm] = await storage()
        .insert(farms)
        .values({ name: 'Private group fixture', latitude: 0, longitude: 0 })
        .returning();
    assert.ok(farm);
    const [garden] = await storage()
        .insert(gardens)
        .values({ accountId, farmId: farm.id, name: 'Group fixture' })
        .returning();
    assert.ok(garden);
    const snapshot = gardenPackProductSnapshotSchema.parse({
        contractVersion: 1,
        productId,
        productVersionId: randomUUID(),
        name: { hr: 'Fixture' },
        description: { hr: 'Private test' },
        previews: ['https://example.test/group.png'],
        currency: 'sunflower',
        chargedSunflowers: 16,
        publication: 'withdrawn',
        availableFrom: null,
        availableUntil: null,
        policy: {
            versionId: 'fixture:v1',
            refunds: 'unused-units-paid-value',
            recycling: 'configured-per-unit-value',
            seasonExpiry: 'retain-owned-units',
            gardenDeletion: 'recycle-placed-units-once',
            accountDeletion: 'detach-owner-retain-audit',
        },
        lines: arrangement.placements
            .filter((p) => p.role === 'included')
            .map((p) => {
                const row = directory.find(
                    (row) => row.information.name === p.entityName,
                );
                assert.ok(row);
                return {
                    lineId: p.entityName,
                    entityId: String(row.id),
                    modelName: p.entityName,
                    variant: null,
                    quantity: 1,
                    paidSunflowersByUnit: [4],
                    recyclingSunflowersByUnit: [1],
                };
            }),
    });
    const grant = await storage().transaction((tx) =>
        recordPurchasedGardenPack(accountId, randomUUID(), snapshot, tx),
    );
    const pack = await getPurchasedGardenPack(accountId, grant.purchaseId);
    assert.ok(pack);
    const layout = getOwnedGardenPackLayouts(pack)[0];
    assert.ok(layout);
    assert.equal(
        getOwnedGardenPackLayouts({ ...pack, units: [] })[0]?.versionId,
        layout.versionId,
    );
    assert.notEqual(
        getOwnedGardenPackLayouts({
            ...pack,
            snapshot: { ...pack.snapshot, productVersionId: randomUUID() },
        })[0]?.versionId,
        layout.versionId,
    );
    assert.deepEqual(
        getOwnedGardenPackLayouts({
            ...pack,
            snapshot: { ...pack.snapshot, productId: 'unsupported' },
        }),
        [],
    );

    const anchor = { x: 10, y: 10 };
    const cells = getGardenPackLayoutCells(
        resolveGardenPackLayoutPlacements(layout, anchor, rotation),
    );
    const expectedStacks = [];
    for (const cell of cells) {
        const ground = await createGardenBlock(garden.id, 'Block_Grass');
        await createGardenStack(garden.id, {
            x: cell.positionX,
            y: cell.positionY,
        });
        await updateGardenStack(garden.id, {
            x: cell.positionX,
            y: cell.positionY,
            blocks: [ground],
        });
        expectedStacks.push({ ...cell, blocks: [ground] });
    }
    const command: GardenPackGroupPlacementCommand = {
        accountId,
        expectedAccountId: accountId,
        purchaseId: grant.purchaseId,
        layoutId: layout.id,
        layoutVersionId: layout.versionId,
        operationId: randomUUID(),
        gardenId: garden.id,
        anchor,
        rotation,
        units: layout.placements.map((p) => ({
            slotId: p.slotId,
            lineId: p.lineId,
            unitOrdinal: 1,
        })),
        expectedStacks,
    };
    return { command, layout };
}
async function count(command: GardenPackGroupPlacementCommand) {
    return {
        units: (
            await getPurchasedGardenPack(command.accountId, command.purchaseId)
        )?.remainingQuantity,
        blocks: (
            await storage()
                .select()
                .from(gardenBlocks)
                .where(eq(gardenBlocks.gardenId, command.gardenId))
        ).length,
        receipts: (
            await storage()
                .select()
                .from(gardenPackUnitEvents)
                .where(eq(gardenPackUnitEvents.purchaseId, command.purchaseId))
        ).length,
        wallet: (
            await storage()
                .select()
                .from(sunflowerLedgerEntries)
                .where(eq(sunflowerLedgerEntries.accountId, command.accountId))
        ).length,
    };
}
test('three exact pilot layouts persist all four turns, reviewed multi-cell footprints, fixed variants and zero charge', async () => {
    for (let index = 0; index < 3; index++)
        for (let rotation = 0; rotation < 4; rotation++) {
            const { command, layout } = await fixture(index, rotation);
            const previous = await count(command);
            const result = await service()(command);
            assert.ok(result.ok);
            assert.equal(result.chargedSunflowers, 0);
            assert.deepEqual(
                result.placements.map((p) => ({
                    position: p.position,
                    rotation: p.rotation,
                })),
                resolveGardenPackLayoutPlacements(
                    layout,
                    command.anchor,
                    rotation,
                ).map((p) => ({ position: p.position, rotation: p.rotation })),
            );
            const persisted = await storage()
                .select()
                .from(gardenBlocks)
                .where(eq(gardenBlocks.gardenId, command.gardenId));
            for (const placement of result.placements) {
                const row = persisted.find((b) => b.id === placement.blockId);
                assert.equal(row?.rotation, rotation);
                assert.equal(row?.variant, null);
            }
            assert.deepEqual(await count(command), {
                ...previous,
                units: 0,
                blocks: previous.blocks + 4,
                receipts: 4,
            });
        }
});
test('exact replay survives directory outage; payload mismatch and single/group cross-kind replay conflict', async () => {
    const { command } = await fixture(1, 1);
    const first = await service()(command);
    assert.ok(first.ok);
    assert.deepEqual(await service({ down: true })(command), {
        ...first,
        replayed: true,
    });
    const previous = await count(command);
    for (const changed of [
        { ...command, anchor: { x: 0, y: 0 } },
        { ...command, rotation: 2 },
        { ...command, layoutVersionId: 'changed' },
        { ...command, units: command.units.slice(1) },
        { ...command, expectedStacks: [...command.expectedStacks].reverse() },
    ]) {
        const result = await service()(changed);
        assert.ok(!result.ok);
        assert.equal(result.code, 'OPERATION_CONFLICT');
    }
    const root = first.placements[0];
    assert.ok(root);
    await assert.rejects(
        getGardenPackPlacementReplay({
            accountId: command.accountId,
            purchaseId: command.purchaseId,
            gardenId: command.gardenId,
            operationId: command.operationId,
            lineId: root.lineId,
            unitOrdinal: root.unitOrdinal,
            position: root.position,
            expectedExistingBlocks: root.existingBlocks,
            variant: null,
        }),
    );
    const childId = gardenPackGroupMemberOperationId(command, 1);
    assert.ok(childId.length > 96 && childId.length <= 128);
    assert.equal(
        gardenPackPlacementBodySchema.safeParse({
            gardenId: command.gardenId,
            operationId: childId,
            position: root.position,
            expectedExistingBlocks: [],
            variant: null,
        }).success,
        false,
    );
    assert.deepEqual(await count(command), previous);
});
test('missing quantity, foreign owner/garden, stale layout and expected account fail before any writes', async () => {
    const { command } = await fixture();
    const other = await fixture();
    const previous = await count(command);
    for (const changed of [
        {
            ...command,
            units: command.units.map((u, i) =>
                i ? u : { ...u, unitOrdinal: 2 },
            ),
        },
        {
            ...command,
            accountId: other.command.accountId,
            expectedAccountId: other.command.accountId,
        },
        { ...command, gardenId: other.command.gardenId },
        { ...command, layoutVersionId: 'changed' },
    ]) {
        const result = await service()(changed);
        assert.ok(!result.ok);
    }
    const fenced = await service({
        prepare: async () => assert.fail('Owner mismatch accessed directory'),
    })({ ...command, expectedAccountId: randomUUID() });
    assert.ok(!fenced.ok);
    assert.equal(fenced.code, 'EXPECTED_ACCOUNT_MISMATCH');
    assert.deepEqual(await count(command), previous);
});
test('changed non-anchor multi-cell stack, structures and ambiguous directory fail all-or-none', async () => {
    for (let rotation = 0; rotation < 4; rotation++) {
        const { command, layout } = await fixture(1, rotation);
        const log = resolveGardenPackLayoutPlacements(
            layout,
            command.anchor,
            rotation,
        ).find((p) => p.modelName === 'FallenLog');
        assert.ok(log);
        const cell = getGardenPackLayoutCells([log]).find(
            (c) =>
                c.positionX !== log.position.x ||
                c.positionY !== log.position.y,
        );
        assert.ok(cell);
        const old = command.expectedStacks.find(
            (c) =>
                c.positionX === cell.positionX &&
                c.positionY === cell.positionY,
        );
        assert.ok(old);
        const blocker = await createGardenBlock(command.gardenId, 'RaisedBed');
        await updateGardenStack(command.gardenId, {
            x: cell.positionX,
            y: cell.positionY,
            blocks: [...old.blocks, blocker],
        });
        const previous = await count(command);
        const stale = await service()(command);
        assert.ok(!stale.ok);
        assert.equal(stale.code, 'GARDEN_STATE_CHANGED');
        const updated = {
            ...command,
            expectedStacks: command.expectedStacks.map((c) =>
                c === old ? { ...c, blocks: [...c.blocks, blocker] } : c,
            ),
        };
        const collision = await service()(updated);
        assert.ok(!collision.ok);
        assert.equal(collision.code, 'GROUP_PLACEMENT_INVALID');
        assert.deepEqual(await count(command), previous);
    }
    const { command } = await fixture();
    const previous = await count(command);
    const row = directory[1];
    assert.ok(row);
    assert.ok(!(await service({ blocks: [...directory, row] })(command)).ok);
    assert.deepEqual(await count(command), previous);
});
test('injected failure after writing all placements rolls back physical blocks, stacks, receipts and quantities', async () => {
    const { command } = await fixture(2, 3);
    const previous = await count(command);
    await assert.rejects(service({ fail: true })(command), /Injected rollback/);
    assert.deepEqual(await count(command), previous);
    assert.ok((await service()(command)).ok);
});
test('concurrent identical UUID submissions return one durable response; competing placements consume each unit once', async () => {
    const { command } = await fixture(1);
    const [a, b] = await Promise.all([service()(command), service()(command)]);
    assert.ok(a.ok && b.ok);
    assert.deepEqual({ ...a, replayed: false }, { ...b, replayed: false });
    assert.equal(Number(a.replayed) + Number(b.replayed), 1);
    const competing = await fixture(2);
    const results = await Promise.all([
        service()(competing.command),
        service()({ ...competing.command, operationId: randomUUID() }),
    ]);
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.equal((await count(competing.command)).receipts, 4);
});
test('group provenance survives individual rotate/move, box store/retrieve and original-price recycling', async () => {
    const { command } = await fixture(1, 1);
    const result = await service()(command);
    assert.ok(result.ok);
    const piece = result.placements.find((p) => p.modelName === 'FallenLog');
    assert.ok(piece);
    const moved = { x: 30, y: 30 };
    const dependencies = {
        bustScheduleCache: async () => {},
        earnSunflowersOnce,
        getBlockData: async () => directory,
        getGardenPlacementSnapshotForUpdate,
        listGardenRaisedBedMetadataForUpdate,
        softDeleteGardenBlockOnce,
        softDeleteNewRaisedBedOnce,
        updateGardenBlock,
        updateGardenStack,
        updateRaisedBedOrientation,
        validateRotatedBlockPlacement,
        withAccountDeletionFenceTransaction,
        withGardenPlacementTransaction,
        withSunflowerAccountTransaction,
    };
    for (const position of [
        { x: piece.position.x + 1, y: piece.position.y },
        moved,
        { x: moved.x + 1, y: moved.y },
    ]) {
        const ground = await createGardenBlock(command.gardenId, 'Block_Grass');
        await createGardenStack(command.gardenId, position);
        await updateGardenStack(command.gardenId, {
            ...position,
            blocks: [ground],
        });
    }
    const rotated = await createGardenBlockMutationService(
        dependencies,
    ).updateGardenBlockForAccount({
        accountId: command.accountId,
        gardenId: command.gardenId,
        blockId: piece.blockId,
        rotation: 0,
    });
    assert.ok(rotated.ok);
    const moving = createGardenStacksPatchService({
        ...dependencies,
        createGardenStack,
        planGardenStacksPatch,
    });
    const movedResult = await moving({
        accountId: command.accountId,
        gardenId: command.gardenId,
        operations: [
            {
                op: 'test',
                path: `/${piece.position.x}/${piece.position.y}/1`,
                value: piece.blockId,
            },
            {
                op: 'move',
                from: `/${piece.position.x}/${piece.position.y}/1`,
                path: `/${moved.x}/${moved.y}/-`,
            },
        ],
    });
    assert.ok(movedResult.ok);
    const movedSnapshot = await storage().transaction((tx) =>
        getGardenPlacementSnapshotForUpdate(command.gardenId, tx),
    );
    assert.ok(movedSnapshot);
    const movedGround = movedSnapshot.stacks.find(
        (s) => s.positionX === moved.x && s.positionY === moved.y,
    )?.blocks[0];
    assert.ok(movedGround);
    const box = await createGardenBlock(command.gardenId, 'GardenBox');
    await createGardenStack(command.gardenId, { x: 29, y: 30 });
    await updateGardenStack(command.gardenId, { x: 29, y: 30, blocks: [box] });
    await storeGardenPackBlock(command.accountId, {
        gardenId: command.gardenId,
        blockId: piece.blockId,
        gardenBoxBlockId: box,
        sourcePosition: { x: moved.x, z: moved.y },
        blockIndex: 1,
        operationId: randomUUID(),
    });
    const identity = {
        purchaseId: command.purchaseId,
        lineId: piece.lineId,
        unitOrdinal: piece.unitOrdinal,
        gardenId: command.gardenId,
        gardenBoxBlockId: box,
    };
    const retrieved = await withStoredGardenPackUnit(
        command.accountId,
        { ...identity, operationId: randomUUID() },
        identity,
        async (_unit, blockId, tx) => {
            await updateGardenStack(
                command.gardenId,
                { ...moved, blocks: [movedGround, blockId] },
                tx,
            );
            return { blockId, variant: null, position: moved };
        },
        (response) => response,
    );
    assert.equal(retrieved.blockId, piece.blockId);
    const recycled = await recycleGardenPackUnitForAccount(command.accountId, {
        gardenId: command.gardenId,
        blockId: piece.blockId,
        expectedSource: { ...moved, blockIndex: 1 },
    });
    const pack = await getPurchasedGardenPack(
        command.accountId,
        command.purchaseId,
    );
    assert.equal(
        pack?.units.find((u) => u.lineId === piece.lineId)?.state,
        'recycled',
    );
    const ledger = await storage()
        .select()
        .from(sunflowerLedgerEntries)
        .where(eq(sunflowerLedgerEntries.accountId, command.accountId));
    assert.equal(recycled.refundedSunflowers, 1);
    assert.equal(ledger.length, 0);
    const audit = await storage()
        .select()
        .from(gardenPackUnitEvents)
        .where(eq(gardenPackUnitEvents.purchaseId, command.purchaseId));
    assert.equal(
        audit.find((e) => e.kind === 'recycled')?.creditedSunflowers,
        1,
    );
    assert.deepEqual(await service({ down: true })(command), {
        ...result,
        replayed: true,
    });
});

test('derived member ID collisions and ordinary/lifecycle root IDs conflict before group writes', async () => {
    const { command } = await fixture();
    const unit = command.units[1];
    assert.ok(unit);
    const childId = gardenPackGroupMemberOperationId(command, 1);
    await storage().transaction(async (tx) => {
        await tx.insert(gardenPackUnitEvents).values({
            id: randomUUID(),
            accountId: command.accountId,
            purchaseId: command.purchaseId,
            lineId: unit.lineId,
            unitOrdinal: unit.unitOrdinal,
            operationId: childId,
            kind: 'refunded',
            creditedSunflowers: 4,
        });
        await tx
            .update(gardenPackUnits)
            .set({ state: 'refunded' })
            .where(
                and(
                    eq(gardenPackUnits.purchaseId, command.purchaseId),
                    eq(gardenPackUnits.lineId, unit.lineId),
                    eq(gardenPackUnits.unitOrdinal, unit.unitOrdinal),
                ),
            );
    });
    const previous = await count(command);
    const result = await service()(command);
    assert.ok(!result.ok);
    assert.equal(result.code, 'OPERATION_CONFLICT');
    assert.deepEqual(await count(command), previous);
    const second = await fixture();
    const first = await service()(second.command);
    assert.ok(first.ok);
    const piece = first.placements[0];
    assert.ok(piece);
    const box = await createGardenBlock(second.command.gardenId, 'GardenBox');
    await createGardenStack(second.command.gardenId, { x: 25, y: 25 });
    await updateGardenStack(second.command.gardenId, {
        x: 25,
        y: 25,
        blocks: [box],
    });
    const store = {
        gardenId: second.command.gardenId,
        blockId: piece.blockId,
        gardenBoxBlockId: box,
        sourcePosition: { x: piece.position.x, z: piece.position.y },
        blockIndex: 1,
        operationId: second.command.operationId,
    };
    await assert.rejects(storeGardenPackBlock(second.command.accountId, store));
    const operationId = randomUUID();
    await storeGardenPackBlock(second.command.accountId, {
        ...store,
        operationId,
    });
    const replay = await service()({ ...second.command, operationId });
    assert.ok(!replay.ok);
    assert.equal(replay.code, 'OPERATION_CONFLICT');
});
test('dependency preparation reads storage outside the account transaction and unavailable directory writes nothing', async () => {
    const { command } = await fixture();
    const previous = await count(command);
    assert.ok(
        (
            await service({
                prepare: async () => {
                    assert.ok(
                        (
                            await storage()
                                .select()
                                .from(accounts)
                                .where(eq(accounts.id, command.accountId))
                        ).length,
                    );
                },
            })(command)
        ).ok,
    );
    const other = await fixture();
    const unchanged = await count(other.command);
    const result = await service({ down: true })(other.command);
    assert.ok(!result.ok);
    assert.equal(result.status, 503);
    assert.deepEqual(await count(other.command), unchanged);
    assert.equal(previous.wallet, 0);
});
