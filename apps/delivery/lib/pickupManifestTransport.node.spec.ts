import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createPickupManifestConfirmCommand,
    createPickupManifestManualOutcomeCommand,
    createPickupManifestScanCommand,
    type PickupManifestCommand,
} from './pickupManifestQueue';
import {
    pickupManifestHttpFailure,
    pickupManifestTransportResult,
} from './pickupManifestTransport';

const occurredAt = '2026-07-15T08:00:00.000Z';
const traceToken = 'pickup-manifest-trace-token-2026';

function scanCommand() {
    return createPickupManifestScanCommand({
        operationId: 'operation-scan-1',
        runId: 'run-1',
        pickupNodeId: 'pickup-1',
        scanValue: traceToken,
        occurredAt,
    });
}

function responseFor(
    command: PickupManifestCommand,
    result: Record<string, unknown>,
    replayed = false,
) {
    return {
        results: [
            {
                clientOperationId: command.operationId,
                replayed,
                result,
            },
        ],
    };
}

test('validates complete applied and duplicate pickup acknowledgements', () => {
    const scan = scanCommand();
    const scanResult = {
        kind: 'scan',
        outcome: 'applied',
        affectedStopIds: [17],
        itemState: 'scanned',
    };
    assert.deepEqual(
        pickupManifestTransportResult(responseFor(scan, scanResult), scan),
        { status: 'applied' },
    );
    assert.deepEqual(
        pickupManifestTransportResult(
            responseFor(scan, scanResult, true),
            scan,
        ),
        { status: 'exact-duplicate' },
    );

    const manual = createPickupManifestManualOutcomeCommand({
        operationId: 'operation-item-1',
        runId: 'run-1',
        pickupNodeId: 'pickup-1',
        manifestId: 'manifest-1',
        stopId: 17,
        outcome: 'missing-label',
        occurredAt,
    });
    assert.deepEqual(
        pickupManifestTransportResult(
            responseFor(manual, {
                kind: 'mark-item',
                outcome: 'applied',
                affectedStopIds: [17],
                itemState: 'missing-label',
            }),
            manual,
        ),
        { status: 'applied' },
    );

    const confirm = createPickupManifestConfirmCommand({
        operationId: 'operation-confirm-1',
        runId: 'run-1',
        pickupNodeId: 'pickup-1',
        manifestId: 'manifest-1',
        occurredAt,
    });
    assert.deepEqual(
        pickupManifestTransportResult(
            responseFor(confirm, {
                kind: 'confirm-manifest',
                outcome: 'already-applied',
                affectedStopIds: [],
                manifestId: 'manifest-1',
                manifestState: 'confirmed',
            }),
            confirm,
        ),
        { status: 'applied' },
    );
});

test('keeps scan not-found and ambiguous outcomes recoverable instead of acknowledging them', () => {
    const command = scanCommand();
    assert.deepEqual(
        pickupManifestTransportResult(
            responseFor(command, {
                kind: 'scan',
                outcome: 'not-found',
                affectedStopIds: [],
            }),
            command,
        ),
        {
            status: 'permanent-failure',
            code: 'pickup-trace-not-found',
        },
    );
    assert.deepEqual(
        pickupManifestTransportResult(
            responseFor(
                command,
                {
                    kind: 'scan',
                    outcome: 'ambiguous',
                    affectedStopIds: [],
                },
                true,
            ),
            command,
        ),
        {
            status: 'permanent-failure',
            code: 'pickup-trace-ambiguous',
        },
    );
});

test('rejects partial success payloads and classifies HTTP failures', () => {
    const command = scanCommand();
    assert.deepEqual(
        pickupManifestTransportResult(
            {
                results: [
                    {
                        clientOperationId: command.operationId,
                        replayed: false,
                    },
                ],
            },
            command,
        ),
        {
            status: 'retryable-failure',
            code: 'invalid-server-response',
        },
    );
    assert.deepEqual(pickupManifestHttpFailure(503, null), {
        status: 'retryable-failure',
        code: 'pickup-manifest-sync-failed',
    });
    assert.deepEqual(
        pickupManifestHttpFailure(409, {
            code: 'pickup-operation-conflict',
        }),
        {
            status: 'permanent-failure',
            code: 'pickup-operation-conflict',
        },
    );
    assert.deepEqual(pickupManifestHttpFailure(400, null), {
        status: 'permanent-failure',
        code: 'pickup-manifest-request-rejected',
    });
});
