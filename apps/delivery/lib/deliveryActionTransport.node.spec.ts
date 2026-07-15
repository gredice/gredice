import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createDeliveryArriveCommand,
    createDeliveryExceptionCommand,
} from './deliveryActionQueue';
import {
    deliveryActionAcknowledgement,
    deliveryActionHttpFailure,
} from './deliveryActionTransport';

const arrive = createDeliveryArriveCommand({
    operationId: 'arrival-1',
    runId: 'run-1',
    stopId: 22,
    expectedRouteRevision: 3,
    occurredAt: '2026-07-15T12:00:00.000Z',
});

test('accepts only the exact route-operation receipt contract', () => {
    assert.deepEqual(
        deliveryActionAcknowledgement(
            {
                clientOperationId: 'arrival-1',
                replayed: true,
                result: {
                    kind: 'arrive',
                    targetStopId: 22,
                    affectedStopIds: [22, 23],
                    routeRevision: 4,
                    reroutePending: false,
                    runCompleted: false,
                },
            },
            arrive,
        ),
        {
            status: 'exact-duplicate',
            routeRevision: 4,
            reroutePending: false,
            runCompleted: false,
        },
    );
    assert.deepEqual(
        deliveryActionAcknowledgement(
            {
                clientOperationId: 'another-operation',
                replayed: false,
                result: {
                    kind: 'arrive',
                    targetStopId: 22,
                    affectedStopIds: [22],
                    routeRevision: 4,
                    reroutePending: false,
                    runCompleted: false,
                },
            },
            arrive,
        ),
        {
            status: 'retryable-failure',
            code: 'invalid-acknowledgement',
        },
    );
});

test('validates the existing idempotent exception acknowledgement', () => {
    const command = createDeliveryExceptionCommand({
        operationId: 'exception-1',
        runId: 'run-1',
        stopId: 22,
        expectedRouteRevision: 3,
        occurredAt: '2026-07-15T12:00:00.000Z',
        exceptions: [
            {
                stopId: 22,
                outcome: 'deferred',
                reason: 'customer-unavailable',
            },
        ],
    });
    assert.deepEqual(
        deliveryActionAcknowledgement(
            {
                clientOperationId: 'exception-1',
                replayed: false,
                outcomes: [
                    {
                        stopId: 22,
                        outcome: 'deferred',
                        reason: 'customer-unavailable',
                    },
                ],
                routeRevision: 4,
                reroutePending: false,
                runCompleted: false,
            },
            command,
        ),
        {
            status: 'applied',
            routeRevision: 4,
            reroutePending: false,
            runCompleted: false,
        },
    );
    assert.deepEqual(
        deliveryActionAcknowledgement(
            {
                clientOperationId: 'exception-1',
                replayed: false,
                outcomes: [
                    {
                        stopId: 999,
                        outcome: 'failed',
                        reason: 'address-wrong',
                    },
                ],
                routeRevision: 4,
                reroutePending: false,
                runCompleted: false,
            },
            command,
        ),
        {
            status: 'retryable-failure',
            code: 'invalid-acknowledgement',
        },
    );
});

test('classifies transport failures without turning infrastructure errors into conflicts', () => {
    assert.deepEqual(
        deliveryActionHttpFailure(503, { code: 'database-down' }),
        {
            status: 'retryable-failure',
            code: 'database-down',
        },
    );
    assert.deepEqual(
        deliveryActionHttpFailure(409, { code: 'route-revision-conflict' }),
        {
            status: 'permanent-failure',
            code: 'route-revision-conflict',
        },
    );
});
