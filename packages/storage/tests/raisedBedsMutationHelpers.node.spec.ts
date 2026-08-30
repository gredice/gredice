import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createAccount,
    createGardenBlock,
    createRaisedBed,
    listGardenRaisedBedMetadataForUpdate,
    raisedBeds,
    softDeleteNewRaisedBedOnce,
    storage,
    updateRaisedBed,
    updateRaisedBedOrientation,
    withGardenPlacementTransaction,
} from '@gredice/storage';
import { eq } from 'drizzle-orm';
import { createTestGarden, ensureFarmId } from './helpers/testHelpers';
import { createTestDb } from './testDb';

async function createGardenWithAccount() {
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    return { accountId, gardenId };
}

async function createGardenRaisedBed(gardenId: number, accountId: string) {
    const blockId = await createGardenBlock(gardenId, 'Raised_Bed');
    const raisedBedId = await createRaisedBed({
        accountId,
        blockId,
        gardenId,
        status: 'new',
    });
    return { blockId, raisedBedId };
}

test('garden raised-bed mutation metadata is active, scoped, and ordered by ID', async () => {
    createTestDb();
    const { accountId, gardenId } = await createGardenWithAccount();
    const first = await createGardenRaisedBed(gardenId, accountId);
    const second = await createGardenRaisedBed(gardenId, accountId);
    const deleted = await createGardenRaisedBed(gardenId, accountId);
    const otherGarden = await createGardenWithAccount();
    await createGardenRaisedBed(otherGarden.gardenId, otherGarden.accountId);
    await updateRaisedBed({
        id: first.raisedBedId,
        orientation: 'horizontal',
    });
    await updateRaisedBed({ id: second.raisedBedId, status: 'active' });
    await withGardenPlacementTransaction(gardenId, (transaction) =>
        softDeleteNewRaisedBedOnce(deleted.raisedBedId, transaction),
    );

    const metadata = await withGardenPlacementTransaction(
        gardenId,
        (transaction) =>
            listGardenRaisedBedMetadataForUpdate(gardenId, transaction),
    );

    assert.deepEqual(metadata, [
        {
            id: first.raisedBedId,
            blockId: first.blockId,
            status: 'new',
            orientation: 'horizontal',
        },
        {
            id: second.raisedBedId,
            blockId: second.blockId,
            status: 'active',
            orientation: 'vertical',
        },
    ]);
});

test('raised-bed placement helpers update active projections and delete only new beds once', async () => {
    createTestDb();
    const { accountId, gardenId } = await createGardenWithAccount();
    const newBed = await createGardenRaisedBed(gardenId, accountId);
    const activeBed = await createGardenRaisedBed(gardenId, accountId);
    await updateRaisedBed({ id: activeBed.raisedBedId, status: 'active' });

    await withGardenPlacementTransaction(gardenId, async (transaction) => {
        assert.equal(
            await updateRaisedBedOrientation(
                newBed.raisedBedId,
                'horizontal',
                transaction,
            ),
            true,
        );
        assert.equal(
            await softDeleteNewRaisedBedOnce(
                activeBed.raisedBedId,
                transaction,
            ),
            false,
        );
        assert.equal(
            await softDeleteNewRaisedBedOnce(newBed.raisedBedId, transaction),
            true,
        );
        assert.equal(
            await softDeleteNewRaisedBedOnce(newBed.raisedBedId, transaction),
            false,
        );
        assert.equal(
            await updateRaisedBedOrientation(
                newBed.raisedBedId,
                'vertical',
                transaction,
            ),
            false,
        );
        assert.equal(
            await updateRaisedBedOrientation(999_999, 'vertical', transaction),
            false,
        );
    });

    const newBedRow = await storage().query.raisedBeds.findFirst({
        where: eq(raisedBeds.id, newBed.raisedBedId),
    });
    const activeBedRow = await storage().query.raisedBeds.findFirst({
        where: eq(raisedBeds.id, activeBed.raisedBedId),
    });
    assert.equal(newBedRow?.isDeleted, true);
    assert.equal(newBedRow?.orientation, 'horizontal');
    assert.equal(activeBedRow?.isDeleted, false);
    assert.equal(activeBedRow?.status, 'active');
});

test('raised-bed placement helper mutations roll back with the caller transaction', async () => {
    createTestDb();
    const { accountId, gardenId } = await createGardenWithAccount();
    const bed = await createGardenRaisedBed(gardenId, accountId);

    await assert.rejects(
        withGardenPlacementTransaction(gardenId, async (transaction) => {
            assert.equal(
                await updateRaisedBedOrientation(
                    bed.raisedBedId,
                    'horizontal',
                    transaction,
                ),
                true,
            );
            assert.equal(
                await softDeleteNewRaisedBedOnce(bed.raisedBedId, transaction),
                true,
            );
            throw new Error('reject raised-bed mutation');
        }),
        /reject raised-bed mutation/u,
    );

    const raisedBed = await storage().query.raisedBeds.findFirst({
        where: eq(raisedBeds.id, bed.raisedBedId),
    });
    assert.equal(raisedBed?.isDeleted, false);
    assert.equal(raisedBed?.orientation, 'vertical');
});
