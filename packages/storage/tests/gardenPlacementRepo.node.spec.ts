import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createAccount,
    createGardenBlock,
    createGardenStack,
    deleteGardenBlock,
    deleteGardenStack,
    gardens,
    getGarden,
    getGardenBlock,
    getGardenBlocks,
    getGardenPlacementSnapshot,
    getGardenStack,
    getGardenStacks,
    updateGardenStack,
    withGardenPlacementTransaction,
} from '@gredice/storage';
import { eq } from 'drizzle-orm';
import { createTestGarden, ensureFarmId } from './helpers/testHelpers';
import { createTestDb } from './testDb';

async function createPlacementGarden() {
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    return { accountId, gardenId };
}

test('garden placement transactions serialize commands for one garden', async () => {
    createTestDb();
    const { gardenId } = await createPlacementGarden();
    const events: string[] = [];
    let releaseFirst = () => {};
    const firstMayFinish = new Promise<void>((resolve) => {
        releaseFirst = resolve;
    });
    let firstDidStart = () => {};
    const firstStarted = new Promise<void>((resolve) => {
        firstDidStart = resolve;
    });

    const first = withGardenPlacementTransaction(gardenId, async () => {
        events.push('first-start');
        firstDidStart();
        await firstMayFinish;
        events.push('first-end');
    });
    await firstStarted;
    const second = withGardenPlacementTransaction(gardenId, async () => {
        events.push('second-start');
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(events, ['first-start']);
    releaseFirst();
    await Promise.all([first, second]);
    assert.deepEqual(events, ['first-start', 'first-end', 'second-start']);
});

test('garden placement transactions roll back failed commands', async () => {
    createTestDb();
    const { gardenId } = await createPlacementGarden();
    const before = await getGarden(gardenId);
    assert.ok(before);

    await assert.rejects(
        withGardenPlacementTransaction(gardenId, async (transaction) => {
            await transaction
                .update(gardens)
                .set({ name: 'Uncommitted name' })
                .where(eq(gardens.id, gardenId));
            throw new Error('reject command');
        }),
        /reject command/u,
    );

    const after = await getGarden(gardenId);
    assert.equal(after?.name, before.name);
});

test('placement snapshots read active authoritative rows through the lock transaction', async () => {
    createTestDb();
    const { accountId, gardenId } = await createPlacementGarden();
    const blockId = await createGardenBlock(gardenId, 'Block_Grass');
    const deletedBlockId = await createGardenBlock(gardenId, 'Tree');
    await createGardenStack(gardenId, { x: 2, y: -3 });
    await updateGardenStack(gardenId, {
        x: 2,
        y: -3,
        blocks: [blockId],
    });
    await deleteGardenBlock(gardenId, deletedBlockId);

    const snapshot = await withGardenPlacementTransaction(
        gardenId,
        (transaction) => getGardenPlacementSnapshot(gardenId, transaction),
    );

    assert.ok(snapshot);
    assert.deepEqual(snapshot.garden, {
        id: gardenId,
        accountId,
        isSandbox: false,
    });
    assert.deepEqual(
        snapshot.stacks.map((stack) => ({
            blocks: stack.blocks,
            x: stack.positionX,
            y: stack.positionY,
        })),
        [{ blocks: [blockId], x: 2, y: -3 }],
    );
    assert.deepEqual(
        snapshot.blocks.map((block) => block.id),
        [blockId],
    );
});

test('garden placement transactions reject invalid lock identifiers', async () => {
    await assert.rejects(
        withGardenPlacementTransaction(0, async () => undefined),
        /positive ID/u,
    );
});

test('placement readers and stack deletion reuse and roll back the lock transaction', async () => {
    createTestDb();
    const { gardenId } = await createPlacementGarden();
    const blockId = await createGardenBlock(gardenId, 'Block_Grass');
    await createGardenStack(gardenId, { x: 7, y: -4 });
    await updateGardenStack(gardenId, {
        x: 7,
        y: -4,
        blocks: [blockId],
    });

    await assert.rejects(
        withGardenPlacementTransaction(gardenId, async (transaction) => {
            assert.equal(
                (await getGardenBlocks(gardenId, transaction)).length,
                1,
            );
            assert.equal(
                (await getGardenBlock(gardenId, blockId, transaction))?.id,
                blockId,
            );
            assert.equal(
                (await getGardenStacks(gardenId, transaction)).length,
                1,
            );
            assert.deepEqual(
                (await getGardenStack(gardenId, { x: 7, y: -4 }, transaction))
                    ?.blocks,
                [blockId],
            );

            await deleteGardenStack(gardenId, { x: 7, y: -4 }, transaction);
            assert.equal(
                await getGardenStack(gardenId, { x: 7, y: -4 }, transaction),
                null,
            );
            throw new Error('reject placement readers');
        }),
        /reject placement readers/u,
    );

    assert.deepEqual(
        (await getGardenStack(gardenId, { x: 7, y: -4 }))?.blocks,
        [blockId],
    );
});
