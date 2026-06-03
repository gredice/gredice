import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createAccount,
    createEvent,
    createOperation,
    GardenDiaryRescheduleError,
    getOperationById,
    getRaisedBed,
    getRaisedBedDiaryEntries,
    getRaisedBedFieldDiaryEntries,
    knownEvents,
    rescheduleGardenDiaryOperation,
    rescheduleGardenDiaryRaisedBedField,
    upsertRaisedBedField,
} from '@gredice/storage';
import {
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
    ensureFarmId,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

async function createDiaryRescheduleContext() {
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(gardenId, 'diary-reschedule-block');
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);

    return {
        accountId,
        gardenId,
        raisedBedId,
    };
}

async function createScheduledOperation({
    accountId,
    gardenId,
    raisedBedId,
    scheduledDate,
}: {
    accountId: string;
    gardenId: number;
    raisedBedId: number;
    scheduledDate: string;
}) {
    const operationId = await createOperation({
        accountId,
        entityId: 1,
        entityTypeName: 'operation',
        gardenId,
        raisedBedId,
    });

    await createEvent(
        knownEvents.operations.scheduledV1(operationId.toString(), {
            scheduledDate,
        }),
    );

    return operationId;
}

async function createUnscheduledPlannedOperation({
    accountId,
    gardenId,
    raisedBedId,
}: {
    accountId: string;
    gardenId: number;
    raisedBedId: number;
}) {
    const operationId = await createOperation({
        accountId,
        entityId: 1,
        entityTypeName: 'operation',
        gardenId,
        raisedBedId,
    });

    await createEvent({
        type: knownEvents.operations.scheduledV1(operationId.toString(), {
            scheduledDate: new Date(0).toISOString(),
        }).type,
        version: 1,
        aggregateId: operationId.toString(),
        data: {},
    });

    return operationId;
}

async function createScheduledField({
    raisedBedId,
    positionIndex,
    scheduledDate,
}: {
    raisedBedId: number;
    positionIndex: number;
    scheduledDate: string;
}) {
    await upsertRaisedBedField({
        raisedBedId,
        positionIndex,
    });

    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(
            `${raisedBedId.toString()}|${positionIndex.toString()}`,
            {
                plantSortId: '101',
                scheduledDate,
            },
        ),
    );
}

async function createUnscheduledField({
    raisedBedId,
    positionIndex,
}: {
    raisedBedId: number;
    positionIndex: number;
}) {
    await upsertRaisedBedField({
        raisedBedId,
        positionIndex,
    });

    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(
            `${raisedBedId.toString()}|${positionIndex.toString()}`,
            {
                plantSortId: '101',
                scheduledDate: null,
            },
        ),
    );
}

test('rescheduleGardenDiaryOperation moves planned future operations', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createDiaryRescheduleContext();
    const operationId = await createScheduledOperation({
        accountId,
        gardenId,
        raisedBedId,
        scheduledDate: '2026-06-04T00:00:00.000Z',
    });

    await rescheduleGardenDiaryOperation({
        accountId,
        gardenId,
        operationId,
        scheduledDate: '2026-06-05',
        referenceDate: new Date('2026-06-03T12:00:00.000Z'),
    });

    const operation = await getOperationById(operationId);
    assert.equal(
        operation.scheduledDate?.toISOString(),
        '2026-06-05T00:00:00.000Z',
    );
});

test('rescheduleGardenDiaryOperation schedules planned operations without a date', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createDiaryRescheduleContext();
    const operationId = await createUnscheduledPlannedOperation({
        accountId,
        gardenId,
        raisedBedId,
    });

    await rescheduleGardenDiaryOperation({
        accountId,
        gardenId,
        operationId,
        scheduledDate: '2026-06-05',
        referenceDate: new Date('2026-06-03T12:00:00.000Z'),
    });

    const operation = await getOperationById(operationId);
    assert.equal(
        operation.scheduledDate?.toISOString(),
        '2026-06-05T00:00:00.000Z',
    );
});

test('rescheduleGardenDiaryOperation rejects items scheduled for today', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createDiaryRescheduleContext();
    const operationId = await createScheduledOperation({
        accountId,
        gardenId,
        raisedBedId,
        scheduledDate: '2026-06-03T00:00:00.000Z',
    });

    await assert.rejects(
        () =>
            rescheduleGardenDiaryOperation({
                accountId,
                gardenId,
                operationId,
                scheduledDate: '2026-06-04',
                referenceDate: new Date('2026-06-03T12:00:00.000Z'),
            }),
        (error) =>
            error instanceof GardenDiaryRescheduleError &&
            error.statusCode === 409,
    );
});

test('rescheduleGardenDiaryRaisedBedField moves planned future sowing', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createDiaryRescheduleContext();
    await createScheduledField({
        raisedBedId,
        positionIndex: 0,
        scheduledDate: '2026-06-04T00:00:00.000Z',
    });

    await rescheduleGardenDiaryRaisedBedField({
        accountId,
        gardenId,
        raisedBedId,
        positionIndex: 0,
        scheduledDate: '2026-06-06',
        referenceDate: new Date('2026-06-03T12:00:00.000Z'),
    });

    const raisedBed = await getRaisedBed(raisedBedId);
    const field = raisedBed?.fields.find(
        (candidate) => candidate.positionIndex === 0,
    );
    assert.equal(
        field?.plantScheduledDate?.toISOString(),
        '2026-06-06T00:00:00.000Z',
    );
});

test('rescheduleGardenDiaryRaisedBedField schedules planned sowing without a date', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createDiaryRescheduleContext();
    await createUnscheduledField({
        raisedBedId,
        positionIndex: 0,
    });

    await rescheduleGardenDiaryRaisedBedField({
        accountId,
        gardenId,
        raisedBedId,
        positionIndex: 0,
        scheduledDate: '2026-06-06',
        referenceDate: new Date('2026-06-03T12:00:00.000Z'),
    });

    const raisedBed = await getRaisedBed(raisedBedId);
    const field = raisedBed?.fields.find(
        (candidate) => candidate.positionIndex === 0,
    );
    assert.equal(
        field?.plantScheduledDate?.toISOString(),
        '2026-06-06T00:00:00.000Z',
    );
});

test('rescheduleGardenDiaryRaisedBedField rejects today as the new date', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createDiaryRescheduleContext();
    await createScheduledField({
        raisedBedId,
        positionIndex: 0,
        scheduledDate: '2026-06-04T00:00:00.000Z',
    });

    await assert.rejects(
        () =>
            rescheduleGardenDiaryRaisedBedField({
                accountId,
                gardenId,
                raisedBedId,
                positionIndex: 0,
                scheduledDate: '2026-06-03',
                referenceDate: new Date('2026-06-03T12:00:00.000Z'),
            }),
        (error) =>
            error instanceof GardenDiaryRescheduleError &&
            error.statusCode === 400,
    );
});

test('diary entries expose operation and field reschedule targets', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createDiaryRescheduleContext();
    const operationId = await createScheduledOperation({
        accountId,
        gardenId,
        raisedBedId,
        scheduledDate: '2026-06-04T00:00:00.000Z',
    });
    await createScheduledField({
        raisedBedId,
        positionIndex: 0,
        scheduledDate: '2026-06-05T00:00:00.000Z',
    });

    const raisedBedEntries = await getRaisedBedDiaryEntries(raisedBedId);
    const operationEntry = raisedBedEntries.find(
        (entry) => entry.id === operationId,
    );
    assert.deepEqual(operationEntry?.rescheduleTarget, {
        type: 'operation',
        operationId,
        raisedBedId,
        raisedBedFieldId: null,
        scheduledDate: '2026-06-04T00:00:00.000Z',
    });

    const fieldEntries = await getRaisedBedFieldDiaryEntries(raisedBedId, 0);
    const plannedFieldEntry = fieldEntries.find(
        (entry) => entry.name === 'Planirano sijanje',
    );
    assert.deepEqual(plannedFieldEntry?.rescheduleTarget, {
        type: 'raisedBedFieldPlant',
        raisedBedId,
        positionIndex: 0,
        scheduledDate: '2026-06-05T00:00:00.000Z',
    });
});
