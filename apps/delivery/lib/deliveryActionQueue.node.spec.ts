import assert from 'node:assert/strict';
import test from 'node:test';
import {
    deliveryRunCompletedMessage,
    deliveryRunCompletionFromSnapshot,
    parseDeliveryActionChannelMessage,
} from './deliveryActionCompletion';
import {
    clearOtherDeliveryActionQueueScopes,
    createDeliveryArriveCommand,
    createDeliveryCompleteCommand,
    createDeliveryExceptionCommand,
    createDeliveryVerificationScanCommand,
    createMemoryDeliveryActionQueuePersistence,
    DeliveryActionBarrierError,
    DeliveryActionOperationConflictError,
    DeliveryActionQueue,
    type DeliveryActionQueueCoordinator,
    type DeliveryActionQueuePersistence,
    type DeliveryActionTransport,
    deliveryActionPendingEntryForStop,
    deliveryActionQueueCanReplay,
    deliveryActionVerifiedTracePaths,
    nextDeliveryActionRouteRevision,
} from './deliveryActionQueue';

const scope = { userId: 'driver-1', runId: 'run-1' };
const now = () => new Date('2026-07-15T12:00:00.000Z');

function arrive(operationId = 'arrive-1', revision = 4) {
    return createDeliveryArriveCommand({
        operationId,
        runId: scope.runId,
        stopId: 101,
        expectedRouteRevision: revision,
        now,
    });
}

function complete(operationId = 'deliver-1', revision = 5) {
    return createDeliveryCompleteCommand({
        operationId,
        runId: scope.runId,
        stopId: 101,
        expectedRouteRevision: revision,
        notes: '  Predano susjedi  ',
        now,
    });
}

function queue({
    persistence = createMemoryDeliveryActionQueuePersistence(),
    transport = async () => ({
        status: 'applied' as const,
        routeRevision: 5,
        reroutePending: false,
        runCompleted: false,
    }),
    clock = now,
    coordinator,
    replayCoordinator,
}: {
    persistence?: DeliveryActionQueuePersistence;
    transport?: DeliveryActionTransport;
    clock?: () => Date;
    coordinator?: DeliveryActionQueueCoordinator;
    replayCoordinator?: DeliveryActionQueueCoordinator;
} = {}) {
    return new DeliveryActionQueue({
        scope,
        persistence,
        transport,
        now: clock,
        coordinator,
        replayCoordinator,
    });
}

function serialCoordinator(): DeliveryActionQueueCoordinator {
    let tail = Promise.resolve();
    return {
        async runExclusive(_scope, task) {
            const previous = tail;
            let release: (() => void) | undefined;
            tail = new Promise<void>((resolve) => {
                release = resolve;
            });
            await previous;
            try {
                return await task();
            } finally {
                release?.();
            }
        },
    };
}

test('normalizes immutable route commands and rejects malformed payloads', () => {
    assert.deepEqual(complete(), {
        operationId: 'deliver-1',
        runId: 'run-1',
        stopId: 101,
        expectedRouteRevision: 5,
        kind: 'deliver',
        notes: 'Predano susjedi',
        occurredAt: '2026-07-15T12:00:00.000Z',
    });
    assert.throws(
        () =>
            createDeliveryArriveCommand({
                operationId: '',
                runId: scope.runId,
                stopId: 101,
                expectedRouteRevision: 4,
                now,
            }),
        TypeError,
    );
});

test('replays arrival and delivery strictly in order with explicit acknowledgements', async () => {
    const sent: string[] = [];
    let revision = 4;
    const actionQueue = queue({
        transport: async (command) => {
            sent.push(command.operationId);
            revision += 1;
            return {
                status:
                    command.operationId === 'deliver-1'
                        ? ('exact-duplicate' as const)
                        : ('applied' as const),
                routeRevision: revision,
                reroutePending: false,
                runCompleted: command.kind === 'deliver',
            };
        },
    });

    await actionQueue.enqueue(arrive());
    assert.equal(
        nextDeliveryActionRouteRevision(actionQueue.getSnapshot(), 4),
        5,
    );
    await actionQueue.enqueue(complete());
    assert.equal(
        nextDeliveryActionRouteRevision(actionQueue.getSnapshot(), 4),
        6,
    );
    const replayed = await actionQueue.replay();

    assert.deepEqual(sent, ['arrive-1', 'deliver-1']);
    assert.equal(replayed.entries[0]?.state, 'synced');
    assert.equal(replayed.entries[0]?.acknowledgement?.routeRevision, 5);
    assert.equal(replayed.entries[1]?.acknowledgement?.replayed, true);
    assert.equal(replayed.entries[1]?.acknowledgement?.runCompleted, true);
});

test('a retryable failure stays visibly pending and blocks later route work', async () => {
    const sent: string[] = [];
    let fail = true;
    const actionQueue = queue({
        transport: async (command) => {
            sent.push(command.operationId);
            if (fail) return { status: 'retryable-failure', code: 'offline' };
            return {
                status: 'applied',
                routeRevision: command.kind === 'arrive' ? 5 : 6,
                reroutePending: false,
                runCompleted: false,
            };
        },
    });
    await actionQueue.enqueue(arrive());
    await actionQueue.enqueue(complete());

    const failed = await actionQueue.replay();
    assert.deepEqual(sent, ['arrive-1']);
    assert.equal(failed.entries[0]?.state, 'failed');
    assert.equal(failed.entries[1]?.state, 'queued');
    assert.equal(
        deliveryActionPendingEntryForStop(failed, 101)?.errorCode,
        'offline',
    );
    await assert.rejects(
        actionQueue.enqueue(
            createDeliveryArriveCommand({
                operationId: 'arrive-later-stop',
                runId: scope.runId,
                stopId: 102,
                expectedRouteRevision: 6,
                now,
            }),
        ),
        DeliveryActionBarrierError,
    );

    fail = false;
    assert.equal(await actionQueue.retry('arrive-1'), true);
    await actionQueue.replay();
    assert.deepEqual(sent, ['arrive-1', 'arrive-1', 'deliver-1']);
});

test('a server-required reroute stops replay before dependent route work', async () => {
    const transported: string[] = [];
    const actions = queue({
        transport: async (command) => {
            transported.push(command.operationId);
            return {
                status: 'applied',
                routeRevision: command.expectedRouteRevision + 1,
                reroutePending: true,
                runCompleted: false,
            };
        },
    });
    await actions.enqueue(complete('reroute-delivery', 4));
    await actions.enqueue(
        createDeliveryArriveCommand({
            operationId: 'dependent-next-arrival',
            runId: scope.runId,
            stopId: 102,
            expectedRouteRevision: 5,
            now,
        }),
    );

    const replayed = await actions.replay();

    assert.deepEqual(transported, ['reroute-delivery']);
    assert.equal(replayed.entries[0]?.state, 'synced');
    assert.equal(replayed.entries[0]?.acknowledgement?.reroutePending, true);
    assert.equal(replayed.entries[1]?.state, 'queued');
    await actions.replay();
    assert.deepEqual(transported, ['reroute-delivery']);
    await assert.rejects(
        actions.enqueueRouteAction(5, (expectedRouteRevision) =>
            createDeliveryArriveCommand({
                operationId: 'blocked-during-reroute',
                runId: scope.runId,
                stopId: 103,
                expectedRouteRevision,
                now,
            }),
        ),
        DeliveryActionBarrierError,
    );

    await actions.completeServerReconciliation('reroute-delivery');
    assert.equal(deliveryActionQueueCanReplay(actions.getSnapshot()), true);
    await actions.replay();
    assert.deepEqual(transported, [
        'reroute-delivery',
        'dependent-next-arrival',
    ]);
});

test('restores an interrupted send as queued without mutating its operation ID', async () => {
    const persistence = createMemoryDeliveryActionQueuePersistence();
    let release: (() => void) | undefined;
    const inFlight = new Promise<void>((resolve) => {
        release = resolve;
    });
    const first = queue({
        persistence,
        transport: async () => {
            await inFlight;
            return {
                status: 'applied',
                routeRevision: 5,
                reroutePending: false,
                runCompleted: false,
            };
        },
    });
    await first.enqueue(arrive());
    const replayPromise = first.replay();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const restored = queue({ persistence });
    const snapshot = await restored.restore();
    assert.equal(snapshot.entries[0]?.state, 'queued');
    assert.equal(snapshot.entries[0]?.command.operationId, 'arrive-1');
    release?.();
    await replayPromise;
});

test('computes a new command revision after restoring durable predecessors atomically', async () => {
    const persistence = createMemoryDeliveryActionQueuePersistence();
    const first = queue({ persistence });
    await first.enqueue(arrive());

    const reloaded = queue({ persistence });
    await reloaded.enqueueRouteAction(4, (expectedRouteRevision) =>
        complete('deliver-after-reload', expectedRouteRevision),
    );

    const commands = reloaded
        .getSnapshot()
        .entries.map((entry) => entry.command);
    const firstCommand = commands[0];
    const secondCommand = commands[1];
    if (
        !firstCommand ||
        firstCommand.kind === 'verification-scan' ||
        !secondCommand ||
        secondCommand.kind === 'verification-scan'
    ) {
        throw new Error('Expected two route-changing commands');
    }
    assert.equal(firstCommand.expectedRouteRevision, 4);
    assert.equal(secondCommand.expectedRouteRevision, 5);
});

test('an exception is a reconciliation barrier for later route commands', async () => {
    let transportCalls = 0;
    const actionQueue = queue({
        transport: async () => {
            transportCalls += 1;
            return {
                status: 'applied',
                routeRevision: 5,
                reroutePending: false,
                runCompleted: false,
            };
        },
    });
    const exception = createDeliveryExceptionCommand({
        operationId: 'exception-1',
        runId: scope.runId,
        stopId: 101,
        expectedRouteRevision: 4,
        exceptions: [
            {
                stopId: 101,
                outcome: 'deferred',
                reason: 'customer-unavailable',
            },
        ],
        now,
    });
    await actionQueue.enqueue(exception);
    await assert.rejects(
        actionQueue.enqueue(complete()),
        DeliveryActionBarrierError,
    );
    const acknowledged = await actionQueue.replay();
    assert.equal(acknowledged.entries[0]?.state, 'reconciling');
    assert.equal(transportCalls, 1);
    await actionQueue.replay();
    assert.equal(transportCalls, 1);
    await assert.rejects(
        actionQueue.enqueue(complete()),
        DeliveryActionBarrierError,
    );
    assert.equal(
        await actionQueue.completeServerReconciliation(exception.operationId),
        true,
    );
    await actionQueue.enqueue(complete());
});

test('a stale server conflict preserves the blocking command until explicit recovery', async () => {
    const sent: string[] = [];
    const actionQueue = queue({
        transport: async (command) => {
            sent.push(command.operationId);
            return command.operationId === 'arrive-1'
                ? {
                      status: 'permanent-failure',
                      code: 'route-revision-conflict',
                  }
                : {
                      status: 'applied',
                      routeRevision: 6,
                      reroutePending: false,
                      runCompleted: false,
                  };
        },
    });
    await actionQueue.enqueue(arrive());
    await actionQueue.enqueue(complete());

    const conflicted = await actionQueue.replay();
    assert.deepEqual(sent, ['arrive-1']);
    assert.equal(conflicted.entries[0]?.state, 'conflicted');
    assert.equal(conflicted.entries[0]?.errorCode, 'route-revision-conflict');
    assert.equal(conflicted.entries[1]?.state, 'queued');
    await assert.rejects(
        actionQueue.enqueue(
            createDeliveryArriveCommand({
                operationId: 'arrive-after-conflict',
                runId: scope.runId,
                stopId: 102,
                expectedRouteRevision: 6,
                now,
            }),
        ),
        DeliveryActionBarrierError,
    );

    assert.equal(
        await actionQueue.discardConflictAndDependents('arrive-1'),
        true,
    );
    await actionQueue.replay();
    assert.deepEqual(sent, ['arrive-1']);
    assert.equal(actionQueue.getSnapshot().entries.length, 0);
});

test('rapid repeated route taps reuse the durable pending operation', async () => {
    const actionQueue = queue();
    const first = await actionQueue.enqueue(arrive());
    const duplicate = await actionQueue.enqueue(arrive('arrival-new-id'));

    assert.equal(duplicate.command.operationId, first.command.operationId);
    assert.equal(actionQueue.getSnapshot().entries.length, 1);
});

test('advisory verification scans persist locally, deduplicate, and never call transport', async () => {
    const persistence = createMemoryDeliveryActionQueuePersistence();
    let transportCalls = 0;
    const actionQueue = queue({
        persistence,
        transport: async () => {
            transportCalls += 1;
            return {
                status: 'applied',
                routeRevision: 5,
                reroutePending: false,
                runCompleted: false,
            };
        },
    });
    const scan = createDeliveryVerificationScanCommand({
        operationId: 'scan-1',
        runId: scope.runId,
        stopId: 101,
        tracePath: '/trag/plant-trace-token-0001',
        now,
    });
    await actionQueue.enqueue(scan);
    await actionQueue.enqueue({ ...scan, operationId: 'scan-duplicate' });
    await actionQueue.enqueue(arrive());
    await actionQueue.replay();

    assert.equal(transportCalls, 1);
    assert.deepEqual(
        deliveryActionVerifiedTracePaths(actionQueue.getSnapshot(), 101),
        ['/trag/plant-trace-token-0001'],
    );
    const restored = queue({ persistence });
    await restored.restore();
    assert.deepEqual(
        deliveryActionVerifiedTracePaths(restored.getSnapshot(), 101),
        ['/trag/plant-trace-token-0001'],
    );
});

test('rejects operation ID reuse with a changed payload and expires old device data', async () => {
    const persistence = createMemoryDeliveryActionQueuePersistence();
    const first = queue({ persistence });
    await first.enqueue(arrive());
    await assert.rejects(
        first.enqueue({ ...arrive(), expectedRouteRevision: 9 }),
        DeliveryActionOperationConflictError,
    );

    const afterTtl = queue({
        persistence,
        clock: () => new Date('2026-07-16T12:00:00.001Z'),
    });
    const restored = await afterTtl.restore();
    assert.equal(restored.entries.length, 0);
});

test('keeps persisted actions isolated by authenticated user and run scope', async () => {
    const persistence = createMemoryDeliveryActionQueuePersistence();
    const first = queue({ persistence });
    await first.enqueue(arrive());

    const otherUser = new DeliveryActionQueue({
        scope: { userId: 'driver-2', runId: scope.runId },
        persistence,
        transport: async () => ({
            status: 'applied',
            routeRevision: 5,
            reroutePending: false,
            runCompleted: false,
        }),
        now,
    });
    const otherRun = new DeliveryActionQueue({
        scope: { userId: scope.userId, runId: 'run-2' },
        persistence,
        transport: async () => ({
            status: 'applied',
            routeRevision: 5,
            reroutePending: false,
            runCompleted: false,
        }),
        now,
    });
    assert.equal((await otherUser.restore()).entries.length, 0);
    assert.equal((await otherRun.restore()).entries.length, 0);

    await persistence.clear({ userId: 'driver-2' });
    assert.equal((await first.restore()).entries.length, 1);
    await persistence.clear({ userId: scope.userId });
    assert.equal((await first.restore()).entries.length, 0);
});

test('prunes stale run scopes while preserving the authenticated active run', async () => {
    const persistence = createMemoryDeliveryActionQueuePersistence();
    const current = queue({ persistence });
    await current.enqueue(arrive());
    const stale = new DeliveryActionQueue({
        scope: { userId: scope.userId, runId: 'run-stale' },
        persistence,
        transport: async () => ({
            status: 'applied',
            routeRevision: 1,
            reroutePending: false,
            runCompleted: false,
        }),
        now,
    });
    await stale.enqueue(
        createDeliveryArriveCommand({
            operationId: 'stale-arrival',
            runId: 'run-stale',
            stopId: 102,
            expectedRouteRevision: 0,
            now,
        }),
    );

    await clearOtherDeliveryActionQueueScopes(persistence, {
        userId: scope.userId,
        activeRunId: scope.runId,
    });

    assert.equal((await current.restore()).entries.length, 1);
    assert.equal((await stale.restore()).entries.length, 0);
});

test('restores a durable completion marker and validates its cross-tab signal', async () => {
    const persistence = createMemoryDeliveryActionQueuePersistence();
    const first = queue({
        persistence,
        transport: async () => ({
            status: 'applied',
            routeRevision: 5,
            reroutePending: false,
            runCompleted: true,
        }),
    });
    await first.enqueue(arrive('final-arrival'));
    await first.replay();

    const restored = queue({ persistence });
    const snapshot = await restored.restore();
    const completion = deliveryRunCompletionFromSnapshot(snapshot);
    if (!completion) throw new Error('Expected a durable completion marker');
    assert.deepEqual(completion, {
        userId: scope.userId,
        runId: scope.runId,
        operationId: 'final-arrival',
    });
    assert.deepEqual(
        parseDeliveryActionChannelMessage(
            deliveryRunCompletedMessage(completion),
        ),
        deliveryRunCompletedMessage(completion),
    );
    assert.equal(
        parseDeliveryActionChannelMessage({
            version: 1,
            kind: 'run-completed',
            completion: { ...completion, runId: '' },
        }),
        null,
    );
});

test('keeps the completion marker when durable queue deletion cannot be confirmed', async () => {
    let durability: 'durable' | 'memory' = 'durable';
    let stored: unknown;
    const persistence: DeliveryActionQueuePersistence = {
        get durability() {
            return durability;
        },
        async load() {
            return stored;
        },
        async save(_scope, entries) {
            stored = { version: 1, entries };
        },
        async clear() {
            durability = 'memory';
        },
    };
    const actions = queue({
        persistence,
        transport: async () => ({
            status: 'applied',
            routeRevision: 5,
            reroutePending: false,
            runCompleted: true,
        }),
    });
    await actions.enqueue(arrive('durable-completion'));
    const completed = await actions.replay();
    assert.ok(deliveryRunCompletionFromSnapshot(completed));

    await assert.rejects(
        actions.clear(),
        /Durable delivery action cleanup could not be confirmed/,
    );
    assert.ok(deliveryRunCompletionFromSnapshot(actions.getSnapshot()));
    assert.equal(actions.getSnapshot().durability, 'memory');
});

test('keeps the completion marker after an earlier durable-store degradation', async () => {
    let stored: unknown;
    const persistence: DeliveryActionQueuePersistence = {
        durability: 'memory',
        durableCleanupRequired: true,
        async load() {
            return stored;
        },
        async save(_scope, entries) {
            stored = { version: 1, entries };
        },
        async clear() {
            stored = undefined;
        },
    };
    const actions = queue({
        persistence,
        transport: async () => ({
            status: 'applied',
            routeRevision: 5,
            reroutePending: false,
            runCompleted: true,
        }),
    });
    await actions.enqueue(arrive('degraded-completion'));
    await actions.replay();

    await assert.rejects(
        actions.clear(),
        /Durable delivery action cleanup could not be confirmed/,
    );
    assert.ok(deliveryRunCompletionFromSnapshot(actions.getSnapshot()));
});

test('shared state and replay locks preserve concurrent cross-tab actions', async () => {
    const persistence = createMemoryDeliveryActionQueuePersistence();
    const coordinator = serialCoordinator();
    const replayCoordinator = serialCoordinator();
    const first = queue({ persistence, coordinator, replayCoordinator });
    const second = queue({ persistence, coordinator, replayCoordinator });

    await Promise.all([
        first.enqueue(arrive('cross-tab-arrival')),
        second.enqueue(
            createDeliveryVerificationScanCommand({
                operationId: 'cross-tab-scan',
                runId: scope.runId,
                stopId: 101,
                tracePath: '/trag/cross-tab-trace-0001',
                now,
            }),
        ),
    ]);

    const restored = queue({
        persistence,
        coordinator,
        replayCoordinator,
    });
    const snapshot = await restored.restore();
    assert.equal(snapshot.coordination, 'best-effort');
    assert.deepEqual(
        snapshot.entries.map((entry) => entry.command.operationId),
        ['cross-tab-arrival', 'cross-tab-scan'],
    );
    assert.deepEqual(
        snapshot.entries.map((entry) => entry.sequence),
        [0, 1],
    );
});
