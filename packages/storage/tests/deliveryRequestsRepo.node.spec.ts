import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    DeliveryRequestStates,
    events,
    getPendingDeliveryReadyEmailRequestIds,
    knownEventTypes,
    storage,
} from '@gredice/storage';
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
