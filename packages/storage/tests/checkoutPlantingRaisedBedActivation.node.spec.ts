import assert from 'node:assert/strict';
import test from 'node:test';
import {
    RAISED_BED_ABANDON_OPERATION_ENTITY_ID,
    RAISED_BED_OPERATION_ENTITY_TYPE_NAME,
} from '@gredice/js/raisedBeds';
import {
    abandonRaisedBed,
    createAccount,
    getRaisedBed,
    lockAndActivateRaisedBedForCheckoutPlanting,
    updateRaisedBed,
    withPlantingScheduleTaskTransaction,
} from '@gredice/storage';
import {
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
    ensureFarmId,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

function createGate() {
    let openGate: (() => void) | undefined;
    const wait = new Promise<void>((resolve) => {
        openGate = resolve;
    });
    return {
        wait,
        open: () => openGate?.(),
    };
}

async function createRaisedBedFixture() {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(
        gardenId,
        `Checkout parent lock ${accountId}`,
    );
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);
    return { accountId, gardenId, raisedBedId };
}

test('checkout planting rejects a parent abandoned before its row lock', async () => {
    const { raisedBedId } = await createRaisedBedFixture();
    await updateRaisedBed({ id: raisedBedId, status: 'abandoned' });

    const activation = await withPlantingScheduleTaskTransaction(
        raisedBedId,
        0,
        (transaction) =>
            lockAndActivateRaisedBedForCheckoutPlanting(
                raisedBedId,
                transaction,
            ),
    );

    assert.deepStrictEqual(activation, {
        available: false,
        reason: 'abandoned',
    });
    assert.equal((await getRaisedBed(raisedBedId))?.status, 'abandoned');
});

test('abandonment wins after checkout holds and commits the parent row lock', async () => {
    const { accountId, gardenId, raisedBedId } = await createRaisedBedFixture();
    const checkoutHasParentLock = createGate();
    const releaseCheckout = createGate();

    const checkoutPromise = withPlantingScheduleTaskTransaction(
        raisedBedId,
        0,
        async (transaction) => {
            const activation =
                await lockAndActivateRaisedBedForCheckoutPlanting(
                    raisedBedId,
                    transaction,
                );
            checkoutHasParentLock.open();
            await releaseCheckout.wait;
            return activation;
        },
    );
    await checkoutHasParentLock.wait;

    const abandonmentPromise = abandonRaisedBed({
        accountId,
        gardenId,
        operationEntityId: RAISED_BED_ABANDON_OPERATION_ENTITY_ID,
        operationEntityTypeName: RAISED_BED_OPERATION_ENTITY_TYPE_NAME,
        raisedBedId,
        reason: 'user',
    });
    releaseCheckout.open();

    const [activation] = await Promise.all([
        checkoutPromise,
        abandonmentPromise,
    ]);

    assert.deepStrictEqual(activation, {
        available: true,
        activatedAccountId: accountId,
    });
    assert.equal((await getRaisedBed(raisedBedId))?.status, 'abandoned');
});
