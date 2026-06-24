import assert from 'node:assert/strict';
import test from 'node:test';
import {
    accountHasActiveRaisedBed,
    countRaisedBedsByAccount,
    createAccount,
    createDefaultGardenForAccount,
    createEvent,
    createGardenBlock,
    createGardenStack,
    deleteGarden,
    deleteGardenBlock,
    deleteGardenStack,
    getAccountGardens,
    getAccountGardensMetadata,
    getGarden,
    getGardenBlock,
    getGardenBlocks,
    getGardenStack,
    getGardenStacks,
    getGardens,
    getRaisedBedFieldsWithEvents,
    getRaisedBedFieldsWithEventsForBeds,
    getRaisedBedMetadataByIds,
    getRaisedBeds,
    knownEvents,
    updateGarden,
    updateGardenBlock,
    updateGardenStack,
    updateRaisedBed,
    upsertRaisedBedField,
} from '@gredice/storage';
import { and, eq } from 'drizzle-orm';
import { gardenStacks } from '../src/schema';
import {
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
    ensureFarmId,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

test('can create and retrieve a garden', async () => {
    createTestDb();

    const accountId = await createAccount();
    const farmId = await ensureFarmId();

    // Insert a garden
    const gardenId = await createTestGarden({
        name: 'Test Garden',
        accountId,
        farmId,
    });
    const gardens = await getGardens();
    assert.ok(Array.isArray(gardens));
    const createdGarden = gardens.find((g) => g.id === gardenId);
    assert.ok(createdGarden, 'Garden should be created');
    assert.strictEqual(
        createdGarden?.name,
        'Test Garden',
        'Garden name should match',
    );
    assert.strictEqual(
        createdGarden?.accountId,
        accountId,
        'Garden accountId should match',
    );
    assert.strictEqual(
        createdGarden?.farmId,
        farmId,
        'Garden farmId should match',
    );
});

test('getGardens returns all gardens', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    await createTestGarden({ accountId, farmId });
    const gardens = await getGardens();
    assert.ok(Array.isArray(gardens));
    assert.ok(gardens.length > 0);
});

test('getAccountGardens returns gardens for account', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const gardens = await getAccountGardens(accountId);
    assert.ok(Array.isArray(gardens));
    assert.ok(gardens.some((g) => g.id === gardenId));
});

test('getAccountGardensMetadata returns account gardens without raised beds', async () => {
    createTestDb();
    const accountId = await createAccount();
    const otherAccountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({
        name: 'Metadata Garden',
        accountId,
        farmId,
    });
    const deletedGardenId = await createTestGarden({
        name: 'Deleted Metadata Garden',
        accountId,
        farmId,
    });
    await createTestGarden({
        name: 'Later Metadata Garden',
        accountId,
        farmId,
    });
    await createTestGarden({ accountId: otherAccountId, farmId });
    await deleteGarden(deletedGardenId);

    const gardens = await getAccountGardensMetadata(accountId);
    const enrichedGardens = await getAccountGardens(accountId);
    const garden = gardens.find((g) => g.id === gardenId);

    assert.deepStrictEqual(
        gardens.map((g) => g.id),
        enrichedGardens.map((g) => g.id),
    );
    assert.ok(garden);
    assert.strictEqual(garden.name, 'Metadata Garden');
    assert.strictEqual(garden.accountId, accountId);
    assert.strictEqual(garden.isDeleted, false);
    assert.strictEqual(typeof garden.isSandbox, 'boolean');
    assert.strictEqual(typeof garden.backgroundPalette, 'string');
    assert.ok(garden.createdAt instanceof Date);
    assert.strictEqual(Object.hasOwn(garden, 'raisedBeds'), false);
    assert.strictEqual(
        gardens.some((g) => g.id === deletedGardenId),
        false,
    );
    assert.strictEqual(
        gardens.some((g) => g.accountId !== accountId),
        false,
    );
});

test('countRaisedBedsByAccount counts active raised beds for account quota', async () => {
    createTestDb();
    const accountId = await createAccount();
    const otherAccountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const otherGardenId = await createTestGarden({
        accountId: otherAccountId,
        farmId,
    });
    const firstBlockId = await createTestBlock(gardenId, 'Raised_Bed');
    const secondBlockId = await createTestBlock(gardenId, 'Raised_Bed');
    const otherBlockId = await createTestBlock(otherGardenId, 'Raised_Bed');
    const firstRaisedBedId = await createTestRaisedBed(
        gardenId,
        accountId,
        firstBlockId,
    );
    await createTestRaisedBed(gardenId, accountId, secondBlockId);
    const otherRaisedBedId = await createTestRaisedBed(
        otherGardenId,
        otherAccountId,
        otherBlockId,
    );

    await updateRaisedBed({ id: firstRaisedBedId, status: 'active' });
    await updateRaisedBed({ id: otherRaisedBedId, status: 'active' });

    assert.strictEqual(
        await countRaisedBedsByAccount(accountId, { status: 'active' }),
        1,
    );
    assert.strictEqual(await countRaisedBedsByAccount(accountId), 2);
});

test('accountHasActiveRaisedBed returns true for an active raised bed in an account garden', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(gardenId, 'Raised_Bed');
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);

    await updateRaisedBed({ id: raisedBedId, status: 'active' });

    assert.strictEqual(await accountHasActiveRaisedBed(accountId), true);
});

test('accountHasActiveRaisedBed returns false when account beds are not active', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(gardenId, 'Raised_Bed');
    await createTestRaisedBed(gardenId, accountId, blockId);

    assert.strictEqual(await accountHasActiveRaisedBed(accountId), false);
});

test('accountHasActiveRaisedBed returns false when the account has no gardens', async () => {
    createTestDb();
    const accountId = await createAccount();

    assert.strictEqual(await accountHasActiveRaisedBed(accountId), false);
});

test('accountHasActiveRaisedBed ignores active beds in soft-deleted gardens', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(gardenId, 'Raised_Bed');
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);

    await updateRaisedBed({ id: raisedBedId, status: 'active' });
    await deleteGarden(gardenId);

    assert.strictEqual(await accountHasActiveRaisedBed(accountId), false);
});

test('accountHasActiveRaisedBed uses the garden owner instead of the raised-bed account', async () => {
    createTestDb();
    const gardenOwnerAccountId = await createAccount();
    const raisedBedAccountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({
        accountId: gardenOwnerAccountId,
        farmId,
    });
    const blockId = await createTestBlock(gardenId, 'Raised_Bed');
    const raisedBedId = await createTestRaisedBed(
        gardenId,
        raisedBedAccountId,
        blockId,
    );

    await updateRaisedBed({ id: raisedBedId, status: 'active' });

    assert.strictEqual(
        await accountHasActiveRaisedBed(gardenOwnerAccountId),
        true,
    );
    assert.strictEqual(
        await accountHasActiveRaisedBed(raisedBedAccountId),
        false,
    );
});

test('getGarden returns correct garden', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const garden = await getGarden(gardenId);
    assert.ok(garden);
    assert.strictEqual(garden.id, gardenId);
});

test('updateGarden updates garden name', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    await updateGarden({ id: gardenId, name: 'Updated Garden' });
    const garden = await getGarden(gardenId);
    assert.ok(garden);
    assert.strictEqual(garden?.name, 'Updated Garden');
});

test('updateGarden updates garden background palette', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    await updateGarden({ id: gardenId, backgroundPalette: 'purple' });
    const garden = await getGarden(gardenId);
    assert.ok(garden);
    assert.strictEqual(garden.backgroundPalette, 'purple');
});

test('deleteGarden marks garden as deleted', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    await deleteGarden(gardenId);
    const garden = await getGarden(gardenId);
    assert.strictEqual(garden, null);
});

test('createGardenBlock and getGardenBlocks', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createGardenBlock(gardenId, 'BlockA');
    const blocks = await getGardenBlocks(gardenId);
    assert.ok(blocks.some((b) => b.id === blockId));
});

test('getGardenBlock returns correct block', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createGardenBlock(gardenId, 'BlockA');
    const block = await getGardenBlock(gardenId, blockId);
    assert.ok(block);
    assert.strictEqual(block.id, blockId);
});

test('updateGardenBlock updates block', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createGardenBlock(gardenId, 'BlockA');
    await updateGardenBlock({ id: blockId, rotation: 1 });
    const block = await getGardenBlock(gardenId, blockId);
    assert.ok(block);
    assert.strictEqual(block?.rotation, 1);
});

test('deleteGardenBlock marks block as deleted', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createGardenBlock(gardenId, 'BlockA');
    await deleteGardenBlock(gardenId, blockId);
    const block = await getGardenBlock(gardenId, blockId);
    assert.strictEqual(block, null);
});

test('getGardenStacks returns stacks for garden', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    await createGardenStack(gardenId, { x: 0, y: 0 });
    const stacks = await getGardenStacks(gardenId);
    assert.ok(Array.isArray(stacks));
    assert.ok(stacks.length > 0);
});

test('getGardenStack returns correct stack', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    await createGardenStack(gardenId, { x: 1, y: 2 });
    const stack = await getGardenStack(gardenId, { x: 1, y: 2 });
    assert.ok(stack);
    assert.strictEqual(stack.positionX, 1);
    assert.strictEqual(stack.positionY, 2);
});

test('createGardenStack returns false if stack exists', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    await createGardenStack(gardenId, { x: 0, y: 0 });
    const result = await createGardenStack(gardenId, { x: 0, y: 0 });
    assert.strictEqual(result, false);
});

test('createGardenStack reuses a soft-deleted stack at the same position', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });

    await createGardenStack(gardenId, { x: 7, y: 7 });
    await updateGardenStack(gardenId, {
        x: 7,
        y: 7,
        blocks: ['block-a', 'block-b'],
    });
    await deleteGardenStack(gardenId, { x: 7, y: 7 });

    const result = await createGardenStack(gardenId, { x: 7, y: 7 });
    assert.strictEqual(result, true);

    const stack = await getGardenStack(gardenId, { x: 7, y: 7 });
    assert.ok(stack);
    assert.deepStrictEqual(stack.blocks, []);

    // Only one row should exist at (7, 7) — the reused one — instead of
    // accumulating a fresh insert alongside the soft-deleted original.
    const db = createTestDb();
    const allStacksAtPosition = await db
        .select()
        .from(gardenStacks)
        .where(
            and(
                eq(gardenStacks.gardenId, gardenId),
                eq(gardenStacks.positionX, 7),
                eq(gardenStacks.positionY, 7),
            ),
        );
    assert.strictEqual(allStacksAtPosition.length, 1);
    assert.strictEqual(allStacksAtPosition[0].isDeleted, false);
});

test('updateGardenStack updates stack blocks', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    await createGardenStack(gardenId, { x: 2, y: 3 });
    await updateGardenStack(gardenId, {
        x: 2,
        y: 3,
        blocks: ['block1', 'block2'],
    });
    const stack = await getGardenStack(gardenId, { x: 2, y: 3 });
    assert.ok(stack);
    assert.deepStrictEqual(stack?.blocks, ['block1', 'block2']);
});

test('updateGardenStack throws if stack does not exist', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    await assert.rejects(
        () => updateGardenStack(gardenId, { x: 99, y: 99, blocks: [] }),
        /Stack not found/,
    );
});

test('deleteGardenStack marks stack as deleted', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    await createGardenStack(gardenId, { x: 5, y: 5 });
    await deleteGardenStack(gardenId, { x: 5, y: 5 });
    const stack = await getGardenStack(gardenId, { x: 5, y: 5 });
    assert.strictEqual(stack, null);
});

test('getGarden excludes deleted stacks', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    await createGardenStack(gardenId, { x: 1, y: 1 });
    await createGardenStack(gardenId, { x: 2, y: 2 });
    await deleteGardenStack(gardenId, { x: 1, y: 1 });

    const garden = await getGarden(gardenId);
    assert.ok(garden);
    assert.strictEqual(garden.stacks.length, 1);
    assert.strictEqual(garden.stacks[0].positionX, 2);
    assert.strictEqual(garden.stacks[0].positionY, 2);
});

// Edge cases

test('getGarden returns null for non-existent garden', async () => {
    createTestDb();
    const garden = await getGarden(99999);
    assert.strictEqual(garden, null);
});

test('getGardenBlock returns null for non-existent block', async () => {
    createTestDb();
    const block = await getGardenBlock(1, 'nonexistent');
    assert.strictEqual(block, null);
});

test('getGardenStack returns null for non-existent stack', async () => {
    createTestDb();
    const stack = await getGardenStack(1, { x: 42, y: 42 });
    assert.strictEqual(stack, null);
});

test('createDefaultGardenForAccount creates garden with default layout', async () => {
    createTestDb();
    const accountId = await createAccount();
    await ensureFarmId();

    const gardenId = await createDefaultGardenForAccount({
        accountId,
        name: 'Test Default Garden',
    });

    // Verify garden was created
    const garden = await getGarden(gardenId);
    assert.ok(garden, 'Garden should be created');
    assert.strictEqual(garden?.name, 'Test Default Garden');
    assert.strictEqual(garden?.accountId, accountId);

    // Verify stacks were created (4x3 grid: x=-1..2, y=-1..1)
    const stacks = await getGardenStacks(gardenId);
    assert.strictEqual(stacks.length, 12, 'Should have 12 stacks (4x3 grid)');

    // Verify blocks were created
    const blocks = await getGardenBlocks(gardenId);
    assert.ok(
        blocks.length > 0,
        `Should have blocks created (found ${blocks.length})`,
    );

    const grassBlocks = blocks.filter((b) => b.name === 'Block_Grass');
    const raisedBedBlocks = blocks.filter((b) => b.name === 'Raised_Bed');

    // 12 grass blocks + 2 raised beds = 14 total blocks
    assert.strictEqual(grassBlocks.length, 12, 'Should have 12 grass blocks');
    assert.strictEqual(
        raisedBedBlocks.length,
        2,
        'Should have 2 raised bed blocks',
    );

    // Verify raised beds were created at (0,0) and (1,0)
    const raisedBeds = await getRaisedBeds(gardenId);
    assert.strictEqual(raisedBeds.length, 2, 'Should have 2 raised beds');

    // Verify specific stacks have correct blocks
    const stack00 = await getGardenStack(gardenId, { x: 0, y: 0 });
    const stack10 = await getGardenStack(gardenId, { x: 1, y: 0 });
    assert.ok(stack00, 'Stack at (0,0) should exist');
    assert.ok(stack10, 'Stack at (1,0) should exist');
    assert.strictEqual(
        stack00?.blocks.length,
        2,
        'Stack (0,0) should have 2 blocks (grass + raised bed)',
    );
    assert.strictEqual(
        stack10?.blocks.length,
        2,
        'Stack (1,0) should have 2 blocks (grass + raised bed)',
    );
});

test('getRaisedBedFieldsWithEventsForBeds matches single-bed projections', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const firstBlockId = await createTestBlock(gardenId, 'Raised_Bed');
    const secondBlockId = await createTestBlock(gardenId, 'Raised_Bed');
    const firstRaisedBedId = await createTestRaisedBed(
        gardenId,
        accountId,
        firstBlockId,
    );
    const secondRaisedBedId = await createTestRaisedBed(
        gardenId,
        accountId,
        secondBlockId,
    );

    await upsertRaisedBedField({
        raisedBedId: firstRaisedBedId,
        positionIndex: 0,
    });
    await upsertRaisedBedField({
        raisedBedId: secondRaisedBedId,
        positionIndex: 1,
    });
    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(
            `${firstRaisedBedId.toString()}|0`,
            {
                plantSortId: '101',
                scheduledDate: new Date(
                    '2026-04-01T00:00:00.000Z',
                ).toISOString(),
                sowingLocation: 'greenhouse',
            },
        ),
    );
    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(
            `${secondRaisedBedId.toString()}|1`,
            {
                plantSortId: '202',
                scheduledDate: new Date(
                    '2026-04-02T00:00:00.000Z',
                ).toISOString(),
            },
        ),
    );

    const bulkFields = await getRaisedBedFieldsWithEventsForBeds([
        firstRaisedBedId,
        secondRaisedBedId,
    ]);

    assert.deepStrictEqual(
        bulkFields.get(firstRaisedBedId) ?? [],
        await getRaisedBedFieldsWithEvents(firstRaisedBedId),
    );
    assert.deepStrictEqual(
        bulkFields.get(secondRaisedBedId) ?? [],
        await getRaisedBedFieldsWithEvents(secondRaisedBedId),
    );
});

test('getRaisedBedMetadataByIds returns lightweight raised-bed metadata', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const firstBlockId = await createTestBlock(gardenId, 'Raised_Bed');
    const secondBlockId = await createTestBlock(gardenId, 'Raised_Bed');
    const firstRaisedBedId = await createTestRaisedBed(
        gardenId,
        accountId,
        firstBlockId,
    );
    const secondRaisedBedId = await createTestRaisedBed(
        gardenId,
        accountId,
        secondBlockId,
    );

    await updateRaisedBed({
        id: firstRaisedBedId,
        name: 'Test Raised Bed',
        physicalId: 'G-001',
    });

    const metadata = await getRaisedBedMetadataByIds([
        secondRaisedBedId,
        firstRaisedBedId,
        firstRaisedBedId,
        99999,
    ]);

    assert.deepStrictEqual(
        metadata.map((raisedBed) => raisedBed.id),
        [firstRaisedBedId, secondRaisedBedId],
    );
    assert.deepStrictEqual(metadata[0], {
        id: firstRaisedBedId,
        name: 'Test Raised Bed',
        physicalId: 'G-001',
    });
    assert.strictEqual(metadata[1].id, secondRaisedBedId);
    assert.strictEqual(typeof metadata[1].name, 'string');
    assert.ok(metadata[1].name.length > 0);
    assert.strictEqual(metadata[1].physicalId, null);
    assert.ok(!('fields' in metadata[0]));
});

test('createDefaultGardenForAccount uses default name when not provided', async () => {
    createTestDb();
    const accountId = await createAccount();
    await ensureFarmId();

    const gardenId = await createDefaultGardenForAccount({ accountId });

    const garden = await getGarden(gardenId);
    assert.ok(garden);
    assert.strictEqual(
        garden?.name,
        'Moj vrt',
        'Should use default name "Moj vrt"',
    );
});

test('createDefaultGardenForAccount trims whitespace from name', async () => {
    createTestDb();
    const accountId = await createAccount();
    await ensureFarmId();

    const gardenId = await createDefaultGardenForAccount({
        accountId,
        name: '  My Garden  ',
    });

    const garden = await getGarden(gardenId);
    assert.ok(garden);
    assert.strictEqual(
        garden?.name,
        'My Garden',
        'Should trim whitespace from name',
    );
});
