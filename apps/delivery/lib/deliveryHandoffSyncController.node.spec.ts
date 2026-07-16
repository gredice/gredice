import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createDeliveryVerificationMarkCommand,
    createDeliveryVerificationScanCommand,
    createMemoryDeliveryActionQueuePersistence,
    DeliveryActionQueue,
    type DeliveryActionQueueSnapshot,
    type DeliveryActionTransport,
    isDeliveryHandoffCommand,
} from './deliveryActionQueue';
import type { DeliveryStopDeliverySummary } from './deliveryDashboardTypes';
import type { DeliveryHandoffManifest } from './deliveryHandoffManifest';
import {
    createDeliveryHandoffManifestCacheRecord,
    type DeliveryHandoffManifestCachePersistence,
    type DeliveryHandoffManifestCacheRecord,
} from './deliveryHandoffManifestCache';
import {
    type DeliveryHandoffActionSyncAdapter,
    DeliveryHandoffSyncController,
    deliveryHandoffDeliveriesFingerprint,
} from './deliveryHandoffSyncController';

const userId = 'driver-controller-1';
const runId = 'run-controller-1';
const nowValue = new Date('2026-07-16T08:00:00.000Z');
const now = () => new Date(nowValue);

type ManifestItemState = DeliveryHandoffManifest['items'][number]['state'];

function delivery(
    stopId: number,
    tracePath = `/trag/controller-trace-token-${stopId}`,
): DeliveryStopDeliverySummary {
    return {
        stopId,
        stopState: 'arrived',
        requestId: `request-${stopId}`,
        requestState: 'in_delivery',
        contactName: `Kontakt ${stopId}`,
        phone: null,
        addressLabel: null,
        requestNotes: null,
        deliveryNotes: null,
        harvest: {
            plantName: `Biljka ${stopId}`,
            operationName: null,
            raisedBedName: null,
            fieldName: null,
            tracePath,
        },
        exception: null,
    };
}

function manifest({
    retryAttempt = 0,
    targetStopId = 101,
    itemStates = [
        { stopId: 101, state: 'unverified' },
        { stopId: 102, state: 'unverified' },
    ],
}: {
    retryAttempt?: number;
    targetStopId?: number;
    itemStates?: Array<{ stopId: number; state: ManifestItemState }>;
} = {}): DeliveryHandoffManifest {
    const items = itemStates.map(({ stopId, state }) => ({
        stopId,
        deliveryRequestId: `request-${stopId}`,
        retryAttempt,
        traceLinkId: 1_000 + stopId,
        qrAvailable: true,
        state,
        reason: state === 'skipped' ? ('manual-verification' as const) : null,
        verifiedAt: state === 'unverified' ? null : '2026-07-16T08:01:00.000Z',
    }));
    const count = (state: ManifestItemState) =>
        items.filter((item) => item.state === state).length;
    return {
        runId,
        targetStopId,
        version: 1,
        retryAttempt,
        items,
        expectedCount: items.length,
        scannedCount: count('scanned'),
        unverifiedCount: count('unverified'),
        noLabelCount: count('no-label'),
        missingCount: count('missing'),
        skippedCount: count('skipped'),
    };
}

function cacheKey(record: DeliveryHandoffManifestCacheRecord) {
    const { scope } = record;
    return `${scope.userId}:${scope.runId}:${scope.targetStopId}:${scope.expectedRetryAttempt}`;
}

function cacheHarness({
    manifests = [],
    events = [],
}: {
    manifests?: DeliveryHandoffManifest[];
    events?: string[];
} = {}) {
    const records = new Map<string, DeliveryHandoffManifestCacheRecord>();
    for (const value of manifests) {
        const record = createDeliveryHandoffManifestCacheRecord({
            userId,
            manifest: value,
            now: nowValue,
        });
        records.set(cacheKey(record), record);
    }
    const cache: DeliveryHandoffManifestCachePersistence = {
        durability: 'memory',
        async load(scope) {
            events.push(
                `load:${scope.targetStopId}:${scope.expectedRetryAttempt}`,
            );
            return (
                records.get(
                    `${scope.userId}:${scope.runId}:${scope.targetStopId}:${scope.expectedRetryAttempt}`,
                ) ?? null
            );
        },
        async save(record) {
            events.push(
                `save:${record.scope.targetStopId}:${record.scope.expectedRetryAttempt}`,
            );
            records.set(cacheKey(record), record);
        },
        async clear() {},
        async clearOtherRuns(scope) {
            events.push(`prune:${scope.activeRunId}`);
        },
    };
    return { cache, records };
}

function defaultTransport(): DeliveryActionTransport {
    return async (command) =>
        isDeliveryHandoffCommand(command)
            ? { status: 'retryable-failure', code: 'offline' }
            : {
                  status: 'applied',
                  routeRevision: command.expectedRouteRevision + 1,
                  reroutePending: false,
                  runCompleted: false,
              };
}

function actionHarness({
    events = [],
    transport = defaultTransport(),
    syncNow,
}: {
    events?: string[];
    transport?: DeliveryActionTransport;
    syncNow?: (
        queue: DeliveryActionQueue,
    ) => Promise<DeliveryActionQueueSnapshot>;
} = {}) {
    const queue = new DeliveryActionQueue({
        scope: { userId, runId },
        persistence: createMemoryDeliveryActionQueuePersistence(),
        transport,
        now,
    });
    let operationIndex = 0;
    const operationId = () => {
        operationIndex += 1;
        return `controller-operation-${operationIndex.toString().padStart(4, '0')}`;
    };
    const actions: DeliveryHandoffActionSyncAdapter = {
        getSnapshot: queue.getSnapshot,
        syncNow: async () =>
            syncNow ? await syncNow(queue) : await queue.replay(),
        enqueueVerificationScan: async (
            targetStopId,
            tracePath,
            expectedRetryAttempt,
        ) =>
            await queue.enqueue(
                createDeliveryVerificationScanCommand({
                    operationId: operationId(),
                    runId,
                    stopId: targetStopId,
                    expectedRetryAttempt,
                    tracePath,
                    now,
                }),
            ),
        enqueueVerificationMark: async (input) =>
            await queue.enqueue(
                createDeliveryVerificationMarkCommand({
                    operationId: operationId(),
                    runId,
                    stopId: input.stopId,
                    expectedRetryAttempt: input.expectedRetryAttempt,
                    itemStopId: input.itemStopId,
                    outcome: input.outcome,
                    reason: input.reason,
                    now,
                }),
            ),
        completeHandoffReconciliation: async (
            targetStopId,
            expectedRetryAttempt,
            operationIds,
        ) => {
            events.push(
                `reconcile:${targetStopId}:${expectedRetryAttempt}:${operationIds.join(',')}`,
            );
            return await queue.completeHandoffReconciliation({
                stopId: targetStopId,
                expectedRetryAttempt,
                operationIds,
            });
        },
    };
    return { actions, queue };
}

function deferred<Value>() {
    let resolve: (value: Value) => void = () => undefined;
    const promise = new Promise<Value>((resolvePromise) => {
        resolve = resolvePromise;
    });
    return { promise, resolve };
}

test('delivery fingerprints are order-independent but preserve handoff identity', () => {
    const first = [
        delivery(
            101,
            'https://www.gredice.com/trag/controller-trace-token-101',
        ),
        delivery(102),
    ];
    const equivalent = [
        delivery(102),
        delivery(101, '/trag/controller-trace-token-101'),
    ];
    const fingerprint = deliveryHandoffDeliveriesFingerprint(first);

    assert.equal(deliveryHandoffDeliveriesFingerprint(equivalent), fingerprint);
    assert.notEqual(
        deliveryHandoffDeliveriesFingerprint([
            { ...equivalent[0], requestId: 'different-request' },
            equivalent[1],
        ]),
        fingerprint,
    );
    assert.notEqual(
        deliveryHandoffDeliveriesFingerprint([delivery(103), equivalent[1]]),
        fingerprint,
    );
    assert.notEqual(
        deliveryHandoffDeliveriesFingerprint([
            equivalent[0],
            delivery(101, '/trag/different-controller-trace-token'),
        ]),
        fingerprint,
    );
});

test('emits a matching cached manifest before the authoritative refresh', async () => {
    const cached = manifest({
        itemStates: [
            { stopId: 101, state: 'no-label' },
            { stopId: 102, state: 'unverified' },
        ],
    });
    const authoritative = manifest({
        itemStates: [
            { stopId: 101, state: 'scanned' },
            { stopId: 102, state: 'unverified' },
        ],
    });
    const events: string[] = [];
    const { cache } = cacheHarness({ manifests: [cached], events });
    const { actions } = actionHarness({ events });
    const controller = new DeliveryHandoffSyncController({
        userId,
        runId,
        cache,
        actions,
        fetchManifest: async () => ({
            status: 'loaded',
            manifest: authoritative,
        }),
        isOnline: () => true,
        now,
    });
    const emittedStates: ManifestItemState[] = [];
    controller.subscribe(() => {
        const itemState = controller.getSnapshot().handoff?.items[0]?.state;
        if (itemState) emittedStates.push(itemState);
    });

    await controller.setContext({
        target: { targetStopId: 101, retryAttempt: 0 },
        deliveries: [delivery(101), delivery(102)],
        queueSnapshot: actions.getSnapshot(),
    });

    const cachedIndex = emittedStates.indexOf('no-label');
    const authoritativeIndex = emittedStates.indexOf('scanned');
    assert.notEqual(cachedIndex, -1);
    assert.ok(authoritativeIndex > cachedIndex);
    assert.equal(controller.getSnapshot().status, 'ready');
    assert.deepEqual(events.slice(0, 2), [`prune:${runId}`, 'load:101:0']);
});

test('projects offline scan and mark work immediately and deduplicates a repeated scan', async () => {
    const { cache } = cacheHarness();
    const { actions, queue } = actionHarness();
    const controller = new DeliveryHandoffSyncController({
        userId,
        runId,
        cache,
        actions,
        fetchManifest: async () => ({
            status: 'retryable-failure',
            code: 'offline',
        }),
        isOnline: () => false,
        now,
    });
    await controller.setContext({
        target: { targetStopId: 101, retryAttempt: 0 },
        deliveries: [delivery(101), delivery(102)],
        queueSnapshot: actions.getSnapshot(),
    });

    const first = await controller.scan(
        'https://www.gredice.com/trag/controller-trace-token-101',
    );
    const duplicate = await controller.scan('/trag/controller-trace-token-101');

    assert.equal(first.status, 'verified');
    assert.equal(duplicate.status, 'already-verified');
    assert.equal(queue.getSnapshot().entries.length, 1);
    assert.equal(controller.getSnapshot().handoff?.pendingCount, 1);
    assert.equal(controller.getSnapshot().handoff?.items[0]?.state, 'scanned');
    assert.equal(
        controller.getSnapshot().handoff?.items[0]?.syncState,
        'queued',
    );

    assert.deepEqual(
        await controller.markItem({
            itemStopId: 102,
            outcome: 'missing',
        }),
        { status: 'saved' },
    );
    assert.equal(controller.getSnapshot().status, 'offline');
    assert.equal(controller.getSnapshot().handoff?.pendingCount, 2);
    assert.equal(controller.getSnapshot().handoff?.items[1]?.state, 'missing');
    assert.equal(
        controller.getSnapshot().handoff?.items[1]?.syncState,
        'queued',
    );
});

test('persists the authoritative manifest before purging acknowledged raw handoff commands', async () => {
    const events: string[] = [];
    const transport: DeliveryActionTransport = async (command) => {
        if (command.kind !== 'verification-scan') {
            throw new Error('Expected a handoff scan');
        }
        return {
            status: 'handoff-acknowledged',
            replayed: false,
            retryAttempt: 0,
            result: {
                kind: 'scan',
                outcome: 'applied',
                affectedStopIds: [101],
                itemState: 'scanned',
            },
        };
    };
    const { actions, queue } = actionHarness({ events, transport });
    await queue.enqueue(
        createDeliveryVerificationScanCommand({
            operationId: 'seeded-controller-scan-0001',
            runId,
            stopId: 101,
            expectedRetryAttempt: 0,
            tracePath: '/trag/controller-trace-token-101',
            now,
        }),
    );
    const { cache } = cacheHarness({ events });
    const controller = new DeliveryHandoffSyncController({
        userId,
        runId,
        cache,
        actions,
        fetchManifest: async () => ({
            status: 'loaded',
            manifest: manifest({
                itemStates: [{ stopId: 101, state: 'scanned' }],
            }),
        }),
        isOnline: () => true,
        now,
    });

    await controller.setContext({
        target: { targetStopId: 101, retryAttempt: 0 },
        deliveries: [delivery(101)],
        queueSnapshot: actions.getSnapshot(),
    });

    assert.deepEqual(
        events.filter(
            (event) =>
                event.startsWith('save:') || event.startsWith('reconcile:'),
        ),
        ['save:101:0', 'reconcile:101:0:seeded-controller-scan-0001'],
    );
    assert.equal(queue.getSnapshot().entries.length, 0);
    assert.equal(controller.getSnapshot().handoff?.items[0]?.state, 'scanned');
});

test('keeps acknowledged raw evidence when browser cache durability is unavailable', async () => {
    const events: string[] = [];
    const transport: DeliveryActionTransport = async (command) => {
        if (command.kind !== 'verification-scan') {
            throw new Error('Expected a handoff scan');
        }
        return {
            status: 'handoff-acknowledged',
            replayed: false,
            retryAttempt: 0,
            result: {
                kind: 'scan',
                outcome: 'applied',
                affectedStopIds: [101],
                itemState: 'scanned',
            },
        };
    };
    const { actions, queue } = actionHarness({ events, transport });
    await queue.enqueue(
        createDeliveryVerificationScanCommand({
            operationId: 'non-durable-controller-scan-0001',
            runId,
            stopId: 101,
            expectedRetryAttempt: 0,
            tracePath: '/trag/controller-trace-token-101',
            now,
        }),
    );
    const baseCache = cacheHarness({ events }).cache;
    const cache: DeliveryHandoffManifestCachePersistence = {
        ...baseCache,
        durableCleanupRequired: true,
    };
    const controller = new DeliveryHandoffSyncController({
        userId,
        runId,
        cache,
        actions,
        fetchManifest: async () => ({
            status: 'loaded',
            manifest: manifest({
                itemStates: [{ stopId: 101, state: 'scanned' }],
            }),
        }),
        isOnline: () => true,
        now,
    });

    await controller.setContext({
        target: { targetStopId: 101, retryAttempt: 0 },
        deliveries: [delivery(101)],
        queueSnapshot: actions.getSnapshot(),
    });

    assert.equal(queue.getSnapshot().entries[0]?.state, 'synced');
    assert.equal(controller.getSnapshot().status, 'failed');
    assert.equal(
        events.some((event) => event.startsWith('reconcile:')),
        false,
    );
});

test('refreshes again before purging an acknowledgement that races with the authoritative GET', async () => {
    const events: string[] = [];
    const transport: DeliveryActionTransport = async (command) => {
        if (command.kind !== 'verification-scan') {
            throw new Error('Expected a handoff scan');
        }
        return {
            status: 'handoff-acknowledged',
            replayed: false,
            retryAttempt: 0,
            result: {
                kind: 'scan',
                outcome: 'applied',
                affectedStopIds: [101],
                itemState: 'scanned',
            },
        };
    };
    const { actions, queue } = actionHarness({
        events,
        transport,
        syncNow: async (currentQueue) => currentQueue.getSnapshot(),
    });
    await queue.enqueue(
        createDeliveryVerificationScanCommand({
            operationId: 'racing-controller-scan-0001',
            runId,
            stopId: 101,
            expectedRetryAttempt: 0,
            tracePath: '/trag/controller-trace-token-101',
            now,
        }),
    );
    const getStarted = deferred<void>();
    const getResult = deferred<{
        status: 'loaded';
        manifest: DeliveryHandoffManifest;
    }>();
    const racedAcknowledgementPurged = deferred<void>();
    const { cache, records } = cacheHarness({ events });
    let fetchCount = 0;
    const controller = new DeliveryHandoffSyncController({
        userId,
        runId,
        cache,
        actions: {
            ...actions,
            completeHandoffReconciliation: async (
                targetStopId,
                expectedRetryAttempt,
                operationIds,
            ) => {
                const removed = await actions.completeHandoffReconciliation(
                    targetStopId,
                    expectedRetryAttempt,
                    operationIds,
                );
                if (operationIds.includes('racing-controller-scan-0001')) {
                    racedAcknowledgementPurged.resolve();
                }
                return removed;
            },
        },
        fetchManifest: async () => {
            fetchCount += 1;
            if (fetchCount === 1) {
                getStarted.resolve();
                return await getResult.promise;
            }
            return {
                status: 'loaded',
                manifest: manifest({
                    itemStates: [{ stopId: 101, state: 'scanned' }],
                }),
            };
        },
        isOnline: () => true,
        now,
    });

    const activation = controller.setContext({
        target: { targetStopId: 101, retryAttempt: 0 },
        deliveries: [delivery(101)],
        queueSnapshot: actions.getSnapshot(),
    });
    await getStarted.promise;
    await queue.replay();
    assert.equal(queue.getSnapshot().entries[0]?.state, 'synced');
    getResult.resolve({
        status: 'loaded',
        manifest: manifest({
            itemStates: [{ stopId: 101, state: 'unverified' }],
        }),
    });
    await activation;
    await racedAcknowledgementPurged.promise;

    assert.equal(fetchCount, 2);
    assert.equal(queue.getSnapshot().entries.length, 0);
    assert.equal(
        records.get(`${userId}:${runId}:101:0`)?.manifest.items[0]?.state,
        'scanned',
    );
    assert.deepEqual(
        events.filter(
            (event) =>
                event.startsWith('save:') || event.startsWith('reconcile:'),
        ),
        [
            'save:101:0',
            'reconcile:101:0:',
            'save:101:0',
            'reconcile:101:0:racing-controller-scan-0001',
        ],
    );
});

test('a retry switch ignores stale async data without clearing queued work', async () => {
    const firstFetch = deferred<{
        status: 'loaded';
        manifest: DeliveryHandoffManifest;
    }>();
    const firstFetchStarted = deferred<void>();
    const events: string[] = [];
    const { cache } = cacheHarness({ events });
    const { actions, queue } = actionHarness({ events });
    await queue.enqueue(
        createDeliveryVerificationScanCommand({
            operationId: 'retry-switch-scan-0001',
            runId,
            stopId: 101,
            expectedRetryAttempt: 0,
            tracePath: '/trag/controller-trace-token-101',
            now,
        }),
    );
    let fetchCount = 0;
    const controller = new DeliveryHandoffSyncController({
        userId,
        runId,
        cache,
        actions,
        fetchManifest: async () => {
            fetchCount += 1;
            if (fetchCount === 1) {
                firstFetchStarted.resolve();
                return await firstFetch.promise;
            }
            return {
                status: 'loaded',
                manifest: manifest({
                    retryAttempt: 1,
                    itemStates: [{ stopId: 101, state: 'missing' }],
                }),
            };
        },
        isOnline: () => true,
        now,
    });

    const firstContext = controller.setContext({
        target: { targetStopId: 101, retryAttempt: 0 },
        deliveries: [delivery(101)],
        queueSnapshot: actions.getSnapshot(),
    });
    await firstFetchStarted.promise;
    await controller.setContext({
        target: { targetStopId: 101, retryAttempt: 1 },
        deliveries: [delivery(101)],
        queueSnapshot: actions.getSnapshot(),
    });
    firstFetch.resolve({
        status: 'loaded',
        manifest: manifest({
            retryAttempt: 0,
            itemStates: [{ stopId: 101, state: 'scanned' }],
        }),
    });
    await firstContext;

    assert.equal(controller.getSnapshot().handoff?.retryAttempt, 1);
    assert.equal(controller.getSnapshot().handoff?.items[0]?.state, 'missing');
    assert.deepEqual(
        events.filter((event) => event.startsWith('load:')),
        ['load:101:0', 'load:101:1'],
    );
    assert.deepEqual(
        events.filter((event) => event.startsWith('save:')),
        ['save:101:1'],
    );
    assert.equal(queue.getSnapshot().entries.length, 1);
});

test('a failed reconnect preserves queued optimistic verification work', async () => {
    let online = false;
    const { cache } = cacheHarness();
    const { actions } = actionHarness({
        syncNow: async () => {
            throw new Error('network unavailable');
        },
    });
    const controller = new DeliveryHandoffSyncController({
        userId,
        runId,
        cache,
        actions,
        fetchManifest: async () => ({
            status: 'retryable-failure',
            code: 'offline',
        }),
        isOnline: () => online,
        now,
    });
    await controller.setContext({
        target: { targetStopId: 101, retryAttempt: 0 },
        deliveries: [delivery(101)],
        queueSnapshot: actions.getSnapshot(),
    });
    await controller.scan('/trag/controller-trace-token-101');

    online = true;
    controller.connectionChanged();
    assert.equal(await controller.refresh(), false);

    assert.equal(controller.getSnapshot().status, 'failed');
    assert.equal(controller.getSnapshot().handoff?.pendingCount, 1);
    assert.equal(controller.getSnapshot().handoff?.items[0]?.state, 'scanned');
    assert.equal(
        controller.getSnapshot().handoff?.items[0]?.syncState,
        'queued',
    );
});

test('manual review preserves manifest order without an arbitrary batch cap', async () => {
    const orderedDeliveries = [delivery(103), delivery(101), delivery(102)];
    const { cache } = cacheHarness();
    const { actions, queue } = actionHarness();
    const controller = new DeliveryHandoffSyncController({
        userId,
        runId,
        cache,
        actions,
        fetchManifest: async () => ({
            status: 'retryable-failure',
            code: 'offline',
        }),
        isOnline: () => false,
        now,
    });
    await controller.setContext({
        target: { targetStopId: 101, retryAttempt: 0 },
        deliveries: orderedDeliveries,
        queueSnapshot: actions.getSnapshot(),
    });

    assert.deepEqual(await controller.markRemainingReviewed(), {
        status: 'saved',
    });
    assert.deepEqual(
        queue
            .getSnapshot()
            .entries.map((entry) =>
                entry.command.kind === 'verification-mark'
                    ? [
                          entry.command.itemStopId,
                          entry.command.outcome,
                          entry.command.reason,
                      ]
                    : [],
            ),
        [
            [103, 'skipped', 'manual-verification'],
            [101, 'skipped', 'manual-verification'],
            [102, 'skipped', 'manual-verification'],
        ],
    );

    const largeHarness = actionHarness();
    const largeController = new DeliveryHandoffSyncController({
        userId,
        runId,
        cache: cacheHarness().cache,
        actions: largeHarness.actions,
        fetchManifest: async () => ({
            status: 'retryable-failure',
            code: 'offline',
        }),
        isOnline: () => false,
        now,
    });
    const largeDeliveries = Array.from({ length: 101 }, (_, index) =>
        delivery(index + 1),
    );
    await largeController.setContext({
        target: { targetStopId: 1, retryAttempt: 0 },
        deliveries: largeDeliveries,
        queueSnapshot: largeHarness.actions.getSnapshot(),
    });

    assert.deepEqual(await largeController.markRemainingReviewed(), {
        status: 'saved',
    });
    assert.deepEqual(
        largeHarness.queue
            .getSnapshot()
            .entries.map((entry) =>
                entry.command.kind === 'verification-mark'
                    ? entry.command.itemStopId
                    : null,
            ),
        Array.from({ length: 101 }, (_, index) => index + 1),
    );
});
