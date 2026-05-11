import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createAccount,
    createEvent,
    createOperation,
    FREE_WATERING_OPERATION_ID,
    getOperations,
    knownEvents,
    queueSeasonalSowingOfferOperations,
} from '@gredice/storage';
import {
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
    ensureFarmId,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

async function createSeasonalOfferTestContext() {
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(gardenId, 'seasonal-offer-block');
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);

    return {
        accountId,
        gardenId,
        raisedBedId,
    };
}

async function getScheduledFreeWateringDates(
    accountId: string,
    gardenId: number,
    raisedBedId: number,
) {
    const operations = await getOperations(accountId, gardenId, raisedBedId);

    return operations
        .filter(
            (operation) =>
                operation.entityId === FREE_WATERING_OPERATION_ID &&
                operation.scheduledDate,
        )
        .map((operation) => operation.scheduledDate?.toISOString())
        .sort();
}

test('queueSeasonalSowingOfferOperations queues spring free waterings every two days', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createSeasonalOfferTestContext();

    const createdOperationIds = await queueSeasonalSowingOfferOperations({
        accountId,
        gardenId,
        raisedBedId,
        referenceDate: new Date('2026-03-10T08:00:00.000Z'),
    });

    assert.strictEqual(createdOperationIds.length, 3);
    assert.deepStrictEqual(
        await getScheduledFreeWateringDates(accountId, gardenId, raisedBedId),
        [
            '2026-03-10T08:00:00.000Z',
            '2026-03-12T08:00:00.000Z',
            '2026-03-14T08:00:00.000Z',
        ],
    );
});

test('queueSeasonalSowingOfferOperations queues summer free waterings daily', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createSeasonalOfferTestContext();

    const createdOperationIds = await queueSeasonalSowingOfferOperations({
        accountId,
        gardenId,
        raisedBedId,
        referenceDate: new Date('2026-06-01T08:00:00.000Z'),
    });

    assert.strictEqual(createdOperationIds.length, 5);
    assert.deepStrictEqual(
        await getScheduledFreeWateringDates(accountId, gardenId, raisedBedId),
        [
            '2026-06-01T08:00:00.000Z',
            '2026-06-02T08:00:00.000Z',
            '2026-06-03T08:00:00.000Z',
            '2026-06-04T08:00:00.000Z',
            '2026-06-05T08:00:00.000Z',
        ],
    );
});

test('queueSeasonalSowingOfferOperations queues autumn free waterings every two days', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createSeasonalOfferTestContext();

    const createdOperationIds = await queueSeasonalSowingOfferOperations({
        accountId,
        gardenId,
        raisedBedId,
        referenceDate: new Date('2026-09-10T08:00:00.000Z'),
    });

    assert.strictEqual(createdOperationIds.length, 3);
    assert.deepStrictEqual(
        await getScheduledFreeWateringDates(accountId, gardenId, raisedBedId),
        [
            '2026-09-10T08:00:00.000Z',
            '2026-09-12T08:00:00.000Z',
            '2026-09-14T08:00:00.000Z',
        ],
    );
});

test('queueSeasonalSowingOfferOperations skips dates without a seasonal offer', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createSeasonalOfferTestContext();

    const createdOperationIds = await queueSeasonalSowingOfferOperations({
        accountId,
        gardenId,
        raisedBedId,
        referenceDate: new Date('2026-01-10T08:00:00.000Z'),
    });

    assert.deepStrictEqual(createdOperationIds, []);
    assert.deepStrictEqual(
        await getScheduledFreeWateringDates(accountId, gardenId, raisedBedId),
        [],
    );
});

test('queueSeasonalSowingOfferOperations skips days with existing scheduled free waterings', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createSeasonalOfferTestContext();
    const existingOperationId = await createOperation({
        accountId,
        entityId: FREE_WATERING_OPERATION_ID,
        entityTypeName: 'operation',
        gardenId,
        raisedBedId,
    });
    await createEvent(
        knownEvents.operations.scheduledV1(existingOperationId.toString(), {
            scheduledDate: '2026-06-20T08:00:00.000Z',
        }),
    );

    const createdOperationIds = await queueSeasonalSowingOfferOperations({
        accountId,
        gardenId,
        raisedBedId,
        referenceDate: new Date('2026-06-15T08:00:00.000Z'),
    });

    assert.strictEqual(createdOperationIds.length, 5);
    assert.deepStrictEqual(
        await getScheduledFreeWateringDates(accountId, gardenId, raisedBedId),
        [
            '2026-06-15T08:00:00.000Z',
            '2026-06-16T08:00:00.000Z',
            '2026-06-17T08:00:00.000Z',
            '2026-06-18T08:00:00.000Z',
            '2026-06-19T08:00:00.000Z',
            '2026-06-20T08:00:00.000Z',
        ],
    );
});


test('queueSeasonalSowingOfferOperations does not duplicate existing offer days on repeated sowing', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createSeasonalOfferTestContext();

    const firstRun = await queueSeasonalSowingOfferOperations({
        accountId,
        gardenId,
        raisedBedId,
        referenceDate: new Date('2026-03-10T08:00:00.000Z'),
    });

    const secondRun = await queueSeasonalSowingOfferOperations({
        accountId,
        gardenId,
        raisedBedId,
        referenceDate: new Date('2026-03-10T12:00:00.000Z'),
    });

    assert.strictEqual(firstRun.length, 3);
    assert.strictEqual(secondRun.length, 0);
    assert.deepStrictEqual(
        await getScheduledFreeWateringDates(accountId, gardenId, raisedBedId),
        [
            '2026-03-10T08:00:00.000Z',
            '2026-03-12T08:00:00.000Z',
            '2026-03-14T08:00:00.000Z',
        ],
    );
});
