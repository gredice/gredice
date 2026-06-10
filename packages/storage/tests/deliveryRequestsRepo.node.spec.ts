import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    acceptOperation,
    createDeliveryRequest,
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
    knownEvents,
    knownEventTypes,
    raisedBedFields,
    raisedBeds,
    storage,
    TimeSlotStatuses,
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

async function createDeliveryRequestWithTraceFixture() {
    createTestDb();

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
        entityId: 1,
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
                    plantSortId: '1',
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
        plantSortId: null,
        harvestOperationId: operationId,
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
    await createDeliveryRequest({
        operationId,
        slotId,
        mode: 'pickup',
        locationId,
        accountId,
    });

    return { accountId, operationId, traceLink };
}

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

test('getDeliveryRequestsWithEvents includes harvest trace links for plant rows', async () => {
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
});
