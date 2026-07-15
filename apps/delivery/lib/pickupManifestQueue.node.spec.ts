import assert from 'node:assert/strict';
import test from 'node:test';
import {
    clearPickupManifestQueueScope,
    createMemoryPickupManifestQueuePersistence,
    createPickupManifestConfirmCommand,
    createPickupManifestManualOutcomeCommand,
    createPickupManifestScanCommand,
    createWebStoragePickupManifestQueuePersistence,
    type PickupManifestCommand,
    PickupManifestOperationConflictError,
    PickupManifestQueue,
    type PickupManifestQueueCoordinator,
    type PickupManifestQueuePersistence,
    type PickupManifestQueueScope,
    type PickupManifestTransportResult,
    type PickupManifestWebStorage,
    pickupManifestQueueStorageKey,
} from './pickupManifestQueue';

const occurredAt = '2026-07-15T08:00:00.000Z';
const traceToken = 'pickup-manifest-trace-token-2026';
const defaultScope = { userId: 'driver-1', runId: 'run-1' };

function scanCommand(
    operationId: string,
    {
        runId = defaultScope.runId,
        pickupNodeId = 'pickup-1',
        token = traceToken,
    }: {
        runId?: string;
        pickupNodeId?: string;
        token?: string;
    } = {},
) {
    return createPickupManifestScanCommand({
        operationId,
        runId,
        pickupNodeId,
        scanValue: token,
        occurredAt,
    });
}

function queue({
    persistence,
    transport,
    scope = defaultScope,
    coordinator,
    replayCoordinator,
}: {
    persistence: PickupManifestQueuePersistence;
    transport?: (
        command: PickupManifestCommand,
    ) => Promise<PickupManifestTransportResult>;
    scope?: PickupManifestQueueScope;
    coordinator?: PickupManifestQueueCoordinator;
    replayCoordinator?: PickupManifestQueueCoordinator;
}) {
    return new PickupManifestQueue({
        scope,
        persistence,
        transport: transport ?? (async () => ({ status: 'applied' })),
        coordinator,
        replayCoordinator,
        now: () => new Date(occurredAt),
    });
}

function memoryWebStorage(): PickupManifestWebStorage {
    const values = new Map<string, string>();
    return {
        get length() {
            return values.size;
        },
        key(index) {
            return Array.from(values.keys())[index] ?? null;
        },
        getItem(key) {
            return values.get(key) ?? null;
        },
        setItem(key, value) {
            values.set(key, value);
        },
        removeItem(key) {
            values.delete(key);
        },
    };
}

function serialCoordinator(): PickupManifestQueueCoordinator {
    let tail = Promise.resolve();
    return {
        async runExclusive(_scope, task) {
            const previous = tail;
            let release: (() => void) | undefined;
            tail = new Promise<void>((resolve) => {
                release = () => resolve();
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

test('command factories keep only replay identifiers and a normalized trace path', () => {
    const scan = createPickupManifestScanCommand({
        operationId: 'operation-scan',
        runId: 'run-1',
        pickupNodeId: 'pickup-1',
        scanValue: `https://www.gredice.com/trag/${traceToken}?camera=1`,
        occurredAt,
    });
    const manual = createPickupManifestManualOutcomeCommand({
        operationId: 'operation-manual',
        runId: 'run-1',
        pickupNodeId: 'pickup-1',
        manifestId: 'manifest-1',
        stopId: 17,
        outcome: 'missing-label',
        occurredAt,
    });
    const confirm = createPickupManifestConfirmCommand({
        operationId: 'operation-confirm',
        runId: 'run-1',
        pickupNodeId: 'pickup-1',
        manifestId: 'manifest-1',
        occurredAt,
    });

    assert.deepEqual(scan, {
        operationId: 'operation-scan',
        runId: 'run-1',
        pickupNodeId: 'pickup-1',
        kind: 'scan',
        tracePath: `/trag/${traceToken}`,
        occurredAt,
    });
    assert.deepEqual(Object.keys(manual).sort(), [
        'kind',
        'manifestId',
        'occurredAt',
        'operationId',
        'outcome',
        'pickupNodeId',
        'runId',
        'stopId',
    ]);
    assert.deepEqual(Object.keys(confirm).sort(), [
        'kind',
        'manifestId',
        'occurredAt',
        'operationId',
        'pickupNodeId',
        'runId',
    ]);
    assert.throws(
        () =>
            createPickupManifestScanCommand({
                operationId: 'invalid-scan',
                runId: 'run-1',
                pickupNodeId: 'pickup-1',
                scanValue: 'not-a-trace',
                occurredAt,
            }),
        /valid harvest trace/,
    );
});

test('replays commands in queue order and treats an exact duplicate as synced', async () => {
    const persistence = createMemoryPickupManifestQueuePersistence();
    const transported: string[] = [];
    const states: string[] = [];
    const manifestQueue = queue({
        persistence,
        transport: async (command) => {
            transported.push(command.operationId);
            return command.operationId === 'second'
                ? { status: 'exact-duplicate' }
                : { status: 'applied' };
        },
    });
    manifestQueue.subscribe(() =>
        states.push(manifestQueue.getSnapshot().status),
    );

    await manifestQueue.enqueue(scanCommand('first'));
    await manifestQueue.enqueue(
        scanCommand('second', { token: `${traceToken}-2` }),
    );
    const result = await manifestQueue.replay();

    assert.deepEqual(transported, ['first', 'second']);
    assert.equal(result.status, 'synced');
    assert.equal(result.syncedCount, 2);
    assert.equal(result.entries[0]?.acknowledgement, 'applied');
    assert.equal(result.entries[1]?.acknowledgement, 'exact-duplicate');
    assert.ok(states.includes('queued'));
    assert.ok(states.includes('sending'));
    assert.equal(states.at(-1), 'synced');
});

test('durably enqueues rapid scans while an earlier transport request is in flight', async () => {
    const persistence = createMemoryPickupManifestQueuePersistence();
    let releaseTransport: (() => void) | undefined;
    let markTransportStarted: (() => void) | undefined;
    const transportStarted = new Promise<void>((resolve) => {
        markTransportStarted = resolve;
    });
    const transportGate = new Promise<void>((resolve) => {
        releaseTransport = resolve;
    });
    const transported: string[] = [];
    const manifestQueue = queue({
        persistence,
        coordinator: serialCoordinator(),
        replayCoordinator: serialCoordinator(),
        transport: async (command) => {
            transported.push(command.operationId);
            if (command.operationId === 'first-in-flight') {
                markTransportStarted?.();
                await transportGate;
            }
            return { status: 'applied' };
        },
    });
    await manifestQueue.enqueue(scanCommand('first-in-flight'));
    const replay = manifestQueue.replay();
    await transportStarted;

    const secondEnqueue = manifestQueue.enqueue(
        scanCommand('second-durable', { token: `${traceToken}-2` }),
    );
    const persistedBeforeTransportFinished = await Promise.race([
        secondEnqueue.then(() => true),
        new Promise<false>((resolve) => setTimeout(() => resolve(false), 100)),
    ]);
    assert.equal(persistedBeforeTransportFinished, true);

    const reloaded = queue({ persistence });
    const restored = await reloaded.restore();
    assert.deepEqual(
        restored.entries.map((entry) => entry.command.operationId),
        ['first-in-flight', 'second-durable'],
    );

    releaseTransport?.();
    await replay;
    assert.deepEqual(transported, ['first-in-flight', 'second-durable']);
    assert.equal(manifestQueue.getSnapshot().status, 'synced');
});

test('exact duplicate enqueue is harmless and a reused operation ID with another payload is rejected', async () => {
    const persistence = createMemoryPickupManifestQueuePersistence();
    const manifestQueue = queue({
        persistence,
        coordinator: serialCoordinator(),
        replayCoordinator: serialCoordinator(),
    });
    const command = scanCommand('same-operation');

    await manifestQueue.enqueue(command);
    await manifestQueue.enqueue({ ...command });
    assert.equal(manifestQueue.getSnapshot().entries.length, 1);

    await assert.rejects(
        manifestQueue.enqueue(
            scanCommand('same-operation', { token: `${traceToken}-changed` }),
        ),
        PickupManifestOperationConflictError,
    );
});

test('stops on transport failure and resumes from that command before later work', async () => {
    const persistence = createMemoryPickupManifestQueuePersistence();
    const transported: string[] = [];
    let firstAttempt = true;
    const manifestQueue = queue({
        persistence,
        transport: async (command) => {
            transported.push(command.operationId);
            if (command.operationId === 'first' && firstAttempt) {
                firstAttempt = false;
                return { status: 'retryable-failure', code: 'offline' };
            }
            return { status: 'applied' };
        },
    });
    await manifestQueue.enqueue(scanCommand('first'));
    await manifestQueue.enqueue(
        scanCommand('second', { token: `${traceToken}-2` }),
    );

    const failed = await manifestQueue.replay();
    assert.deepEqual(transported, ['first']);
    assert.equal(failed.status, 'failed');
    assert.equal(failed.entries[0]?.errorCode, 'offline');
    assert.equal(failed.entries[1]?.state, 'queued');

    assert.equal(await manifestQueue.retryEntry('first'), true);
    const recovered = await manifestQueue.replay();
    assert.deepEqual(transported, ['first', 'first', 'second']);
    assert.equal(recovered.status, 'synced');
    assert.equal(recovered.entries[0]?.attemptCount, 2);
    assert.equal(recovered.entries[1]?.attemptCount, 1);
});

test('keeps permanent conflicts discard-only and unblocks later work after discard', async () => {
    const persistence = createMemoryPickupManifestQueuePersistence();
    const transported: string[] = [];
    const manifestQueue = queue({
        persistence,
        transport: async (command) => {
            transported.push(command.operationId);
            if (command.operationId === 'second') {
                return {
                    status: 'permanent-failure',
                    code: 'manifest-revision-conflict',
                };
            }
            return { status: 'applied' };
        },
    });
    await manifestQueue.enqueue(scanCommand('first'));
    await manifestQueue.enqueue(
        scanCommand('second', { token: `${traceToken}-2` }),
    );
    await manifestQueue.enqueue(
        scanCommand('third', { token: `${traceToken}-3` }),
    );

    const conflicted = await manifestQueue.replay();
    assert.deepEqual(transported, ['first', 'second']);
    assert.equal(conflicted.status, 'conflicted');
    assert.equal(
        conflicted.entries[1]?.errorCode,
        'manifest-revision-conflict',
    );
    assert.equal(conflicted.entries[2]?.state, 'queued');

    assert.equal(await manifestQueue.retryEntry('second'), false);
    assert.equal(await manifestQueue.discardEntry('second'), true);
    const recovered = await manifestQueue.replay();
    assert.deepEqual(transported, ['first', 'second', 'third']);
    assert.equal(recovered.status, 'synced');
});

test('discarding or reconciling a permanent failure unblocks later work', async () => {
    const persistence = createMemoryPickupManifestQueuePersistence();
    const transported: string[] = [];
    const manifestQueue = queue({
        persistence,
        transport: async (command) => {
            transported.push(command.operationId);
            return command.operationId === 'blocked'
                ? {
                      status: 'permanent-failure',
                      code: 'pickup-trace-not-found',
                  }
                : { status: 'applied' };
        },
    });
    await manifestQueue.enqueue(scanCommand('blocked'));
    await manifestQueue.enqueue(
        scanCommand('after-blocked', { token: `${traceToken}-2` }),
    );

    assert.equal((await manifestQueue.replay()).status, 'conflicted');
    assert.equal(await manifestQueue.discardEntry('blocked'), true);
    assert.equal((await manifestQueue.replay()).status, 'synced');
    assert.deepEqual(transported, ['blocked', 'after-blocked']);

    const reconciledQueue = queue({ persistence });
    await reconciledQueue.enqueue(
        scanCommand('reconcile-me', { token: `${traceToken}-3` }),
    );
    assert.equal(
        await reconciledQueue.reconcileEntry('reconcile-me', 'exact-duplicate'),
        true,
    );
    const reconciled = reconciledQueue
        .getSnapshot()
        .entries.find((entry) => entry.command.operationId === 'reconcile-me');
    assert.equal(reconciled?.state, 'synced');
    assert.equal(reconciled?.acknowledgement, 'exact-duplicate');
});

test('restores queued work after reload and converts interrupted sending back to queued', async () => {
    const initialCommand = scanCommand('interrupted');
    let stored: unknown = {
        version: 1,
        entries: [
            {
                sequence: 4,
                command: initialCommand,
                state: 'sending',
                attemptCount: 1,
                updatedAt: occurredAt,
            },
        ],
    };
    const persistence: PickupManifestQueuePersistence = {
        durability: 'durable',
        async load() {
            return stored;
        },
        async save(_scope, entries) {
            stored = { version: 1, entries };
        },
        async clear() {},
    };
    const transported: string[] = [];
    const restoredQueue = queue({
        persistence,
        transport: async (command) => {
            transported.push(command.operationId);
            return { status: 'exact-duplicate' };
        },
    });

    const restored = await restoredQueue.restore();
    assert.equal(restored.entries[0]?.state, 'queued');
    assert.equal(restored.entries[0]?.attemptCount, 1);
    const replayed = await restoredQueue.replay();
    assert.deepEqual(transported, ['interrupted']);
    assert.equal(replayed.entries[0]?.attemptCount, 2);
    assert.equal(replayed.entries[0]?.acknowledgement, 'exact-duplicate');
});

test('durable persistence restores work and cleanup can target one run or every run for a user', async () => {
    const persistence = createMemoryPickupManifestQueuePersistence();
    const firstScope = { userId: 'driver-1', runId: 'run-1' };
    const secondScope = { userId: 'driver-1', runId: 'run-2' };
    const otherUserScope = { userId: 'driver-2', runId: 'run-3' };

    await queue({ persistence, scope: firstScope }).enqueue(scanCommand('one'));
    await queue({ persistence, scope: secondScope }).enqueue(
        scanCommand('two', { runId: 'run-2' }),
    );
    await queue({ persistence, scope: otherUserScope }).enqueue(
        scanCommand('three', { runId: 'run-3' }),
    );

    const reloaded = queue({ persistence, scope: firstScope });
    assert.equal((await reloaded.restore()).queuedCount, 1);

    await clearPickupManifestQueueScope(persistence, firstScope);
    assert.equal(
        (await queue({ persistence, scope: firstScope }).restore()).entries
            .length,
        0,
    );
    assert.equal(
        (await queue({ persistence, scope: secondScope }).restore()).entries
            .length,
        1,
    );

    await clearPickupManifestQueueScope(persistence, { userId: 'driver-1' });
    assert.equal(
        (await queue({ persistence, scope: secondScope }).restore()).entries
            .length,
        0,
    );
    assert.equal(
        (await queue({ persistence, scope: otherUserScope }).restore()).entries
            .length,
        1,
    );
});

test('web storage remains durable without a cross-tab lock coordinator', async () => {
    const storage = memoryWebStorage();
    const persistence = createWebStoragePickupManifestQueuePersistence(storage);
    const firstQueue = queue({ persistence });
    await firstQueue.enqueue(scanCommand('web-storage'));

    const restoredQueue = queue({ persistence });
    const restored = await restoredQueue.restore();
    assert.equal(restored.entries.length, 1);
    assert.equal(restored.entries[0]?.command.operationId, 'web-storage');
    assert.equal(restored.durability, 'durable');
    assert.equal(restored.coordination, 'best-effort');

    await restoredQueue.clear();
    assert.equal((await queue({ persistence }).restore()).entries.length, 0);
});

test('an existing queue can refresh scoped changes written by another context', async () => {
    const storage = memoryWebStorage();
    const persistence = createWebStoragePickupManifestQueuePersistence(storage);
    const firstQueue = queue({ persistence });
    const observingQueue = queue({ persistence });
    assert.equal((await observingQueue.restore()).entries.length, 0);

    await firstQueue.enqueue(scanCommand('cross-context-observed'));
    const observed = await observingQueue.refresh();

    assert.deepEqual(
        observed.entries.map((entry) => entry.command.operationId),
        ['cross-context-observed'],
    );
    assert.notEqual(
        pickupManifestQueueStorageKey(defaultScope),
        pickupManifestQueueStorageKey({
            userId: defaultScope.userId,
            runId: 'another-run',
        }),
    );
    assert.notEqual(
        pickupManifestQueueStorageKey(defaultScope),
        pickupManifestQueueStorageKey({
            userId: 'another-driver',
            runId: defaultScope.runId,
        }),
    );
});

test('shared coordination serializes cross-context writes and replay order', async () => {
    const persistence = createWebStoragePickupManifestQueuePersistence(
        memoryWebStorage(),
    );
    const coordinator = serialCoordinator();
    const replayCoordinator = serialCoordinator();
    const firstQueue = queue({
        persistence,
        coordinator,
        replayCoordinator,
    });
    const secondQueue = queue({
        persistence,
        coordinator,
        replayCoordinator,
    });

    await Promise.all([
        firstQueue.enqueue(scanCommand('cross-tab-first')),
        secondQueue.enqueue(
            scanCommand('cross-tab-second', { token: `${traceToken}-2` }),
        ),
    ]);

    const transported: string[] = [];
    const replayQueue = queue({
        persistence,
        coordinator,
        replayCoordinator,
        transport: async (command) => {
            transported.push(command.operationId);
            return { status: 'applied' };
        },
    });
    const restored = await replayQueue.restore();
    assert.deepEqual(
        restored.entries.map((entry) => entry.command.operationId),
        ['cross-tab-first', 'cross-tab-second'],
    );
    assert.deepEqual(
        restored.entries.map((entry) => entry.sequence),
        [0, 1],
    );
    assert.equal(restored.coordination, 'coordinated');
    await replayQueue.replay();
    assert.deepEqual(transported, ['cross-tab-first', 'cross-tab-second']);
});

test('web storage failures fall back to surfaced non-durable memory persistence', async () => {
    const unavailableStorage: PickupManifestWebStorage = {
        get length(): number {
            throw new Error('storage denied');
        },
        key() {
            throw new Error('storage denied');
        },
        getItem() {
            throw new Error('storage denied');
        },
        setItem() {
            throw new Error('storage denied');
        },
        removeItem() {
            throw new Error('storage denied');
        },
    };
    const persistence =
        createWebStoragePickupManifestQueuePersistence(unavailableStorage);
    const manifestQueue = queue({ persistence });

    assert.equal(manifestQueue.getServerSnapshot().durability, 'memory');
    assert.equal((await manifestQueue.restore()).durability, 'memory');
    await manifestQueue.enqueue(scanCommand('memory-fallback'));
    assert.equal((await manifestQueue.replay()).status, 'synced');
    assert.equal(manifestQueue.getSnapshot().durability, 'memory');
    assert.equal(manifestQueue.getSnapshot().coordination, 'best-effort');
    assert.equal(
        (await queue({ persistence }).restore()).entries[0]?.command
            .operationId,
        'memory-fallback',
    );
    await assert.rejects(
        manifestQueue.clear(),
        /Durable pickup cleanup could not be confirmed/,
    );
    assert.equal(manifestQueue.getSnapshot().entries.length, 1);
});
