import assert from 'node:assert/strict';
import test from 'node:test';
import {
    acceptOperation,
    cancelGardenDiaryOperation,
    cancelGardenDiaryRaisedBedField,
    createAccount,
    createAttributeDefinition,
    createEntity,
    createEvent,
    createOperation,
    GardenDiaryCancelError,
    GardenDiaryRescheduleError,
    getAttributeDefinitions,
    getNotificationsByAccount,
    getOperationById,
    getRaisedBed,
    getRaisedBedDiaryEntries,
    getRaisedBedFieldDiaryEntries,
    getRaisedBedFieldPlantCycles,
    getSunflowers,
    knownEvents,
    rescheduleGardenDiaryOperation,
    rescheduleGardenDiaryRaisedBedField,
    updateEntity,
    upsertAttributeValue,
    upsertEntityType,
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

async function ensureAttributeDefinition({
    category,
    dataType,
    entityTypeName,
    label,
    name,
}: {
    category: string;
    dataType: string;
    entityTypeName: string;
    label: string;
    name: string;
}) {
    const existing = (await getAttributeDefinitions(entityTypeName)).find(
        (definition) =>
            definition.category === category &&
            definition.name === name &&
            definition.dataType === dataType,
    );

    if (existing) {
        return existing.id;
    }

    return createAttributeDefinition({
        category,
        dataType,
        entityTypeName,
        label,
        name,
    });
}

async function createPricedOperationEntity() {
    await upsertEntityType({
        name: 'operation',
        label: 'Radnja',
    });

    const labelDefinitionId = await ensureAttributeDefinition({
        category: 'information',
        dataType: 'text',
        entityTypeName: 'operation',
        label: 'Label',
        name: 'label',
    });
    const priceDefinitionId = await ensureAttributeDefinition({
        category: 'prices',
        dataType: 'number',
        entityTypeName: 'operation',
        label: 'Price per operation',
        name: 'perOperation',
    });
    const entityId = await createEntity('operation');

    await updateEntity({ id: entityId, state: 'published' });
    await upsertAttributeValue({
        attributeDefinitionId: labelDefinitionId,
        entityTypeName: 'operation',
        entityId,
        value: 'Zalijevanje',
    });
    await upsertAttributeValue({
        attributeDefinitionId: priceDefinitionId,
        entityTypeName: 'operation',
        entityId,
        value: '2.5',
    });

    return entityId;
}

async function createPricedPlantSortEntity() {
    await upsertEntityType({
        name: 'plantSort',
        label: 'Sorta biljke',
    });

    const nameDefinitionId = await ensureAttributeDefinition({
        category: 'information',
        dataType: 'text',
        entityTypeName: 'plantSort',
        label: 'Name',
        name: 'name',
    });
    const priceDefinitionId = await ensureAttributeDefinition({
        category: 'prices',
        dataType: 'number',
        entityTypeName: 'plantSort',
        label: 'Price per plant',
        name: 'perPlant',
    });
    const entityId = await createEntity('plantSort');

    await updateEntity({ id: entityId, state: 'published' });
    await upsertAttributeValue({
        attributeDefinitionId: nameDefinitionId,
        entityTypeName: 'plantSort',
        entityId,
        value: 'Cherry rajčica',
    });
    await upsertAttributeValue({
        attributeDefinitionId: priceDefinitionId,
        entityTypeName: 'plantSort',
        entityId,
        value: '1.5',
    });

    return entityId;
}

async function createScheduledOperation({
    accountId,
    entityId = 1,
    gardenId,
    raisedBedId,
    scheduledDate,
}: {
    accountId: string;
    entityId?: number;
    gardenId: number;
    raisedBedId: number;
    scheduledDate: string;
}) {
    const operationId = await createOperation({
        accountId,
        entityId,
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
    plantSortId = 101,
    raisedBedId,
    positionIndex,
    scheduledDate,
}: {
    plantSortId?: number;
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
                plantSortId: plantSortId.toString(),
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

test('rescheduleGardenDiaryOperation returns confirmed operations to planned and keeps assignment', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createDiaryRescheduleContext();
    const operationId = await createScheduledOperation({
        accountId,
        gardenId,
        raisedBedId,
        scheduledDate: '2026-06-04T00:00:00.000Z',
    });

    await createEvent(
        knownEvents.operations.assignedV1(operationId.toString(), {
            assignedUserIds: ['farmer-1'],
            assignedBy: 'admin-1',
        }),
    );
    await acceptOperation(operationId);
    await createEvent(
        knownEvents.operations.completedV1(operationId.toString(), {
            completedBy: 'farmer-1',
            images: ['https://example.com/confirmed.jpg'],
            notes: 'Potvrđeno za provjeru.',
        }),
    );

    await rescheduleGardenDiaryOperation({
        accountId,
        gardenId,
        operationId,
        scheduledDate: '2026-06-06',
        referenceDate: new Date('2026-06-03T12:00:00.000Z'),
    });

    const operation = await getOperationById(operationId);
    assert.equal(operation.status, 'planned');
    assert.equal(
        operation.scheduledDate?.toISOString(),
        '2026-06-06T00:00:00.000Z',
    );
    assert.deepEqual(operation.assignedUserIds, ['farmer-1']);
    assert.equal(operation.assignedBy, 'admin-1');
    assert.equal(operation.isAccepted, false);
    assert.equal(operation.completedAt, undefined);
    assert.equal(operation.completedBy, undefined);
    assert.equal(operation.imageUrls, undefined);
    assert.equal(operation.completionNotes, undefined);
});

test('rescheduleGardenDiaryOperation rejects completed operations', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createDiaryRescheduleContext();
    const operationId = await createScheduledOperation({
        accountId,
        gardenId,
        raisedBedId,
        scheduledDate: '2026-06-04T00:00:00.000Z',
    });

    await createEvent(
        knownEvents.operations.completedV1(operationId.toString(), {
            completedBy: 'farmer-1',
        }),
    );
    await createEvent(
        knownEvents.operations.verifiedV1(operationId.toString(), {
            verifiedBy: 'admin-1',
        }),
    );

    await assert.rejects(
        () =>
            rescheduleGardenDiaryOperation({
                accountId,
                gardenId,
                operationId,
                scheduledDate: '2026-06-06',
                referenceDate: new Date('2026-06-03T12:00:00.000Z'),
            }),
        (error) =>
            error instanceof GardenDiaryRescheduleError &&
            error.statusCode === 409,
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

test('rescheduleGardenDiaryRaisedBedField returns confirmed sowing to planned and keeps assignment', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createDiaryRescheduleContext();
    const aggregateId = `${raisedBedId.toString()}|0`;
    await createScheduledField({
        raisedBedId,
        positionIndex: 0,
        scheduledDate: '2026-06-04T00:00:00.000Z',
    });

    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
            assignedUserIds: ['farmer-1'],
            assignedBy: 'admin-1',
        }),
    );
    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
            status: 'pendingVerification',
        }),
    );

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
    assert.equal(field?.plantStatus, 'planned');
    assert.equal(
        field?.plantScheduledDate?.toISOString(),
        '2026-06-06T00:00:00.000Z',
    );
    assert.deepEqual(field?.assignedUserIds, ['farmer-1']);
    assert.equal(field?.assignedBy, 'admin-1');
    assert.equal(field?.plantSowDate, undefined);
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

test('cancelGardenDiaryOperation cancels future planned operations with refund and notification', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createDiaryRescheduleContext();
    const entityId = await createPricedOperationEntity();
    const operationId = await createScheduledOperation({
        accountId,
        entityId,
        gardenId,
        raisedBedId,
        scheduledDate: '2026-06-04T00:00:00.000Z',
    });

    const result = await cancelGardenDiaryOperation({
        accountId,
        canceledBy: 'user-1',
        gardenId,
        operationId,
        referenceDate: new Date('2026-06-03T12:00:00.000Z'),
    });

    const operation = await getOperationById(operationId);
    const notifications = await getNotificationsByAccount(
        accountId,
        false,
        0,
        10,
    );

    assert.equal(result.refundAmount, 2500);
    assert.equal(operation.status, 'canceled');
    assert.equal(operation.canceledBy, 'user-1');
    assert.equal(operation.cancelReason, 'Korisnik je otkazao.');
    assert.equal(await getSunflowers(accountId), 3500);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]?.header, 'Radnja je otkazana');
    assert.match(notifications[0]?.content ?? '', /2500 🌻/);
});

test('cancelGardenDiaryOperation cancels future confirmed operations', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createDiaryRescheduleContext();
    const entityId = await createPricedOperationEntity();
    const operationId = await createScheduledOperation({
        accountId,
        entityId,
        gardenId,
        raisedBedId,
        scheduledDate: '2026-06-04T00:00:00.000Z',
    });

    await createEvent(
        knownEvents.operations.completedV1(operationId.toString(), {
            completedBy: 'farmer-1',
        }),
    );

    const result = await cancelGardenDiaryOperation({
        accountId,
        canceledBy: 'user-1',
        gardenId,
        operationId,
        referenceDate: new Date('2026-06-03T12:00:00.000Z'),
    });

    const operation = await getOperationById(operationId);
    assert.equal(result.refundAmount, 2500);
    assert.equal(operation.status, 'canceled');
    assert.equal(operation.canceledBy, 'user-1');
});

test('cancelGardenDiaryOperation rejects items scheduled for today', async () => {
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
            cancelGardenDiaryOperation({
                accountId,
                canceledBy: 'user-1',
                gardenId,
                operationId,
                referenceDate: new Date('2026-06-03T12:00:00.000Z'),
            }),
        (error) =>
            error instanceof GardenDiaryCancelError && error.statusCode === 409,
    );

    const operation = await getOperationById(operationId);
    assert.equal(operation.status, 'planned');
});

test('cancelGardenDiaryRaisedBedField removes future planned sowing with refund and notification', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createDiaryRescheduleContext();
    const plantSortId = await createPricedPlantSortEntity();

    await createScheduledField({
        plantSortId,
        raisedBedId,
        positionIndex: 0,
        scheduledDate: '2026-06-04T00:00:00.000Z',
    });

    const result = await cancelGardenDiaryRaisedBedField({
        accountId,
        canceledBy: 'user-1',
        gardenId,
        raisedBedId,
        positionIndex: 0,
        referenceDate: new Date('2026-06-03T12:00:00.000Z'),
    });

    const raisedBed = await getRaisedBed(raisedBedId);
    const field = raisedBed?.fields.find(
        (candidate) => candidate.positionIndex === 0,
    );
    const [plantCycle] = await getRaisedBedFieldPlantCycles(raisedBedId);
    const notifications = await getNotificationsByAccount(
        accountId,
        false,
        0,
        10,
    );

    assert.equal(result.refundAmount, 1500);
    assert.equal(field?.active, false);
    assert.equal(field?.plantStatus, 'deleted');
    assert.equal(field?.plantSortId, undefined);
    assert.equal(field?.cancellationReason, 'Korisnik je otkazao.');
    assert.equal(plantCycle?.active, false);
    assert.equal(plantCycle?.plantStatus, 'deleted');
    assert.equal(plantCycle?.plantSortId, plantSortId);
    assert.equal(plantCycle?.cancellationReason, 'Korisnik je otkazao.');
    const [cancelDiaryEntry] = await getRaisedBedFieldDiaryEntries(
        raisedBedId,
        0,
    );
    assert.equal(cancelDiaryEntry?.name, 'Sijanje otkazano');
    assert.equal(
        cancelDiaryEntry?.description,
        'Razlog otkazivanja: Korisnik je otkazao.',
    );
    assert.equal(await getSunflowers(accountId), 2500);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]?.header, 'Sijanje je otkazano');
    assert.match(notifications[0]?.content ?? '', /1500 🌻/);
});

test('cancelGardenDiaryRaisedBedField removes future confirmed sowing', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createDiaryRescheduleContext();
    const plantSortId = await createPricedPlantSortEntity();
    const aggregateId = `${raisedBedId.toString()}|0`;

    await createScheduledField({
        plantSortId,
        raisedBedId,
        positionIndex: 0,
        scheduledDate: '2026-06-04T00:00:00.000Z',
    });
    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
            status: 'pendingVerification',
        }),
    );

    const result = await cancelGardenDiaryRaisedBedField({
        accountId,
        canceledBy: 'user-1',
        gardenId,
        raisedBedId,
        positionIndex: 0,
        referenceDate: new Date('2026-06-03T12:00:00.000Z'),
    });

    const raisedBed = await getRaisedBed(raisedBedId);
    const field = raisedBed?.fields.find(
        (candidate) => candidate.positionIndex === 0,
    );
    assert.equal(result.refundAmount, 1500);
    assert.equal(field?.active, false);
    assert.equal(field?.plantStatus, 'deleted');
    assert.equal(field?.cancellationReason, 'Korisnik je otkazao.');
});

test('cancelGardenDiaryRaisedBedField rejects sowing scheduled for today', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createDiaryRescheduleContext();

    await createScheduledField({
        raisedBedId,
        positionIndex: 0,
        scheduledDate: '2026-06-03T00:00:00.000Z',
    });

    await assert.rejects(
        () =>
            cancelGardenDiaryRaisedBedField({
                accountId,
                canceledBy: 'user-1',
                gardenId,
                raisedBedId,
                positionIndex: 0,
                referenceDate: new Date('2026-06-03T12:00:00.000Z'),
            }),
        (error) =>
            error instanceof GardenDiaryCancelError && error.statusCode === 409,
    );

    const raisedBed = await getRaisedBed(raisedBedId);
    const field = raisedBed?.fields.find(
        (candidate) => candidate.positionIndex === 0,
    );
    assert.equal(field?.active, true);
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

test('raised bed diary entries order operations by scheduled or completed dates', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createDiaryRescheduleContext();
    const scheduledCompletedOperationId = await createScheduledOperation({
        accountId,
        gardenId,
        raisedBedId,
        scheduledDate: '2030-06-25T00:00:00.000Z',
    });
    const completedOperationId = await createOperation({
        accountId,
        entityId: 1,
        entityTypeName: 'operation',
        gardenId,
        raisedBedId,
    });

    await createEvent(
        knownEvents.operations.completedV1(
            scheduledCompletedOperationId.toString(),
            {
                completedBy: 'test-user',
            },
        ),
    );
    await createEvent(
        knownEvents.operations.completedV1(completedOperationId.toString(), {
            completedBy: 'test-user',
        }),
    );

    const raisedBedEntries = await getRaisedBedDiaryEntries(raisedBedId);
    const operationEntryIds = raisedBedEntries
        .map((entry) => entry.id)
        .filter((entryId) =>
            [scheduledCompletedOperationId, completedOperationId].includes(
                entryId,
            ),
        );

    assert.deepEqual(operationEntryIds, [
        scheduledCompletedOperationId,
        completedOperationId,
    ]);
});
