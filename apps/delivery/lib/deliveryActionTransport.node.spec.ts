import assert from 'node:assert/strict';
import test from 'node:test';
import { DeliveryRunCompletionOverrideReasons } from '@gredice/storage';
import {
    createDeliveryArriveCommand,
    createDeliveryCompleteCommand,
    createDeliveryExceptionCommand,
    createDeliveryVerificationMarkCommand,
    createDeliveryVerificationScanCommand,
} from './deliveryActionQueue';
import {
    deliveryActionAcknowledgement,
    deliveryActionHttpFailure,
    deliveryHandoffAcknowledgement,
    sendDeliveryAction,
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

test('round-trips and strictly validates completion override receipts', () => {
    const command = createDeliveryCompleteCommand({
        operationId: 'delivery-override-1',
        runId: 'run-1',
        stopId: 22,
        expectedRouteRevision: 3,
        occurredAt: '2026-07-15T12:00:00.000Z',
        completionOverride: {
            reason: DeliveryRunCompletionOverrideReasons.DEVICE_UNAVAILABLE,
        },
    });
    const acknowledgement = {
        clientOperationId: command.operationId,
        replayed: false,
        result: {
            kind: 'deliver',
            targetStopId: 22,
            affectedStopIds: [22, 23],
            routeRevision: 4,
            reroutePending: false,
            runCompleted: false,
            override: {
                reason: DeliveryRunCompletionOverrideReasons.DEVICE_UNAVAILABLE,
                bypassed: ['arrival', 'handoff-review'],
            },
        },
    };

    assert.deepEqual(deliveryActionAcknowledgement(acknowledgement, command), {
        status: 'applied',
        routeRevision: 4,
        reroutePending: false,
        runCompleted: false,
        override: {
            reason: DeliveryRunCompletionOverrideReasons.DEVICE_UNAVAILABLE,
            bypassed: ['arrival', 'handoff-review'],
        },
    });

    for (const override of [
        undefined,
        {
            reason: DeliveryRunCompletionOverrideReasons.MANUAL_HANDOFF,
            bypassed: ['arrival'],
        },
        {
            reason: DeliveryRunCompletionOverrideReasons.DEVICE_UNAVAILABLE,
            bypassed: ['arrival', 'arrival'],
        },
        {
            reason: DeliveryRunCompletionOverrideReasons.DEVICE_UNAVAILABLE,
            bypassed: ['arrival', 'handoff-review', 'future-bypass'],
        },
    ]) {
        assert.deepEqual(
            deliveryActionAcknowledgement(
                {
                    ...acknowledgement,
                    result: { ...acknowledgement.result, override },
                },
                command,
            ),
            {
                status: 'retryable-failure',
                code: 'invalid-acknowledgement',
            },
        );
    }

    assert.deepEqual(
        deliveryActionAcknowledgement(
            acknowledgement,
            createDeliveryCompleteCommand({
                operationId: 'delivery-override-1',
                runId: 'run-1',
                stopId: 22,
                expectedRouteRevision: 3,
                occurredAt: '2026-07-15T12:00:00.000Z',
            }),
        ),
        {
            status: 'retryable-failure',
            code: 'invalid-acknowledgement',
        },
    );
});

test('posts a completion override as a strict nested delivery payload', async () => {
    const originalFetch = globalThis.fetch;
    let body: unknown;
    globalThis.fetch = async (_input, init) => {
        body = JSON.parse(String(init?.body));
        return Response.json({
            clientOperationId: 'delivery-override-post',
            replayed: false,
            result: {
                kind: 'deliver',
                targetStopId: 22,
                affectedStopIds: [22],
                routeRevision: 4,
                reroutePending: false,
                runCompleted: false,
                override: {
                    reason: DeliveryRunCompletionOverrideReasons.WORKFLOW_RECOVERY,
                    bypassed: ['handoff-review'],
                },
            },
        });
    };
    try {
        const result = await sendDeliveryAction(
            createDeliveryCompleteCommand({
                operationId: 'delivery-override-post',
                runId: 'run-1',
                stopId: 22,
                expectedRouteRevision: 3,
                occurredAt: '2026-07-15T12:00:00.000Z',
                notes: 'Predano ručno',
                completionOverride: {
                    reason: DeliveryRunCompletionOverrideReasons.WORKFLOW_RECOVERY,
                },
            }),
        );

        assert.deepEqual(body, {
            clientOperationId: 'delivery-override-post',
            occurredAt: '2026-07-15T12:00:00.000Z',
            expectedRouteRevision: 3,
            notes: 'Predano ručno',
            completionOverride: {
                reason: DeliveryRunCompletionOverrideReasons.WORKFLOW_RECOVERY,
            },
        });
        assert.deepEqual(result, {
            status: 'applied',
            routeRevision: 4,
            reroutePending: false,
            runCompleted: false,
            override: {
                reason: DeliveryRunCompletionOverrideReasons.WORKFLOW_RECOVERY,
                bypassed: ['handoff-review'],
            },
        });
    } finally {
        globalThis.fetch = originalFetch;
    }
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

test('strictly accepts persisted scan outcomes and bulk affected stop IDs', () => {
    const scan = createDeliveryVerificationScanCommand({
        operationId: 'verification-scan-0001',
        runId: 'run-1',
        stopId: 22,
        expectedRetryAttempt: 2,
        tracePath: 'https://dostava.gredice.com/trag/plant-trace-token-0001',
        occurredAt: '2026-07-15T12:00:00.000Z',
    });
    assert.deepEqual(
        deliveryHandoffAcknowledgement(
            {
                results: [
                    {
                        clientOperationId: 'verification-scan-0001',
                        retryAttempt: 2,
                        replayed: false,
                        result: {
                            kind: 'scan',
                            outcome: 'applied',
                            affectedStopIds: [22, 23],
                            itemState: 'scanned',
                        },
                    },
                ],
            },
            scan,
        ),
        {
            status: 'handoff-acknowledged',
            replayed: false,
            retryAttempt: 2,
            result: {
                kind: 'scan',
                outcome: 'applied',
                affectedStopIds: [22, 23],
                itemState: 'scanned',
            },
        },
    );
    assert.deepEqual(
        deliveryHandoffAcknowledgement(
            {
                results: [
                    {
                        clientOperationId: 'verification-scan-0001',
                        retryAttempt: 2,
                        replayed: true,
                        result: {
                            kind: 'scan',
                            outcome: 'wrong-stop',
                            affectedStopIds: [],
                        },
                    },
                ],
            },
            scan,
        ),
        {
            status: 'handoff-acknowledged',
            replayed: true,
            retryAttempt: 2,
            result: {
                kind: 'scan',
                outcome: 'wrong-stop',
                affectedStopIds: [],
            },
        },
    );
});

test('strictly parses mark receipts and rejects mismatched or extended success payloads', () => {
    const mark = createDeliveryVerificationMarkCommand({
        operationId: 'verification-mark-0001',
        runId: 'run-1',
        stopId: 22,
        expectedRetryAttempt: 1,
        itemStopId: 23,
        outcome: 'skipped',
        reason: 'label-unreadable',
        occurredAt: '2026-07-15T12:00:00.000Z',
    });
    const receipt = {
        results: [
            {
                clientOperationId: 'verification-mark-0001',
                retryAttempt: 1,
                replayed: false,
                result: {
                    kind: 'mark-item',
                    outcome: 'already-applied',
                    affectedStopIds: [23],
                    itemState: 'skipped',
                    reason: 'label-unreadable',
                },
            },
        ],
    };
    assert.deepEqual(deliveryHandoffAcknowledgement(receipt, mark), {
        status: 'handoff-acknowledged',
        replayed: false,
        retryAttempt: 1,
        result: {
            kind: 'mark-item',
            outcome: 'already-applied',
            affectedStopIds: [23],
            itemState: 'skipped',
            reason: 'label-unreadable',
        },
    });
    for (const invalid of [
        { ...receipt, extra: true },
        {
            results: [
                {
                    ...receipt.results[0],
                    retryAttempt: 0,
                },
            ],
        },
        {
            results: [
                {
                    ...receipt.results[0],
                    result: {
                        ...receipt.results[0]?.result,
                        reason: 'manual-verification',
                    },
                },
            ],
        },
        {
            results: [
                {
                    ...receipt.results[0],
                    result: {
                        ...receipt.results[0]?.result,
                        affectedStopIds: [99],
                    },
                },
            ],
        },
        { results: [...receipt.results, ...receipt.results] },
    ]) {
        assert.deepEqual(deliveryHandoffAcknowledgement(invalid, mark), {
            status: 'retryable-failure',
            code: 'invalid-acknowledgement',
        });
    }
});
