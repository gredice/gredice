import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createAccount,
    createGardenBlock,
    createGardenStack,
    deleteGardenBlock,
    deleteGardenStack,
    gardens,
    getAllEvents,
    getGarden,
    getGardenBlock,
    getGardenBlockForUpdate,
    getGardenBlocks,
    getGardenPlacementLocation,
    getGardenPlacementSnapshot,
    getGardenPlacementSnapshotForUpdate,
    getGardenStack,
    getGardenStacks,
    knownEventTypes,
    softDeleteGardenBlockOnce,
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

test('placement location reads farm coordinates through the lock transaction', async () => {
    createTestDb();
    const { gardenId } = await createPlacementGarden();
    const garden = await getGarden(gardenId);
    assert.ok(garden?.farm);

    const location = await withGardenPlacementTransaction(
        gardenId,
        (transaction) => getGardenPlacementLocation(gardenId, transaction),
    );

    assert.deepEqual(location, {
        lat: garden.farm.latitude,
        lon: garden.farm.longitude,
    });
});

test('locked placement snapshots return active rows in stable ID order', async () => {
    createTestDb();
    const { accountId, gardenId } = await createPlacementGarden();
    const firstBlockId = await createGardenBlock(gardenId, 'Block_Grass');
    const secondBlockId = await createGardenBlock(gardenId, 'Tree');
    await createGardenStack(gardenId, { x: 3, y: 1 });
    await createGardenStack(gardenId, { x: -2, y: 4 });

    const snapshot = await withGardenPlacementTransaction(
        gardenId,
        (transaction) =>
            getGardenPlacementSnapshotForUpdate(gardenId, transaction),
    );

    assert.ok(snapshot);
    assert.deepEqual(snapshot.garden, {
        id: gardenId,
        accountId,
        isSandbox: false,
    });
    const stackIds = snapshot.stacks.map((stack) => stack.id);
    assert.deepEqual(
        stackIds,
        [...stackIds].sort((left, right) => left - right),
    );
    const blockIds = snapshot.blocks.map((block) => block.id);
    assert.deepEqual(blockIds, [...blockIds].sort());
    assert.deepEqual(new Set(blockIds), new Set([firstBlockId, secondBlockId]));
});

test('garden block deletion reports retry state and emits one removal event', async () => {
    createTestDb();
    const { gardenId } = await createPlacementGarden();
    const blockId = await createGardenBlock(gardenId, 'Block_Grass');
    const otherGardenId = (await createPlacementGarden()).gardenId;
    const eventsBefore = await getAllEvents(
        knownEventTypes.gardens.blockPlace,
        [gardenId.toString()],
    );

    const firstResult = await withGardenPlacementTransaction(
        gardenId,
        (transaction) =>
            softDeleteGardenBlockOnce(gardenId, blockId, transaction),
    );
    const retryResult = await withGardenPlacementTransaction(
        gardenId,
        (transaction) =>
            softDeleteGardenBlockOnce(gardenId, blockId, transaction),
    );
    const wrongGardenResult = await withGardenPlacementTransaction(
        otherGardenId,
        (transaction) =>
            softDeleteGardenBlockOnce(otherGardenId, blockId, transaction),
    );

    assert.equal(firstResult, 'deleted');
    assert.equal(retryResult, 'already-deleted');
    assert.equal(wrongGardenResult, 'not-found');
    const eventsAfter = await getAllEvents(knownEventTypes.gardens.blockPlace, [
        gardenId.toString(),
    ]);
    assert.equal(eventsAfter.length, eventsBefore.length + 1);

    await withGardenPlacementTransaction(gardenId, async (transaction) => {
        assert.equal(
            await getGardenBlockForUpdate({ blockId, gardenId }, transaction),
            null,
        );
        const deletedBlock = await getGardenBlockForUpdate(
            { blockId, gardenId, includeDeleted: true },
            transaction,
        );
        assert.equal(deletedBlock?.isDeleted, true);
    });
});

test('garden block deletion and its event roll back with the placement transaction', async () => {
    createTestDb();
    const { gardenId } = await createPlacementGarden();
    const blockId = await createGardenBlock(gardenId, 'Block_Grass');
    const eventsBefore = await getAllEvents(
        knownEventTypes.gardens.blockPlace,
        [gardenId.toString()],
    );

    await assert.rejects(
        withGardenPlacementTransaction(gardenId, async (transaction) => {
            assert.equal(
                await softDeleteGardenBlockOnce(gardenId, blockId, transaction),
                'deleted',
            );
            throw new Error('reject garden block deletion');
        }),
        /reject garden block deletion/u,
    );

    assert.equal((await getGardenBlock(gardenId, blockId))?.id, blockId);
    const eventsAfter = await getAllEvents(knownEventTypes.gardens.blockPlace, [
        gardenId.toString(),
    ]);
    assert.equal(eventsAfter.length, eventsBefore.length);
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
