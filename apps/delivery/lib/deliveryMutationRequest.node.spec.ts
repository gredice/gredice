import assert from 'node:assert/strict';
import test from 'node:test';
import { DeliveryRunStopOperationKinds } from '@gredice/storage';
import {
    DeliveryMutationRequestError,
    expectedRouteRevision,
    parseDeliveryExceptionMutation,
    parseDeliveryStopMutation,
} from './deliveryMutationRequest';

test('requires a nonnegative integer route revision on delivery mutations', () => {
    assert.equal(expectedRouteRevision({ expectedRouteRevision: 4 }), 4);
    for (const value of [
        {},
        { expectedRouteRevision: -1 },
        { expectedRouteRevision: 1.5 },
        { expectedRouteRevision: '4' },
    ]) {
        assert.throws(
            () => expectedRouteRevision(value),
            DeliveryMutationRequestError,
        );
    }
});

test('parses a deterministic bulk delivery exception mutation', () => {
    const parsed = parseDeliveryExceptionMutation({
        expectedRouteRevision: 7,
        clientOperationId: ' operation-1 ',
        occurredAt: '2026-07-15T10:00:00.000Z',
        exceptions: [
            {
                stopId: 11,
                outcome: 'deferred',
                reason: 'customer-unavailable',
                note: '  Nazvati ponovno  ',
            },
            {
                stopId: 12,
                outcome: 'failed',
                reason: 'harvest-damaged',
            },
        ],
    });
    assert.equal(parsed.expectedRouteRevision, 7);
    assert.equal(parsed.clientOperationId, 'operation-1');
    assert.equal(parsed.occurredAt.toISOString(), '2026-07-15T10:00:00.000Z');
    assert.deepEqual(parsed.exceptions, [
        {
            stopId: 11,
            outcome: 'deferred',
            reason: 'customer-unavailable',
            note: 'Nazvati ponovno',
        },
        {
            stopId: 12,
            outcome: 'failed',
            reason: 'harvest-damaged',
        },
    ]);
});

test('parses strict arrive and deliver stop operation payloads', () => {
    const arrived = parseDeliveryStopMutation(
        {
            expectedRouteRevision: 8,
            clientOperationId: ' arrive-1 ',
            occurredAt: '2026-07-15T10:00:00.000Z',
        },
        DeliveryRunStopOperationKinds.ARRIVE,
    );
    assert.deepEqual(arrived, {
        kind: DeliveryRunStopOperationKinds.ARRIVE,
        expectedRouteRevision: 8,
        clientOperationId: 'arrive-1',
        occurredAt: new Date('2026-07-15T10:00:00.000Z'),
    });

    const delivered = parseDeliveryStopMutation(
        {
            expectedRouteRevision: 9,
            clientOperationId: ' deliver-1 ',
            occurredAt: '2026-07-15T10:05:00.000Z',
            notes: '  Predano susjedu  ',
        },
        DeliveryRunStopOperationKinds.DELIVER,
    );
    assert.deepEqual(delivered, {
        kind: DeliveryRunStopOperationKinds.DELIVER,
        expectedRouteRevision: 9,
        clientOperationId: 'deliver-1',
        occurredAt: new Date('2026-07-15T10:05:00.000Z'),
        notes: 'Predano susjedu',
    });
});

test('rejects incomplete or unsupported stop operation payloads', () => {
    const valid = {
        expectedRouteRevision: 8,
        clientOperationId: 'operation-1',
        occurredAt: '2026-07-15T10:00:00.000Z',
    };
    for (const value of [
        null,
        { ...valid, expectedRouteRevision: undefined },
        { ...valid, clientOperationId: '' },
        { ...valid, clientOperationId: 'x'.repeat(129) },
        { ...valid, occurredAt: 'not-a-date' },
        { ...valid, extra: true },
        { ...valid, notes: 'not allowed' },
    ]) {
        assert.throws(
            () =>
                parseDeliveryStopMutation(
                    value,
                    DeliveryRunStopOperationKinds.ARRIVE,
                ),
            DeliveryMutationRequestError,
        );
    }

    for (const value of [
        { ...valid, notes: 42 },
        { ...valid, notes: 'x'.repeat(1_001) },
        { ...valid, unexpected: 'field' },
    ]) {
        assert.throws(
            () =>
                parseDeliveryStopMutation(
                    value,
                    DeliveryRunStopOperationKinds.DELIVER,
                ),
            DeliveryMutationRequestError,
        );
    }
});
