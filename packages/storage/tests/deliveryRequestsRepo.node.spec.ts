import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    acceptOperation,
    cancelDeliveryRequest,
    cancelDeliveryRequestForAccount,
    changeDeliveryRequestSlot,
    createAttributeDefinition,
    createDeliveryAddress,
    createDeliveryRequest,
    createEntity,
    createEvent,
    createFarm,
    createOperation,
    createOrGetHarvestTraceLink,
    createPickupLocation,
    createTimeSlot,
    DeliveryRequestStates,
    deliveryRequests,
    events,
    getDeliveryDispatchRevision,
    getDeliveryRequest,
    getDeliveryRequestsWithEvents,
    getPendingDeliveryReadyEmailRequestIds,
    getTimeSlot,
    knownEvents,
    knownEventTypes,
    operations,
    raisedBedFields,
    raisedBeds,
    storage,
    TimeSlotStatuses,
    uncancelDeliveryRequest,
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

test('createDeliveryRequest enforces operation and address ownership', async () => {
    createTestDb();

    const ownerAccountId = await createTestAccount();
    const foreignAccountId = await createTestAccount();
    const locationId = await createPickupLocation({
        name: `Ownership location ${randomUUID()}`,
        street1: 'Testna 1',
        city: 'Zagreb',
        postalCode: '10000',
        countryCode: 'HR',
    });
    const slotStartAt = new Date('2099-02-01T08:00:00.000Z');
    const pickupSlotId = await createTimeSlot({
        locationId,
        type: 'pickup',
        startAt: slotStartAt,
        endAt: new Date(slotStartAt.getTime() + 2 * 60 * 60 * 1000),
        status: TimeSlotStatuses.SCHEDULED,
    });
    const deliverySlotId = await createTimeSlot({
        locationId,
        type: 'delivery',
        startAt: slotStartAt,
        endAt: new Date(slotStartAt.getTime() + 2 * 60 * 60 * 1000),
        status: TimeSlotStatuses.SCHEDULED,
    });
    const [operation] = await storage()
        .insert(operations)
        .values({
            entityId: 1,
            entityTypeName: 'operation',
            accountId: ownerAccountId,
        })
        .returning({ id: operations.id });
    assert.ok(operation);
    const foreignAddressId = await createDeliveryAddress({
        accountId: foreignAccountId,
        label: 'Tuđa adresa',
        contactName: 'Drugi korisnik',
        phone: '+385 91 000 0000',
        street1: 'Tuđa 12',
        city: 'Zagreb',
        postalCode: '10000',
        countryCode: 'HR',
    });

    await assert.rejects(
        createDeliveryRequest({
            operationId: operation.id,
            slotId: pickupSlotId,
            mode: 'pickup',
            locationId,
            accountId: foreignAccountId,
        }),
        /Operation not found or access denied/,
    );
    await assert.rejects(
        createDeliveryRequest({
            operationId: operation.id,
            slotId: deliverySlotId,
            mode: 'delivery',
            addressId: foreignAddressId,
            accountId: ownerAccountId,
        }),
        /Delivery address not found or access denied/,
    );

    const insertedRequests = await storage().query.deliveryRequests.findMany({
        where: eq(deliveryRequests.operationId, operation.id),
    });
    assert.deepEqual(insertedRequests, []);
});

test('legacy request reconstruction uses the operation owner and hides foreign addresses', async () => {
    createTestDb();

    const ownerAccountId = await createTestAccount();
    const foreignAccountId = await createTestAccount();
    const locationId = await createPickupLocation({
        name: `Legacy ownership location ${randomUUID()}`,
        street1: 'Testna 1',
        city: 'Zagreb',
        postalCode: '10000',
        countryCode: 'HR',
    });
    const slotStartAt = new Date('2099-02-02T08:00:00.000Z');
    const slotId = await createTimeSlot({
        locationId,
        type: 'delivery',
        startAt: slotStartAt,
        endAt: new Date(slotStartAt.getTime() + 2 * 60 * 60 * 1000),
        status: TimeSlotStatuses.SCHEDULED,
    });
    const [operation] = await storage()
        .insert(operations)
        .values({
            entityId: 1,
            entityTypeName: 'operation',
            accountId: ownerAccountId,
        })
        .returning({ id: operations.id });
    assert.ok(operation);
    const foreignAddressId = await createDeliveryAddress({
        accountId: foreignAccountId,
        label: 'Privatna adresa',
        contactName: 'Drugi korisnik',
        phone: '+385 91 111 1111',
        street1: 'Privatna 9',
        city: 'Zagreb',
        postalCode: '10000',
        countryCode: 'HR',
    });
    const requestId = randomUUID();
    await storage().insert(deliveryRequests).values({
        id: requestId,
        operationId: operation.id,
    });
    await createEvent(
        knownEvents.delivery.requestCreatedV1(requestId, {
            operationId: operation.id,
            slotId,
            mode: 'delivery',
            addressId: foreignAddressId,
            accountId: foreignAccountId,
        }),
    );

    const request = await getDeliveryRequest(requestId);
    const ownerRequests = await getDeliveryRequestsWithEvents(ownerAccountId);
    const foreignRequests =
        await getDeliveryRequestsWithEvents(foreignAccountId);

    assert.equal(request?.accountId, ownerAccountId);
    assert.equal(request?.address, undefined);
    assert.equal(
        ownerRequests.find((item) => item.id === requestId)?.accountId,
        ownerAccountId,
    );
    assert.equal(
        ownerRequests.find((item) => item.id === requestId)?.address,
        undefined,
    );
    assert.equal(
        foreignRequests.some((item) => item.id === requestId),
        false,
    );
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

test('uncancelDeliveryRequest restores cancelled requests to confirmed', async () => {
    const fixture = await createDeliveryRequestWithTraceFixture();

    await cancelDeliveryRequest(fixture.requestId, 'admin', 'Pogrešan termin');

    const cancelledRequests = await getDeliveryRequestsWithEvents(
        fixture.accountId,
    );
    const cancelledRequest = cancelledRequests.find(
        (request) => request.id === fixture.requestId,
    );

    assert.equal(cancelledRequest?.state, DeliveryRequestStates.CANCELLED);
    assert.equal(cancelledRequest?.cancelReason, 'Pogrešan termin');

    await uncancelDeliveryRequest(fixture.requestId);

    const restoredRequests = await getDeliveryRequestsWithEvents(
        fixture.accountId,
    );
    const restoredRequest = restoredRequests.find(
        (request) => request.id === fixture.requestId,
    );

    assert.equal(restoredRequest?.state, DeliveryRequestStates.CONFIRMED);
    assert.equal(restoredRequest?.cancelReason, undefined);
});

test('account cancellation cannot mutate another account request', async () => {
    const fixture = await createDeliveryRequestWithTraceFixture();
    const foreignAccountId = await createTestAccount();
    const originalRequest = await getDeliveryRequest(fixture.requestId);
    assert.ok(originalRequest);

    await assert.rejects(
        cancelDeliveryRequestForAccount({
            requestId: fixture.requestId,
            accountId: foreignAccountId,
            cancelReason: 'Nije moj zahtjev',
        }),
        /Delivery request not found/,
    );

    const unchangedRequest = await getDeliveryRequest(fixture.requestId);
    assert.equal(unchangedRequest?.state, originalRequest.state);

    await cancelDeliveryRequestForAccount({
        requestId: fixture.requestId,
        accountId: fixture.accountId,
        cancelReason: 'Promjena plana',
    });

    const cancelledRequest = await getDeliveryRequest(fixture.requestId);
    assert.equal(cancelledRequest?.state, DeliveryRequestStates.CANCELLED);
    assert.equal(cancelledRequest?.cancelReason, 'Promjena plana');
});

test('delivery exception events project safe retry outcomes and invalidate dispatch', async () => {
    const fixture = await createDeliveryRequestWithTraceFixture();
    const recordedByUserId = `private-driver-${randomUUID()}`;
    const privateNote = `private-note-${randomUUID()}`;
    const dispatchRevisionBefore = await getDeliveryDispatchRevision();
    let latestExceptionEventId = dispatchRevisionBefore;

    for (const [index, exception] of [
        {
            outcome: 'deferred' as const,
            reason: 'address-inaccessible' as const,
            retryable: true,
        },
        {
            outcome: 'failed' as const,
            reason: 'harvest-missing' as const,
            retryable: false,
        },
        {
            outcome: 'cancelled' as const,
            reason: 'cancellation' as const,
            retryable: false,
        },
    ].entries()) {
        if (index > 0) {
            await createEvent(
                knownEvents.delivery.requestConfirmedV1(fixture.requestId, {
                    status: DeliveryRequestStates.CONFIRMED,
                }),
            );
            const resetRequest = await getDeliveryRequest(fixture.requestId);
            assert.equal(resetRequest?.state, DeliveryRequestStates.CONFIRMED);
            assert.equal(resetRequest?.deliveryException, undefined);
        }

        const exceptionEvent = await createEvent(
            knownEvents.delivery.requestExceptionRecordedV1(fixture.requestId, {
                runId: `private-run-${randomUUID()}`,
                stopId: index + 1,
                clientOperationId: `exception-projection-${randomUUID()}`,
                ...exception,
                note: privateNote,
                occurredAt: new Date(
                    Date.UTC(2026, 6, 15, 8, index),
                ).toISOString(),
                recordedByUserId,
                routeRevision: index + 1,
            }),
        );
        latestExceptionEventId = exceptionEvent.id;

        const request = await getDeliveryRequest(fixture.requestId);
        const listedRequest = (
            await getDeliveryRequestsWithEvents(fixture.accountId)
        ).find((candidate) => candidate.id === fixture.requestId);
        const expectedException = {
            outcome: exception.outcome,
            retryable: exception.retryable,
        };

        assert.equal(request?.state, exception.outcome);
        assert.equal(request?.routeRevision, exceptionEvent.id);
        assert.deepEqual(request?.deliveryException, expectedException);
        assert.deepEqual(listedRequest?.deliveryException, expectedException);
        assert.deepEqual(Object.keys(request?.deliveryException ?? {}).sort(), [
            'outcome',
            'retryable',
        ]);
        const publicProjection = JSON.stringify([request, listedRequest]);
        assert.ok(!publicProjection.includes(exception.reason));
        assert.ok(!publicProjection.includes(privateNote));
        assert.ok(!publicProjection.includes(recordedByUserId));
    }

    const dispatchRevisionAfter = await getDeliveryDispatchRevision();
    assert.equal(dispatchRevisionAfter, latestExceptionEventId);
    assert.ok(latestExceptionEventId > dispatchRevisionBefore);
});

test('fulfilled and cancelled requests absorb late exceptions until an explicit reset event', async () => {
    const fulfilledFixture = await createDeliveryRequestWithTraceFixture();
    await createEvent(
        knownEvents.delivery.requestFulfilledV1(fulfilledFixture.requestId, {
            status: DeliveryRequestStates.FULFILLED,
        }),
    );
    await createEvent(
        knownEvents.delivery.requestExceptionRecordedV1(
            fulfilledFixture.requestId,
            {
                runId: `late-run-${randomUUID()}`,
                stopId: 1,
                clientOperationId: `late-fulfilled-${randomUUID()}`,
                outcome: 'failed',
                reason: 'harvest-damaged',
                retryable: false,
                occurredAt: new Date('2026-07-15T09:00:00.000Z').toISOString(),
                recordedByUserId: `driver-${randomUUID()}`,
                routeRevision: 1,
            },
        ),
    );

    const fulfilled = await getDeliveryRequest(fulfilledFixture.requestId);
    assert.equal(fulfilled?.state, DeliveryRequestStates.FULFILLED);
    assert.equal(fulfilled?.deliveryException, undefined);

    const cancelledFixture = await createDeliveryRequestWithTraceFixture();
    await cancelDeliveryRequest(
        cancelledFixture.requestId,
        'admin',
        'Otkazano prije kasnog događaja',
    );
    await createEvent(
        knownEvents.delivery.requestExceptionRecordedV1(
            cancelledFixture.requestId,
            {
                runId: `late-run-${randomUUID()}`,
                stopId: 2,
                clientOperationId: `late-cancelled-${randomUUID()}`,
                outcome: 'deferred',
                reason: 'customer-unavailable',
                retryable: true,
                occurredAt: new Date('2026-07-15T09:01:00.000Z').toISOString(),
                recordedByUserId: `driver-${randomUUID()}`,
                routeRevision: 1,
            },
        ),
    );

    const cancelled = await getDeliveryRequest(cancelledFixture.requestId);
    assert.equal(cancelled?.state, DeliveryRequestStates.CANCELLED);
    assert.equal(cancelled?.deliveryException, undefined);

    await createEvent(
        knownEvents.delivery.requestConfirmedV1(cancelledFixture.requestId, {
            status: DeliveryRequestStates.CONFIRMED,
        }),
    );
    const reset = await getDeliveryRequest(cancelledFixture.requestId);
    assert.equal(reset?.state, DeliveryRequestStates.CONFIRMED);
    assert.equal(reset?.deliveryException, undefined);
});
