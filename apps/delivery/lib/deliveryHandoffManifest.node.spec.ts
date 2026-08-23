import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createDeliveryVerificationMarkCommand,
    createDeliveryVerificationScanCommand,
    createMemoryDeliveryActionQueuePersistence,
    DeliveryActionQueue,
} from './deliveryActionQueue';
import {
    type DeliveryHandoffManifest,
    fetchDeliveryHandoffManifest,
    parseDeliveryHandoffManifest,
    projectDeliveryHandoffManifest,
} from './deliveryHandoffManifest';

const now = () => new Date('2026-07-16T08:00:00.000Z');

function manifest(): DeliveryHandoffManifest {
    return {
        runId: 'run-1',
        targetStopId: 101,
        version: 1,
        retryAttempt: 2,
        items: [
            {
                stopId: 101,
                deliveryRequestId: 'request-101',
                retryAttempt: 2,
                traceLinkId: 501,
                qrAvailable: true,
                state: 'unverified',
                reason: null,
                verifiedAt: null,
            },
            {
                stopId: 102,
                deliveryRequestId: 'request-102',
                retryAttempt: 2,
                traceLinkId: null,
                qrAvailable: false,
                state: 'no-label',
                reason: null,
                verifiedAt: null,
            },
        ],
        expectedCount: 2,
        scannedCount: 0,
        unverifiedCount: 1,
        noLabelCount: 1,
        missingCount: 0,
        skippedCount: 0,
    };
}

test('runtime parser accepts only a self-consistent v1 handoff manifest', () => {
    const value = manifest();
    assert.deepEqual(parseDeliveryHandoffManifest(value), value);
    for (const invalid of [
        { ...value, expectedCount: 3 },
        { ...value, targetStopId: 999 },
        { ...value, extra: true },
        {
            ...value,
            items: [{ ...value.items[0], retryAttempt: 1 }, value.items[1]],
        },
        {
            ...value,
            items: [
                { ...value.items[0], state: 'skipped', reason: null },
                value.items[1],
            ],
            unverifiedCount: 0,
            skippedCount: 1,
        },
    ]) {
        assert.equal(parseDeliveryHandoffManifest(invalid), null);
    }
});

test('manifest GET parsing classifies malformed success and HTTP failures safely', async () => {
    let requestedUrl = '';
    const loaded = await fetchDeliveryHandoffManifest({
        runId: 'run/with space',
        targetStopId: 101,
        fetcher: async (input) => {
            requestedUrl = String(input);
            return Response.json({ ...manifest(), runId: 'run/with space' });
        },
    });
    assert.equal(
        requestedUrl,
        '/api/driver/runs/run%2Fwith%20space/stops/101/handoff/mutations',
    );
    assert.equal(loaded.status, 'loaded');

    assert.deepEqual(
        await fetchDeliveryHandoffManifest({
            runId: 'run-1',
            targetStopId: 101,
            fetcher: async () => Response.json({ ...manifest(), extra: true }),
        }),
        { status: 'retryable-failure', code: 'invalid-manifest' },
    );
    assert.deepEqual(
        await fetchDeliveryHandoffManifest({
            runId: 'run-requested',
            targetStopId: 101,
            fetcher: async () => Response.json(manifest()),
        }),
        {
            status: 'retryable-failure',
            code: 'manifest-identity-mismatch',
        },
    );
    assert.deepEqual(
        await fetchDeliveryHandoffManifest({
            runId: 'run-1',
            targetStopId: 101,
            fetcher: async () =>
                Response.json(
                    { code: 'route-revision-conflict' },
                    { status: 409 },
                ),
        }),
        {
            status: 'permanent-failure',
            code: 'route-revision-conflict',
        },
    );
});

test('optimistic projection overlays queued item evidence by stable stop identity', async () => {
    const actionQueue = new DeliveryActionQueue({
        scope: { userId: 'driver-1', runId: 'run-1' },
        persistence: createMemoryDeliveryActionQueuePersistence(),
        transport: async (command) =>
            command.kind === 'verification-scan'
                ? {
                      status: 'handoff-acknowledged',
                      replayed: false,
                      retryAttempt: 2,
                      result: {
                          kind: 'scan',
                          outcome: 'invalid',
                          affectedStopIds: [],
                      },
                  }
                : {
                      status: 'handoff-acknowledged',
                      replayed: false,
                      retryAttempt: 2,
                      result: {
                          kind: 'mark-item',
                          outcome: 'applied',
                          affectedStopIds: [102],
                          itemState: 'missing',
                      },
                  },
        now,
    });
    await actionQueue.enqueue(
        createDeliveryVerificationScanCommand({
            operationId: 'projection-scan-0001',
            runId: 'run-1',
            stopId: 101,
            expectedRetryAttempt: 2,
            tracePath: '/trag/projection-trace-0001',
            now,
        }),
    );
    await actionQueue.enqueue(
        createDeliveryVerificationMarkCommand({
            operationId: 'projection-mark-0001',
            runId: 'run-1',
            stopId: 101,
            expectedRetryAttempt: 2,
            itemStopId: 102,
            outcome: 'missing',
            now,
        }),
    );
    const queued = projectDeliveryHandoffManifest({
        manifest: manifest(),
        snapshot: actionQueue.getSnapshot(),
        traceItems: [
            {
                stopId: 101,
                tracePath: '/trag/projection-trace-0001',
            },
        ],
    });
    assert.deepEqual(
        queued.manifest.items.map((item) => [item.stopId, item.state]),
        [
            [101, 'scanned'],
            [102, 'missing'],
        ],
    );
    assert.deepEqual(queued.pendingOperationIds, [
        'projection-scan-0001',
        'projection-mark-0001',
    ]);
    assert.equal(queued.manifest.scannedCount, 1);
    assert.equal(queued.manifest.missingCount, 1);

    await actionQueue.replay();
    const acknowledged = projectDeliveryHandoffManifest({
        manifest: manifest(),
        snapshot: actionQueue.getSnapshot(),
        traceItems: [
            {
                stopId: 101,
                tracePath: '/trag/projection-trace-0001',
            },
        ],
    });
    assert.deepEqual(
        acknowledged.manifest.items.map((item) => [item.stopId, item.state]),
        [
            [101, 'unverified'],
            [102, 'missing'],
        ],
    );
    assert.deepEqual(acknowledged.acknowledgedOutcomes, [
        { operationId: 'projection-scan-0001', outcome: 'invalid' },
        { operationId: 'projection-mark-0001', outcome: 'applied' },
    ]);
});

test('optimistic projection mirrors server last-occurrence-wins timestamp guards', async () => {
    const actionQueue = new DeliveryActionQueue({
        scope: { userId: 'driver-1', runId: 'run-1' },
        persistence: createMemoryDeliveryActionQueuePersistence(),
        transport: async () => ({
            status: 'retryable-failure',
            code: 'offline',
        }),
        now,
    });
    await actionQueue.enqueue(
        createDeliveryVerificationMarkCommand({
            operationId: 'stale-projection-mark-0001',
            runId: 'run-1',
            stopId: 101,
            expectedRetryAttempt: 2,
            itemStopId: 101,
            outcome: 'missing',
            occurredAt: '2026-07-16T08:00:00.010Z',
        }),
    );
    const base = manifest();
    const newerManifest: DeliveryHandoffManifest = {
        ...base,
        items: base.items.map((item) =>
            item.stopId === 101
                ? {
                      ...item,
                      state: 'scanned',
                      verifiedAt: '2026-07-16T08:00:00.010Z',
                  }
                : item,
        ),
        scannedCount: 1,
        unverifiedCount: 0,
    };

    const projected = projectDeliveryHandoffManifest({
        manifest: newerManifest,
        snapshot: actionQueue.getSnapshot(),
    });

    assert.equal(projected.manifest.items[0]?.state, 'scanned');
    assert.equal(
        projected.manifest.items[0]?.verifiedAt,
        '2026-07-16T08:00:00.010Z',
    );
    assert.deepEqual(projected.pendingOperationIds, [
        'stale-projection-mark-0001',
    ]);
});
