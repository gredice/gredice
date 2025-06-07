import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from './testDb';
import {
    createAccount,
    getGardens,
    getAccountGardens,
    getGarden,
    updateGarden,
    deleteGarden,
    getGardenBlocks,
    getGardenBlock,
    createGardenBlock,
    updateGardenBlock,
    deleteGardenBlock,
    getGardenStacks,
    getGardenStack,
    createGardenStack,
    updateGardenStack,
    deleteGardenStack
} from '@gredice/storage';
import { createTestGarden, ensureFarmId } from './helpers/testHelpers';

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
    const createdGarden = gardens.find(g => g.id === gardenId);
    assert.ok(createdGarden, 'Garden should be created');
    assert.strictEqual(createdGarden?.name, 'Test Garden', 'Garden name should match');
    assert.strictEqual(createdGarden?.accountId, accountId, 'Garden accountId should match');
    assert.strictEqual(createdGarden?.farmId, farmId, 'Garden farmId should match');
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
    assert.ok(gardens.some(g => g.id === gardenId));
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

test('deleteGarden marks garden as deleted', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    await deleteGarden(gardenId);
    const garden = await getGarden(gardenId);
    assert.strictEqual(garden, undefined);
});

test('createGardenBlock and getGardenBlocks', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createGardenBlock(gardenId, 'BlockA');
    const blocks = await getGardenBlocks(gardenId);
    assert.ok(blocks.some(b => b.id === blockId));
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
    assert.strictEqual(block, undefined);
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

test('updateGardenStack updates stack blocks', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    await createGardenStack(gardenId, { x: 2, y: 3 });
    await updateGardenStack(gardenId, { x: 2, y: 3, blocks: ['block1', 'block2'] });
    const stack = await getGardenStack(gardenId, { x: 2, y: 3 });
    assert.ok(stack);
    assert.deepStrictEqual(stack?.blocks, ['block1', 'block2']);
});

test('updateGardenStack throws if stack does not exist', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    await assert.rejects(() => updateGardenStack(gardenId, { x: 99, y: 99, blocks: [] }), /Stack not found/);
});

test('deleteGardenStack marks stack as deleted', async () => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    await createGardenStack(gardenId, { x: 5, y: 5 });
    await deleteGardenStack(gardenId, { x: 5, y: 5 });
    const stack = await getGardenStack(gardenId, { x: 5, y: 5 });
    assert.strictEqual(stack, undefined);
});

// Edge cases

test('getGarden returns undefined for non-existent garden', async () => {
    createTestDb();
    const garden = await getGarden(99999);
    assert.strictEqual(garden, undefined);
});

test('getGardenBlock returns undefined for non-existent block', async () => {
    createTestDb();
    const block = await getGardenBlock(1, 'nonexistent');
    assert.strictEqual(block, undefined);
});

test('getGardenStack returns undefined for non-existent stack', async () => {
    createTestDb();
    const stack = await getGardenStack(1, { x: 42, y: 42 });
    assert.strictEqual(stack, undefined);
});
