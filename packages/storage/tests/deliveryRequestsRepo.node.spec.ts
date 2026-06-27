import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    acceptOperation,
    changeDeliveryRequestSlot,
    createAttributeDefinition,
    createDeliveryRequest,
    createEntity,
    createEvent,
    createFarm,
    createOperation,
    createOrGetHarvestTraceLink,
    createPickupLocation,
    createTimeSlot,
    DeliveryRequestStates,
    events,
    getDeliveryRequestsWithEvents,
    getPendingDeliveryReadyEmailRequestIds,
    getTimeSlot,
    knownEvents,
    knownEventTypes,
    raisedBedFields,
    raisedBeds,
    storage,
    TimeSlotStatuses,
    updateEntity,
    upsertAttributeValue,
    upsertEntityType,
    upsertRaisedBedField,
} from '@gredice/storage';
import { eq } from 'drizzle-orm';
import {
    createTestAccount,
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

async function insertDeliveryReadyEvent(
    aggregateId: string,
    createdAt: Date,
): Promise<number> {
    const [inserted] = await storage()
        .insert(events)
        .values({
            type: knownEventTypes.delivery.requestReady,
            version: 1,
            aggregateId,
            data: {
                status: DeliveryRequestStates.READY,
            },
            createdAt,
        })
        .returning({ id: events.id });

    assert.ok(inserted);
    return inserted.id;
}

async function insertDeliveryReadyEmailProcessedEvent({
    aggregateId,
    readyEventId,
    sentTo = [],
    completed,
    skipped,
}: {
    aggregateId: string;
    readyEventId: number;
    sentTo?: string[];
    completed?: boolean;
    skipped?: boolean;
}) {
    await storage()
        .insert(events)
        .values({
            type: knownEventTypes.delivery.requestReadyEmailProcessed,
            version: 1,
            aggregateId,
            data: {
                readyEventId,
                sentTo,
                batchRequestIds: [aggregateId],
                completed,
                skipped,
            },
        });
}

type DeliveryFixtureEntityTypeName = 'operation' | 'plantSort';

async function createPublishedDeliveryEntity(
    entityTypeName: DeliveryFixtureEntityTypeName,
    label: string,
) {
    await upsertEntityType({
        name: entityTypeName,
        label: entityTypeName === 'operation' ? 'Operations' : 'Plant sorts',
    });

    const nameDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'name',
        label: 'Name',
        entityTypeName,
        dataType: 'text',
    });
    const labelDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'label',
        label: 'Label',
        entityTypeName,
        dataType: 'text',
    });
    const entityId = await createEntity(entityTypeName);

    await upsertAttributeValue({
        attributeDefinitionId: nameDefinitionId,
        entityTypeName,
        entityId,
        value: label,
    });
    await upsertAttributeValue({
        attributeDefinitionId: labelDefinitionId,
        entityTypeName,
        entityId,
        value: label,
    });
    await updateEntity({ id: entityId, state: 'published' });

    return entityId;
}

async function createDeliveryRequestWithTraceFixture() {
    createTestDb();

    const harvestOperationEntityId = await createPublishedDeliveryEntity(
        'operation',
        'Harvest fruit',
    );
    const originalPlantSortId = await createPublishedDeliveryEntity(
        'plantSort',
        'Original tomato',
    );
    const latestPlantSortId = await createPublishedDeliveryEntity(
        'plantSort',
        'Latest cucumber',
    );
    const accountId = await createTestAccount();
    const farmId = await createFarm({
        name: `Delivery trace farm ${randomUUID()}`,
        longitude: 0,
        latitude: 0,
    });
    const gardenId = await createTestGarden({
        name: `Delivery trace garden ${randomUUID()}`,
        accountId,
        farmId,
    });
    const blockId = await createTestBlock(
        gardenId,
        `Delivery trace block ${randomUUID()}`,
    );
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);
    await storage()
        .update(raisedBeds)
        .set({ name: 'Dostavna gredica', physicalId: 'DELIVERY-TRACE' })
        .where(eq(raisedBeds.id, raisedBedId));
    await upsertRaisedBedField({ raisedBedId, positionIndex: 0 });
    const field = await storage().query.raisedBedFields.findFirst({
        where: eq(raisedBedFields.raisedBedId, raisedBedId),
    });
    assert.ok(field);

    const operationId = await createOperation({
        entityId: harvestOperationEntityId,
        entityTypeName: 'operation',
        accountId,
        farmId,
        gardenId,
        raisedBedId,
        raisedBedFieldId: field.id,
        timestamp: new Date('2026-05-30T07:00:00.000Z'),
    });
    await acceptOperation(operationId);
    await createEvent({
        ...knownEvents.operations.completedV1(operationId.toString(), {
            completedBy: randomUUID(),
        }),
        createdAt: new Date('2026-05-30T08:00:00.000Z'),
    });

    const [plantPlaceEvent] = await storage()
        .insert(events)
        .values({
            ...knownEvents.raisedBedFields.plantPlaceV1(
                `${raisedBedId}|${field.positionIndex}`,
                {
                    plantSortId: originalPlantSortId.toString(),
                    scheduledDate: null,
                    sowingLocation: 'direct',
                },
            ),
            createdAt: new Date('2026-05-01T08:00:00.000Z'),
        })
        .returning({ id: events.id });
    assert.ok(plantPlaceEvent);

    const traceLink = await createOrGetHarvestTraceLink({
        accountId,
        gardenId,
        raisedBedId,
        raisedBedFieldId: field.id,
        fieldPositionIndex: field.positionIndex,
        fieldLabel: '1',
        plantPlaceEventId: plantPlaceEvent.id,
        plantSortId: originalPlantSortId,
        harvestOperationId: operationId,
    });

    await storage()
        .insert(events)
        .values({
            ...knownEvents.raisedBedFields.plantPlaceV1(
                `${raisedBedId}|${field.positionIndex}`,
                {
                    plantSortId: latestPlantSortId.toString(),
                    scheduledDate: null,
                    sowingLocation: 'direct',
                },
            ),
            createdAt: new Date('2026-06-15T08:00:00.000Z'),
        });

    const locationId = await createPickupLocation({
        name: 'Gredice HQ',
        street1: 'Testna 1',
        city: 'Zagreb',
        postalCode: '10000',
        countryCode: 'HR',
    });
    const slotStartAt = new Date('2099-01-01T08:00:00.000Z');
    const slotId = await createTimeSlot({
        locationId,
        type: 'pickup',
        startAt: slotStartAt,
        endAt: new Date(slotStartAt.getTime() + 2 * 60 * 60 * 1000),
        status: TimeSlotStatuses.SCHEDULED,
    });
    const requestId = await createDeliveryRequest({
        operationId,
        slotId,
        mode: 'pickup',
        locationId,
        accountId,
    });

    return {
        accountId,
        locationId,
        latestPlantSortId,
        operationId,
        originalPlantSortId,
        requestId,
        traceLink,
    };
}

test('createDeliveryRequest rejects pickup slots after their close deadline', async () => {
    createTestDb();

    const locationId = await createPickupLocation({
        name: `Closed pickup location ${randomUUID()}`,
        street1: 'Testna 1',
        city: 'Zagreb',
        postalCode: '10000',
        countryCode: 'HR',
    });
    const slotStartAt = new Date('2099-01-02T08:00:00.000Z');
    const slotId = await createTimeSlot({
        locationId,
        type: 'pickup',
        startAt: slotStartAt,
        endAt: new Date(slotStartAt.getTime() + 2 * 60 * 60 * 1000),
        closesAt: new Date('2026-01-01T08:00:00.000Z'),
        status: TimeSlotStatuses.SCHEDULED,
    });

    await assert.rejects(
        createDeliveryRequest({
            operationId: 999_999,
            slotId,
            mode: 'pickup',
            locationId,
            accountId: randomUUID(),
        }),
        /Time slot is not available for booking/,
    );

    const slot = await getTimeSlot(slotId);
    assert.equal(slot?.status, TimeSlotStatuses.CLOSED);
});

test('changeDeliveryRequestSlot rejects pickup slots after their close deadline', async () => {
    const fixture = await createDeliveryRequestWithTraceFixture();
    const slotStartAt = new Date('2099-01-03T08:00:00.000Z');
    const slotId = await createTimeSlot({
        locationId: fixture.locationId,
        type: 'pickup',
        startAt: slotStartAt,
        endAt: new Date(slotStartAt.getTime() + 2 * 60 * 60 * 1000),
        closesAt: new Date('2026-01-01T08:00:00.000Z'),
        status: TimeSlotStatuses.SCHEDULED,
    });

    await assert.rejects(
        changeDeliveryRequestSlot(fixture.requestId, slotId),
        /Time slot is not available for booking/,
    );

    const slot = await getTimeSlot(slotId);
    assert.equal(slot?.status, TimeSlotStatuses.CLOSED);
});

test('getPendingDeliveryReadyEmailRequestIds returns ordered retryable ready events', async () => {
    createTestDb();

    const prefix = `delivery-ready-email-${randomUUID()}`;
    const firstRequestId = `${prefix}-first`;
    const partialRequestId = `${prefix}-partial`;
    const secondRequestId = `${prefix}-second`;
    const completedRequestId = `${prefix}-completed`;
    const skippedRequestId = `${prefix}-skipped`;
    const futureRequestId = `${prefix}-future`;

    const firstReadyEventId = await insertDeliveryReadyEvent(
        firstRequestId,
        new Date('2026-05-09T06:00:00.000Z'),
    );
    const completedReadyEventId = await insertDeliveryReadyEvent(
        completedRequestId,
        new Date('2026-05-09T06:01:00.000Z'),
    );
    const partialReadyEventId = await insertDeliveryReadyEvent(
        partialRequestId,
        new Date('2026-05-09T06:02:00.000Z'),
    );
    const skippedReadyEventId = await insertDeliveryReadyEvent(
        skippedRequestId,
        new Date('2026-05-09T06:03:00.000Z'),
    );
    const secondReadyEventId = await insertDeliveryReadyEvent(
        secondRequestId,
        new Date('2026-05-09T06:04:00.000Z'),
    );
    await insertDeliveryReadyEvent(
        futureRequestId,
        new Date('2026-05-09T08:00:00.000Z'),
    );

    await insertDeliveryReadyEmailProcessedEvent({
        aggregateId: completedRequestId,
        readyEventId: completedReadyEventId,
        sentTo: ['completed@example.com'],
        completed: true,
    });
    await insertDeliveryReadyEmailProcessedEvent({
        aggregateId: skippedRequestId,
        readyEventId: skippedReadyEventId,
        skipped: true,
    });
    await insertDeliveryReadyEmailProcessedEvent({
        aggregateId: partialRequestId,
        readyEventId: partialReadyEventId,
        sentTo: ['already-sent@example.com'],
    });

    const pendingRequests = await getPendingDeliveryReadyEmailRequestIds({
        readyBefore: new Date('2026-05-09T07:00:00.000Z'),
        limit: 200,
    });
    const matchingRequests = pendingRequests.filter((request) =>
        request.requestId.startsWith(prefix),
    );

    assert.deepEqual(
        matchingRequests.map((request) => ({
            requestId: request.requestId,
            readyEventId: request.readyEventId,
            processedRecipients: request.processedRecipients,
        })),
        [
            {
                requestId: firstRequestId,
                readyEventId: firstReadyEventId,
                processedRecipients: [],
            },
            {
                requestId: partialRequestId,
                readyEventId: partialReadyEventId,
                processedRecipients: ['already-sent@example.com'],
            },
            {
                requestId: secondRequestId,
                readyEventId: secondReadyEventId,
                processedRecipients: [],
            },
        ],
    );
});

test('getDeliveryRequestsWithEvents uses the traced harvest plant sort for plant rows', async () => {
    const fixture = await createDeliveryRequestWithTraceFixture();

    const requests = await getDeliveryRequestsWithEvents(fixture.accountId);
    const request = requests.find(
        (item) => item.operationId === fixture.operationId,
    );

    assert.ok(request);
    assert.deepEqual(request.trace, {
        id: fixture.traceLink.id,
        publicToken: fixture.traceLink.publicToken,
        publicPath: fixture.traceLink.tracePath,
    });
    assert.equal(request.plantSort?.id, fixture.originalPlantSortId);
    assert.notEqual(request.plantSort?.id, fixture.latestPlantSortId);
    assert.equal(request.plantSort?.information.name, 'Original tomato');
});
