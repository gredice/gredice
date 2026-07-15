import assert from 'node:assert/strict';
import test from 'node:test';
import {
    acceptOperation,
    cancelGardenDiaryOperation,
    cancelGardenDiaryRaisedBedField,
    convertOutletReservationForCartItem,
    createAccount,
    createAttributeDefinition,
    createEntity,
    createEvent,
    createOperation,
    createOutletOffer,
    earnSunflowers,
    GardenDiaryCancelError,
    GardenDiaryRescheduleError,
    getAttributeDefinitions,
    getNotificationsByAccount,
    getOperationById,
    getOrCreateShoppingCart,
    getRaisedBed,
    getRaisedBedDiaryEntries,
    getRaisedBedFieldDiaryEntries,
    getRaisedBedFieldPlantCycles,
    getSunflowers,
    knownEvents,
    type RaisedBedFieldPlantPurchase,
    rescheduleGardenDiaryOperation,
    rescheduleGardenDiaryRaisedBedField,
    reserveOutletOffer,
    setCartItemPaid,
    spendSunflowers,
    updateEntity,
    upsertAttributeValue,
    upsertEntityType,
    upsertOrRemoveCartItem,
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

async function expectedOperationIdentity(operationId: number) {
    const operation = await getOperationById(operationId);
    assert.ok(operation);
    return {
        expectedEntityId: operation.entityId,
        expectedTaskVersionEventId: operation.taskVersionEventId,
    };
}

async function expectedPlantingIdentity(
    raisedBedId: number,
    positionIndex: number,
) {
    const raisedBed = await getRaisedBed(raisedBedId);
    const field = raisedBed?.fields.find(
        (candidate) =>
            candidate.positionIndex === positionIndex && candidate.active,
    );
    const activePlantCycle = field?.plantCycles.find(
        (plantCycle) => plantCycle.active,
    );
    assert.ok(field?.plantSortId);
    assert.ok(activePlantCycle);
    return {
        expectedPlantCycleEventId: activePlantCycle.plantPlaceEventId,
        expectedPlantCycleVersionEventId: activePlantCycle.endedEventId,
        expectedPlantSortId: field.plantSortId,
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
        name: 'plant',
        label: 'Biljka',
    });
    await upsertEntityType({
        name: 'plantSort',
        label: 'Sorta biljke',
    });

    const plantNameDefinitionId = await ensureAttributeDefinition({
        category: 'information',
        dataType: 'text',
        entityTypeName: 'plant',
        label: 'Name',
        name: 'name',
    });
    const priceDefinitionId = await ensureAttributeDefinition({
        category: 'prices',
        dataType: 'number',
        entityTypeName: 'plant',
        label: 'Price per plant',
        name: 'perPlant',
    });
    const nameDefinitionId = await ensureAttributeDefinition({
        category: 'information',
        dataType: 'text',
        entityTypeName: 'plantSort',
        label: 'Name',
        name: 'name',
    });
    const plantDefinitionId = await ensureAttributeDefinition({
        category: 'information',
        dataType: 'ref:plant',
        entityTypeName: 'plantSort',
        label: 'Plant',
        name: 'plant',
    });
    const plantId = await createEntity('plant');
    const entityId = await createEntity('plantSort');

    await updateEntity({ id: plantId, state: 'published' });
    await updateEntity({ id: entityId, state: 'published' });
    await upsertAttributeValue({
        attributeDefinitionId: plantNameDefinitionId,
        entityTypeName: 'plant',
        entityId: plantId,
        value: 'Rajčica',
    });
    await upsertAttributeValue({
        attributeDefinitionId: nameDefinitionId,
        entityTypeName: 'plantSort',
        entityId,
        value: 'Cherry rajčica',
    });
    await upsertAttributeValue({
        attributeDefinitionId: priceDefinitionId,
        entityTypeName: 'plant',
        entityId: plantId,
        value: '1.5',
    });
    await upsertAttributeValue({
        attributeDefinitionId: plantDefinitionId,
        entityTypeName: 'plantSort',
        entityId,
        value: plantId.toString(),
    });

    return entityId;
}

async function createPaidPlantCartItem({
    accountId,
    amount,
    currency = 'sunflower',
    gardenId,
    plantSortId,
    positionIndex,
    raisedBedId,
}: {
    accountId: string;
    amount: number;
    currency?: 'eur' | 'inventory' | 'sunflower';
    gardenId: number;
    plantSortId: number;
    positionIndex: number;
    raisedBedId: number;
}) {
    const cart = await getOrCreateShoppingCart(accountId);
    assert.ok(cart);
    const cartItemId = await upsertOrRemoveCartItem(
        undefined,
        cart.id,
        plantSortId.toString(),
        'plantSort',
        1,
        gardenId,
        raisedBedId,
        positionIndex,
        undefined,
        currency,
        true,
    );
    assert.ok(cartItemId);

    if (currency === 'sunflower') {
        await earnSunflowers(accountId, amount, 'test-funding');
        await spendSunflowers(
            accountId,
            amount,
            `shoppingCartItem:${cartItemId.toString()}`,
        );
    }
    await setCartItemPaid(cartItemId);

    return cartItemId;
}

async function createScheduledOperation({
    accountId,
    entityId = 1,
    gardenId,
    raisedBedId,
    scheduledAt,
    scheduledDate,
}: {
    accountId: string;
    entityId?: number;
    gardenId: number;
    raisedBedId: number;
    scheduledAt?: Date;
    scheduledDate: string;
}) {
    const operationId = await createOperation({
        accountId,
        entityId,
        entityTypeName: 'operation',
        gardenId,
        raisedBedId,
    });

    await createEvent({
        ...knownEvents.operations.scheduledV1(operationId.toString(), {
            scheduledDate,
        }),
        ...(scheduledAt ? { createdAt: scheduledAt } : {}),
    });

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
    purchase,
    raisedBedId,
    positionIndex,
    scheduledDate,
}: {
    plantSortId?: number;
    purchase?: RaisedBedFieldPlantPurchase;
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
                ...(purchase ? { purchase } : {}),
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
        ...(await expectedOperationIdentity(operationId)),
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
        ...(await expectedOperationIdentity(operationId)),
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

test('rescheduleGardenDiaryOperation preserves pending-verification completion evidence', async () => {
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

    await assert.rejects(
        rescheduleGardenDiaryOperation({
            accountId,
            ...(await expectedOperationIdentity(operationId)),
            gardenId,
            operationId,
            scheduledDate: '2026-06-06',
            referenceDate: new Date('2026-06-03T12:00:00.000Z'),
        }),
        (error) =>
            error instanceof GardenDiaryRescheduleError &&
            error.statusCode === 409,
    );

    const operation = await getOperationById(operationId);
    assert.equal(operation.status, 'pendingVerification');
    assert.equal(
        operation.scheduledDate?.toISOString(),
        '2026-06-04T00:00:00.000Z',
    );
    assert.deepEqual(operation.assignedUserIds, ['farmer-1']);
    assert.equal(operation.assignedBy, 'admin-1');
    assert.equal(operation.isAccepted, true);
    assert.ok(operation.completedAt);
    assert.equal(operation.completedBy, 'farmer-1');
    assert.deepEqual(operation.imageUrls, [
        'https://example.com/confirmed.jpg',
    ]);
    assert.equal(operation.completionNotes, 'Potvrđeno za provjeru.');
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
        async () =>
            rescheduleGardenDiaryOperation({
                accountId,
                ...(await expectedOperationIdentity(operationId)),
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
        async () =>
            rescheduleGardenDiaryOperation({
                accountId,
                ...(await expectedOperationIdentity(operationId)),
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
        ...(await expectedPlantingIdentity(raisedBedId, 0)),
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
        ...(await expectedPlantingIdentity(raisedBedId, 0)),
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

test('rescheduleGardenDiaryRaisedBedField preserves pending-verification sowing evidence', async () => {
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

    await assert.rejects(
        rescheduleGardenDiaryRaisedBedField({
            accountId,
            ...(await expectedPlantingIdentity(raisedBedId, 0)),
            gardenId,
            raisedBedId,
            positionIndex: 0,
            scheduledDate: '2026-06-06',
            referenceDate: new Date('2026-06-03T12:00:00.000Z'),
        }),
        (error) =>
            error instanceof GardenDiaryRescheduleError &&
            error.statusCode === 409,
    );

    const raisedBed = await getRaisedBed(raisedBedId);
    const field = raisedBed?.fields.find(
        (candidate) => candidate.positionIndex === 0,
    );
    assert.equal(field?.plantStatus, 'pendingVerification');
    assert.equal(
        field?.plantScheduledDate?.toISOString(),
        '2026-06-04T00:00:00.000Z',
    );
    assert.deepEqual(field?.assignedUserIds, ['farmer-1']);
    assert.equal(field?.assignedBy, 'admin-1');
    assert.ok(field?.plantSowDate);
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
        async () =>
            rescheduleGardenDiaryRaisedBedField({
                accountId,
                ...(await expectedPlantingIdentity(raisedBedId, 0)),
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
        ...(await expectedOperationIdentity(operationId)),
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

test('cancelGardenDiaryOperation rolls back a failed refund and resumes a failed notification exactly once', async () => {
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
    const identity = await expectedOperationIdentity(operationId);
    const balanceBeforeCancel = await getSunflowers(accountId);
    const input = {
        accountId,
        canceledBy: 'user-1',
        ...identity,
        gardenId,
        operationId,
        referenceDate: new Date('2026-06-03T12:00:00.000Z'),
    };

    await assert.rejects(
        cancelGardenDiaryOperation(input, undefined, {
            earnSunflowers: async () => {
                throw new Error('injected operation refund failure');
            },
        }),
        /injected operation refund failure/,
    );
    assert.equal((await getOperationById(operationId)).status, 'planned');
    assert.equal(await getSunflowers(accountId), balanceBeforeCancel);

    await assert.rejects(
        cancelGardenDiaryOperation(input, undefined, {
            createNotification: async () => {
                throw new Error('injected operation notification failure');
            },
        }),
        /injected operation notification failure/,
    );
    assert.equal((await getOperationById(operationId)).status, 'canceled');
    assert.equal(await getSunflowers(accountId), balanceBeforeCancel + 2500);
    assert.equal(
        (await getNotificationsByAccount(accountId, false, 0, 10)).length,
        0,
    );

    const retried = await cancelGardenDiaryOperation({
        ...input,
        canceledBy: 'admin-2',
        reason: 'reconstructed retry payload',
    });
    const repeated = await cancelGardenDiaryOperation(input);
    const notifications = await getNotificationsByAccount(
        accountId,
        false,
        0,
        10,
    );

    assert.equal(retried.refundAmount, 2500);
    assert.equal(retried.reason, 'Korisnik je otkazao.');
    assert.deepEqual(repeated, retried);
    assert.equal(await getSunflowers(accountId), balanceBeforeCancel + 2500);
    assert.equal(notifications.length, 1);
});

test('cancelGardenDiaryOperation preserves pending-verification completion evidence', async () => {
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

    await assert.rejects(
        cancelGardenDiaryOperation({
            accountId,
            canceledBy: 'user-1',
            ...(await expectedOperationIdentity(operationId)),
            gardenId,
            operationId,
            referenceDate: new Date('2026-06-03T12:00:00.000Z'),
        }),
        (error) =>
            error instanceof GardenDiaryCancelError && error.statusCode === 409,
    );

    const operation = await getOperationById(operationId);
    assert.equal(operation.status, 'pendingVerification');
    assert.equal(operation.canceledBy, undefined);
    assert.ok(operation.completedAt);
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
        async () =>
            cancelGardenDiaryOperation({
                accountId,
                canceledBy: 'user-1',
                ...(await expectedOperationIdentity(operationId)),
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
    const paidAmount = 1750;
    const balanceBeforePurchase = await getSunflowers(accountId);

    const cartItemId = await createPaidPlantCartItem({
        accountId,
        amount: paidAmount,
        gardenId,
        plantSortId,
        positionIndex: 0,
        raisedBedId,
    });

    await createScheduledField({
        plantSortId,
        purchase: {
            cartItemId,
            currency: 'sunflower',
            sunflowerAmount: paidAmount,
        },
        raisedBedId,
        positionIndex: 0,
        scheduledDate: '2026-06-04T00:00:00.000Z',
    });

    const result = await cancelGardenDiaryRaisedBedField({
        accountId,
        canceledBy: 'user-1',
        ...(await expectedPlantingIdentity(raisedBedId, 0)),
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

    assert.equal(result.refundAmount, paidAmount);
    assert.equal(field?.active, false);
    assert.equal(field?.plantStatus, 'deleted');
    assert.equal(field?.plantSortId, undefined);
    assert.equal(field?.cancellationReason, 'Korisnik je otkazao.');
    assert.equal(plantCycle?.active, false);
    assert.equal(plantCycle?.plantStatus, 'deleted');
    assert.equal(plantCycle?.plantSortId, plantSortId);
    assert.deepEqual(plantCycle?.purchase, {
        cartItemId,
        currency: 'sunflower',
        sunflowerAmount: paidAmount,
    });
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
    assert.equal(
        await getSunflowers(accountId),
        balanceBeforePurchase + paidAmount,
    );
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]?.header, 'Sijanje je otkazano');
    assert.match(notifications[0]?.content ?? '', /1750 🌻/);
});

test('cancelGardenDiaryRaisedBedField rolls back a failed refund and resumes a failed notification exactly once', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createDiaryRescheduleContext();
    const plantSortId = await createPricedPlantSortEntity();
    const paidAmount = 1750;
    const balanceBeforePurchase = await getSunflowers(accountId);
    const cartItemId = await createPaidPlantCartItem({
        accountId,
        amount: paidAmount,
        gardenId,
        plantSortId,
        positionIndex: 0,
        raisedBedId,
    });
    await createScheduledField({
        plantSortId,
        purchase: {
            cartItemId,
            currency: 'sunflower',
            sunflowerAmount: paidAmount,
        },
        raisedBedId,
        positionIndex: 0,
        scheduledDate: '2026-06-04T00:00:00.000Z',
    });
    const identity = await expectedPlantingIdentity(raisedBedId, 0);
    const input = {
        accountId,
        canceledBy: 'user-1',
        ...identity,
        gardenId,
        positionIndex: 0,
        raisedBedId,
        referenceDate: new Date('2026-06-03T12:00:00.000Z'),
    };

    await assert.rejects(
        cancelGardenDiaryRaisedBedField(input, undefined, {
            earnSunflowers: async () => {
                throw new Error('injected planting refund failure');
            },
        }),
        /injected planting refund failure/,
    );
    const fieldAfterRefundFailure = (
        await getRaisedBed(raisedBedId)
    )?.fields.find((candidate) => candidate.positionIndex === 0);
    assert.equal(fieldAfterRefundFailure?.active, true);
    assert.equal(await getSunflowers(accountId), balanceBeforePurchase);

    await assert.rejects(
        cancelGardenDiaryRaisedBedField(input, undefined, {
            createNotification: async () => {
                throw new Error('injected planting notification failure');
            },
        }),
        /injected planting notification failure/,
    );
    const fieldAfterNotificationFailure = (
        await getRaisedBed(raisedBedId)
    )?.fields.find((candidate) => candidate.positionIndex === 0);
    assert.equal(fieldAfterNotificationFailure?.active, false);
    assert.equal(
        await getSunflowers(accountId),
        balanceBeforePurchase + paidAmount,
    );
    assert.equal(
        (await getNotificationsByAccount(accountId, false, 0, 10)).length,
        0,
    );

    const retried = await cancelGardenDiaryRaisedBedField({
        ...input,
        canceledBy: 'admin-2',
        reason: 'reconstructed retry payload',
    });
    const repeated = await cancelGardenDiaryRaisedBedField(input);
    const notifications = await getNotificationsByAccount(
        accountId,
        false,
        0,
        10,
    );

    assert.equal(retried.refundAmount, paidAmount);
    assert.equal(retried.canceledBy, 'user-1');
    assert.equal(retried.reason, 'Korisnik je otkazao.');
    assert.deepEqual(repeated, retried);
    assert.equal(
        await getSunflowers(accountId),
        balanceBeforePurchase + paidAmount,
    );
    assert.equal(notifications.length, 1);
});

test('cancelGardenDiaryRaisedBedField preserves pending-verification sowing evidence', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createDiaryRescheduleContext();
    const plantSortId = await createPricedPlantSortEntity();
    const aggregateId = `${raisedBedId.toString()}|0`;

    await createPaidPlantCartItem({
        accountId,
        amount: 1500,
        gardenId,
        plantSortId,
        positionIndex: 0,
        raisedBedId,
    });

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

    const balanceBeforeCancel = await getSunflowers(accountId);
    await assert.rejects(
        cancelGardenDiaryRaisedBedField({
            accountId,
            canceledBy: 'user-1',
            ...(await expectedPlantingIdentity(raisedBedId, 0)),
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
    assert.equal(field?.plantStatus, 'pendingVerification');
    assert.equal(field?.cancellationReason, undefined);
    assert.equal(await getSunflowers(accountId), balanceBeforeCancel);
});

test('cancelGardenDiaryRaisedBedField refunds euro plant purchases in sunflowers', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createDiaryRescheduleContext();
    const plantSortId = await createPricedPlantSortEntity();
    const balanceBeforeCancel = await getSunflowers(accountId);

    const cartItemId = await createPaidPlantCartItem({
        accountId,
        amount: 1500,
        currency: 'eur',
        gardenId,
        plantSortId,
        positionIndex: 0,
        raisedBedId,
    });
    await createScheduledField({
        plantSortId,
        purchase: {
            cartItemId,
            currency: 'eur',
            euroAmountCents: 150,
        },
        raisedBedId,
        positionIndex: 0,
        scheduledDate: '2026-06-04T00:00:00.000Z',
    });

    const result = await cancelGardenDiaryRaisedBedField({
        accountId,
        canceledBy: 'user-1',
        ...(await expectedPlantingIdentity(raisedBedId, 0)),
        gardenId,
        raisedBedId,
        positionIndex: 0,
        referenceDate: new Date('2026-06-03T12:00:00.000Z'),
    });

    assert.equal(result.refundAmount, 1500);
    assert.equal(await getSunflowers(accountId), balanceBeforeCancel + 1500);
});

test('cancelGardenDiaryRaisedBedField refunds the legacy outlet price', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createDiaryRescheduleContext();
    const plantSortId = await createPricedPlantSortEntity();
    const balanceBeforeCancel = await getSunflowers(accountId);
    const now = new Date();

    const cartItemId = await createPaidPlantCartItem({
        accountId,
        amount: 1500,
        currency: 'eur',
        gardenId,
        plantSortId,
        positionIndex: 0,
        raisedBedId,
    });
    const cart = await getOrCreateShoppingCart(accountId);
    assert.ok(cart);
    const outletOfferId = await createOutletOffer({
        plantSortId,
        sowingDate: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        initialPlantStatus: 'sprouted',
        imageUrls: [],
        outletPriceCents: 75,
        comparePriceCents: 150,
        quantity: 1,
        startAt: new Date(now.getTime() - 60 * 60 * 1000),
        endAt: new Date(now.getTime() + 60 * 60 * 1000),
        status: 'published',
        adminNotes: null,
    });
    await reserveOutletOffer({
        offerId: outletOfferId,
        accountId,
        cartId: cart.id,
        cartItemId,
        now,
    });
    await convertOutletReservationForCartItem(cartItemId, now);
    await createScheduledField({
        plantSortId,
        raisedBedId,
        positionIndex: 0,
        scheduledDate: '2026-06-04T00:00:00.000Z',
    });

    const result = await cancelGardenDiaryRaisedBedField({
        accountId,
        canceledBy: 'user-1',
        ...(await expectedPlantingIdentity(raisedBedId, 0)),
        gardenId,
        raisedBedId,
        positionIndex: 0,
        referenceDate: new Date('2026-06-03T12:00:00.000Z'),
    });

    assert.equal(result.refundAmount, 750);
    assert.equal(await getSunflowers(accountId), balanceBeforeCancel + 750);
});

test('cancelGardenDiaryRaisedBedField refunds each distinct plant cycle at the same position', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createDiaryRescheduleContext();
    const plantSortId = await createPricedPlantSortEntity();
    const balanceBeforeCancel = await getSunflowers(accountId);
    const cancel = async () => {
        const identity = await expectedPlantingIdentity(raisedBedId, 0);
        await cancelGardenDiaryRaisedBedField({
            accountId,
            canceledBy: 'user-1',
            ...identity,
            gardenId,
            raisedBedId,
            positionIndex: 0,
            referenceDate: new Date('2026-06-03T12:00:00.000Z'),
        });
        return identity.expectedPlantCycleEventId;
    };

    await createScheduledField({
        plantSortId,
        purchase: {
            cartItemId: 10_001,
            currency: 'sunflower',
            sunflowerAmount: 1500,
        },
        raisedBedId,
        positionIndex: 0,
        scheduledDate: '2026-06-04T00:00:00.000Z',
    });
    const firstPlantCycleEventId = await cancel();

    await createScheduledField({
        plantSortId,
        purchase: {
            cartItemId: 10_002,
            currency: 'sunflower',
            sunflowerAmount: 1500,
        },
        raisedBedId,
        positionIndex: 0,
        scheduledDate: '2026-06-05T00:00:00.000Z',
    });
    const secondPlantCycleEventId = await cancel();

    assert.notEqual(firstPlantCycleEventId, secondPlantCycleEventId);
    assert.equal(await getSunflowers(accountId), balanceBeforeCancel + 3000);
});

test('cancelGardenDiaryRaisedBedField does not refund inventory plantings', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createDiaryRescheduleContext();
    const plantSortId = await createPricedPlantSortEntity();
    const balanceBeforeCancel = await getSunflowers(accountId);

    const cartItemId = await createPaidPlantCartItem({
        accountId,
        amount: 0,
        currency: 'inventory',
        gardenId,
        plantSortId,
        positionIndex: 0,
        raisedBedId,
    });
    await createScheduledField({
        plantSortId,
        purchase: {
            cartItemId,
            currency: 'inventory',
        },
        raisedBedId,
        positionIndex: 0,
        scheduledDate: '2026-06-04T00:00:00.000Z',
    });

    const result = await cancelGardenDiaryRaisedBedField({
        accountId,
        canceledBy: 'user-1',
        ...(await expectedPlantingIdentity(raisedBedId, 0)),
        gardenId,
        raisedBedId,
        positionIndex: 0,
        referenceDate: new Date('2026-06-03T12:00:00.000Z'),
    });

    assert.equal(result.refundAmount, 0);
    assert.equal(await getSunflowers(accountId), balanceBeforeCancel);
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
        async () =>
            cancelGardenDiaryRaisedBedField({
                accountId,
                canceledBy: 'user-1',
                ...(await expectedPlantingIdentity(raisedBedId, 0)),
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
        ...(await expectedOperationIdentity(operationId)),
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
        ...(await expectedPlantingIdentity(raisedBedId, 0)),
        raisedBedId,
        positionIndex: 0,
        scheduledDate: '2026-06-05T00:00:00.000Z',
    });
});

test('diary entries can hide unverified operation images', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createDiaryRescheduleContext();
    await upsertRaisedBedField({
        raisedBedId,
        positionIndex: 0,
    });
    const raisedBed = await getRaisedBed(raisedBedId);
    const raisedBedFieldId = raisedBed?.fields[0]?.id;
    if (!raisedBedFieldId) {
        throw new Error('Expected test raised bed field.');
    }

    const raisedBedOperationId = await createOperation({
        accountId,
        entityId: 1,
        entityTypeName: 'operation',
        gardenId,
        raisedBedId,
    });
    const fieldOperationId = await createOperation({
        accountId,
        entityId: 1,
        entityTypeName: 'operation',
        gardenId,
        raisedBedId,
        raisedBedFieldId,
    });

    await createEvent(
        knownEvents.operations.completedV1(raisedBedOperationId.toString(), {
            completedBy: 'test-user',
            images: ['https://cdn.gredice.com/raised-bed-pending.jpg'],
        }),
    );
    await createEvent(
        knownEvents.operations.completedV1(fieldOperationId.toString(), {
            completedBy: 'test-user',
            images: ['https://cdn.gredice.com/field-pending.jpg'],
        }),
    );

    const defaultRaisedBedEntries = await getRaisedBedDiaryEntries(raisedBedId);
    assert.deepEqual(
        defaultRaisedBedEntries.find(
            (entry) => entry.id === raisedBedOperationId,
        )?.imageUrls,
        ['https://cdn.gredice.com/raised-bed-pending.jpg'],
    );

    const publicRaisedBedEntries = await getRaisedBedDiaryEntries(raisedBedId, {
        includeUnverifiedOperationEvidence: false,
    });
    assert.equal(
        publicRaisedBedEntries.find(
            (entry) => entry.id === raisedBedOperationId,
        )?.imageUrls,
        undefined,
    );

    const publicFieldEntries = await getRaisedBedFieldDiaryEntries(
        raisedBedId,
        0,
        { includeUnverifiedOperationEvidence: false },
    );
    assert.equal(
        publicFieldEntries.find((entry) => entry.id === fieldOperationId)
            ?.imageUrls,
        undefined,
    );

    await createEvent(
        knownEvents.operations.verifiedV1(raisedBedOperationId.toString(), {
            verifiedBy: 'admin-user',
        }),
    );

    const verifiedPublicEntries = await getRaisedBedDiaryEntries(raisedBedId, {
        includeUnverifiedOperationEvidence: false,
    });
    assert.deepEqual(
        verifiedPublicEntries.find((entry) => entry.id === raisedBedOperationId)
            ?.imageUrls,
        ['https://cdn.gredice.com/raised-bed-pending.jpg'],
    );
});

test('raised bed diary entries display and order completed operations by completion date', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createDiaryRescheduleContext();
    const scheduledCompletedOperationId = await createScheduledOperation({
        accountId,
        gardenId,
        raisedBedId,
        scheduledAt: new Date('2026-07-14T08:00:00.000Z'),
        scheduledDate: '2030-06-25T00:00:00.000Z',
    });
    const completedOperationId = await createOperation({
        accountId,
        entityId: 1,
        entityTypeName: 'operation',
        gardenId,
        raisedBedId,
    });

    await createEvent({
        ...knownEvents.operations.completedV1(
            scheduledCompletedOperationId.toString(),
            {
                completedBy: 'test-user',
            },
        ),
        createdAt: new Date('2026-07-15T08:00:00.000Z'),
    });
    await createEvent({
        ...knownEvents.operations.completedV1(completedOperationId.toString(), {
            completedBy: 'test-user',
        }),
        createdAt: new Date('2026-07-16T08:00:00.000Z'),
    });

    const raisedBedEntries = await getRaisedBedDiaryEntries(raisedBedId);
    assert.equal(
        raisedBedEntries
            .find((entry) => entry.id === scheduledCompletedOperationId)
            ?.timestamp.toISOString(),
        '2026-07-15T08:00:00.000Z',
    );
    const operationEntryIds = raisedBedEntries
        .map((entry) => entry.id)
        .filter((entryId) =>
            [scheduledCompletedOperationId, completedOperationId].includes(
                entryId,
            ),
        );

    assert.deepEqual(operationEntryIds, [
        completedOperationId,
        scheduledCompletedOperationId,
    ]);
});

test('raised bed diary keeps an operation blocker after the task is rescheduled', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createDiaryRescheduleContext();
    const operationId = await createScheduledOperation({
        accountId,
        gardenId,
        raisedBedId,
        scheduledDate: '2026-07-18T08:00:00.000Z',
    });
    const blockedAt = new Date('2026-07-15T08:30:00.000Z');
    const blockEvent = await createEvent({
        ...knownEvents.operations.blockedV1(operationId.toString(), {
            blockedBy: 'farmer-1',
            images: ['https://cdn.gredice.com/operation-blocker.jpg'],
            note: 'Pristup gredici je poplavljen.',
            reasonCode: 'location_not_ready',
            reasonLabel: 'Biljka, gredica ili lokacija nije spremna',
        }),
        createdAt: blockedAt,
    });

    await rescheduleGardenDiaryOperation({
        accountId,
        ...(await expectedOperationIdentity(operationId)),
        gardenId,
        operationId,
        referenceDate: new Date('2026-07-15T09:00:00.000Z'),
        scheduledDate: '2026-07-20T08:00:00.000Z',
    });

    const entries = await getRaisedBedDiaryEntries(raisedBedId);
    const blockerEntry = entries.find((entry) => entry.id === blockEvent.id);
    assert.ok(blockerEntry);
    assert.equal(blockerEntry.status, 'Blokirano');
    assert.equal(blockerEntry.timestamp.toISOString(), blockedAt.toISOString());
    assert.equal(
        blockerEntry.description,
        'Biljka, gredica ili lokacija nije spremna: Pristup gredici je poplavljen.',
    );
    assert.deepEqual(blockerEntry.imageUrls, [
        'https://cdn.gredice.com/operation-blocker.jpg',
    ]);

    const currentTaskEntry = entries.find((entry) => entry.id === operationId);
    assert.equal(currentTaskEntry?.status, 'Planirano');
});

test('recovered operation attempt rejects stale diary reschedule and cancel requests', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createDiaryRescheduleContext();
    const operationId = await createScheduledOperation({
        accountId,
        gardenId,
        raisedBedId,
        scheduledDate: '2026-07-18T08:00:00.000Z',
    });
    await createEvent(
        knownEvents.operations.blockedV1(operationId.toString(), {
            blockedBy: 'farmer-1',
            reasonCode: 'unsafe_conditions',
            reasonLabel: 'Vrijeme ili uvjeti nisu sigurni',
        }),
    );
    const staleIdentity = await expectedOperationIdentity(operationId);

    await rescheduleGardenDiaryOperation({
        accountId,
        ...staleIdentity,
        gardenId,
        operationId,
        referenceDate: new Date('2026-07-15T09:00:00.000Z'),
        scheduledDate: '2026-07-20T08:00:00.000Z',
    });

    await Promise.all([
        assert.rejects(
            rescheduleGardenDiaryOperation({
                accountId,
                ...staleIdentity,
                gardenId,
                operationId,
                referenceDate: new Date('2026-07-15T09:00:00.000Z'),
                scheduledDate: '2026-07-21T08:00:00.000Z',
            }),
            (error) =>
                error instanceof GardenDiaryRescheduleError &&
                error.statusCode === 409,
        ),
        assert.rejects(
            cancelGardenDiaryOperation({
                accountId,
                canceledBy: 'farmer-1',
                ...staleIdentity,
                gardenId,
                operationId,
                referenceDate: new Date('2026-07-15T09:00:00.000Z'),
            }),
            (error) =>
                error instanceof GardenDiaryCancelError &&
                error.statusCode === 409,
        ),
    ]);

    const operation = await getOperationById(operationId);
    assert.equal(operation.status, 'planned');
    assert.equal(
        operation.scheduledDate?.toISOString(),
        '2026-07-20T00:00:00.000Z',
    );
});

test('recovered planting attempt rejects stale diary reschedule and cancel requests', async () => {
    createTestDb();
    const { accountId, gardenId, raisedBedId } =
        await createDiaryRescheduleContext();
    const positionIndex = 0;
    await createScheduledField({
        raisedBedId,
        positionIndex,
        scheduledDate: '2026-07-18T08:00:00.000Z',
    });
    await createEvent(
        knownEvents.raisedBedFields.plantBlockedV1(
            `${raisedBedId.toString()}|${positionIndex.toString()}`,
            {
                blockedBy: 'farmer-1',
                reasonCode: 'unsafe_conditions',
                reasonLabel: 'Vrijeme ili uvjeti nisu sigurni',
            },
        ),
    );
    const staleIdentity = await expectedPlantingIdentity(
        raisedBedId,
        positionIndex,
    );

    await rescheduleGardenDiaryRaisedBedField({
        accountId,
        ...staleIdentity,
        gardenId,
        raisedBedId,
        positionIndex,
        referenceDate: new Date('2026-07-15T09:00:00.000Z'),
        scheduledDate: '2026-07-20T08:00:00.000Z',
    });

    await Promise.all([
        assert.rejects(
            rescheduleGardenDiaryRaisedBedField({
                accountId,
                ...staleIdentity,
                gardenId,
                raisedBedId,
                positionIndex,
                referenceDate: new Date('2026-07-15T09:00:00.000Z'),
                scheduledDate: '2026-07-21T08:00:00.000Z',
            }),
            (error) =>
                error instanceof GardenDiaryRescheduleError &&
                error.statusCode === 409,
        ),
        assert.rejects(
            cancelGardenDiaryRaisedBedField({
                accountId,
                canceledBy: 'farmer-1',
                ...staleIdentity,
                gardenId,
                raisedBedId,
                positionIndex,
                referenceDate: new Date('2026-07-15T09:00:00.000Z'),
            }),
            (error) =>
                error instanceof GardenDiaryCancelError &&
                error.statusCode === 409,
        ),
    ]);

    const raisedBed = await getRaisedBed(raisedBedId);
    const field = raisedBed?.fields.find(
        (candidate) => candidate.positionIndex === positionIndex,
    );
    assert.equal(field?.plantStatus, 'planned');
    assert.equal(
        field?.plantScheduledDate?.toISOString(),
        '2026-07-20T00:00:00.000Z',
    );
});
