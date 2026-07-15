import assert from 'node:assert/strict';
import test from 'node:test';
import {
    DeliveryMutationRequestError,
    expectedRouteRevision,
    parseDeliveryExceptionMutation,
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
