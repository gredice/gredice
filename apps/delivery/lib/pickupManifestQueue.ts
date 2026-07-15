import { normalizeHarvestTraceScanValue } from './harvestTraceScan';

export type PickupManifestQueueScope = {
    userId: string;
    runId: string;
};

type PickupManifestCommandBase = {
    operationId: string;
    runId: string;
    pickupNodeId: string;
    occurredAt: string;
};

export type PickupManifestScanCommand = PickupManifestCommandBase & {
    kind: 'scan';
    tracePath: string;
};

export type PickupManifestManualOutcome =
    | 'ready'
    | 'missing-label'
    | 'not-ready';

export type PickupManifestManualOutcomeCommand = PickupManifestCommandBase & {
    kind: 'manual-outcome';
    manifestId: string;
    stopId: number;
    outcome: PickupManifestManualOutcome;
};

export type PickupManifestConfirmCommand = PickupManifestCommandBase & {
    kind: 'confirm';
    manifestId: string;
};

export type PickupManifestCommand =
    | PickupManifestScanCommand
    | PickupManifestManualOutcomeCommand
    | PickupManifestConfirmCommand;

export type PickupManifestCommandState =
    | 'queued'
    | 'sending'
    | 'synced'
    | 'failed'
    | 'conflicted';

export type PickupManifestAcknowledgement = 'applied' | 'exact-duplicate';

export type PickupManifestQueueEntry = {
    sequence: number;
    command: PickupManifestCommand;
    state: PickupManifestCommandState;
    attemptCount: number;
    updatedAt: string;
    acknowledgement?: PickupManifestAcknowledgement;
    errorCode?: string;
};

export type PickupManifestQueueStatus =
    | 'idle'
    | 'queued'
    | 'sending'
    | 'synced'
    | 'failed'
    | 'conflicted';

export type PickupManifestQueueDurability = 'durable' | 'memory';
export type PickupManifestQueueCoordination = 'coordinated' | 'best-effort';

export type PickupManifestQueueSnapshot = {
    scope: PickupManifestQueueScope;
    status: PickupManifestQueueStatus;
    durability: PickupManifestQueueDurability;
    coordination: PickupManifestQueueCoordination;
    entries: readonly PickupManifestQueueEntry[];
    queuedCount: number;
    sendingCount: number;
    syncedCount: number;
    failedCount: number;
    conflictedCount: number;
};

export type PickupManifestTransportResult =
    | { status: 'applied' }
    | { status: 'exact-duplicate' }
    | { status: 'retryable-failure'; code?: string }
    | { status: 'permanent-failure'; code?: string };

export type PickupManifestTransport = (
    command: PickupManifestCommand,
) => Promise<PickupManifestTransportResult>;

export type PickupManifestQueuePersistence = {
    readonly durability: PickupManifestQueueDurability;
    readonly durableCleanupRequired?: boolean;
    load: (scope: PickupManifestQueueScope) => Promise<unknown>;
    save: (
        scope: PickupManifestQueueScope,
        entries: readonly PickupManifestQueueEntry[],
    ) => Promise<void>;
    clear: (scope: { userId: string; runId?: string }) => Promise<void>;
    clearOtherRuns?: (scope: {
        userId: string;
        activeRunId: string;
    }) => Promise<void>;
};

export type PickupManifestQueueCoordinator = {
    runExclusive: <Result>(
        scope: PickupManifestQueueScope,
        task: () => Promise<Result>,
    ) => Promise<Result>;
};

export type PickupManifestWebStorage = {
    readonly length: number;
    key: (index: number) => string | null;
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
};

type QueueOptions = {
    scope: PickupManifestQueueScope;
    persistence: PickupManifestQueuePersistence;
    transport: PickupManifestTransport;
    coordinator?: PickupManifestQueueCoordinator;
    replayCoordinator?: PickupManifestQueueCoordinator;
    now?: () => Date;
};

type PickupManifestCommandInputBase = {
    operationId: string;
    runId: string;
    pickupNodeId: string;
    occurredAt?: string;
};

const persistenceVersion = 1;
const webStoragePrefix = 'gredice:delivery:pickup-manifest-queue:v1:';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function validIdentifier(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        value.trim() === value &&
        value.length > 0 &&
        value.length <= 256
    );
}

function validOccurredAt(value: unknown): value is string {
    return (
        typeof value === 'string' && Number.isFinite(new Date(value).getTime())
    );
}

function validStopId(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function validErrorCode(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        value.length > 0 &&
        value.length <= 128 &&
        /^[a-z0-9-]+$/.test(value)
    );
}

function isPickupManifestCommand(
    value: unknown,
): value is PickupManifestCommand {
    if (
        !isRecord(value) ||
        !validIdentifier(value.operationId) ||
        !validIdentifier(value.runId) ||
        !validIdentifier(value.pickupNodeId) ||
        !validOccurredAt(value.occurredAt)
    ) {
        return false;
    }

    switch (value.kind) {
        case 'scan': {
            if (typeof value.tracePath !== 'string') return false;
            return (
                normalizeHarvestTraceScanValue(value.tracePath) ===
                value.tracePath
            );
        }
        case 'manual-outcome':
            return (
                validIdentifier(value.manifestId) &&
                validStopId(value.stopId) &&
                (value.outcome === 'ready' ||
                    value.outcome === 'missing-label' ||
                    value.outcome === 'not-ready')
            );
        case 'confirm':
            return validIdentifier(value.manifestId);
        default:
            return false;
    }
}

function isCommandState(value: unknown): value is PickupManifestCommandState {
    return (
        value === 'queued' ||
        value === 'sending' ||
        value === 'synced' ||
        value === 'failed' ||
        value === 'conflicted'
    );
}

function isQueueEntry(value: unknown): value is PickupManifestQueueEntry {
    return (
        isRecord(value) &&
        typeof value.sequence === 'number' &&
        Number.isInteger(value.sequence) &&
        value.sequence >= 0 &&
        isPickupManifestCommand(value.command) &&
        isCommandState(value.state) &&
        typeof value.attemptCount === 'number' &&
        Number.isInteger(value.attemptCount) &&
        value.attemptCount >= 0 &&
        validOccurredAt(value.updatedAt) &&
        (value.acknowledgement === undefined ||
            value.acknowledgement === 'applied' ||
            value.acknowledgement === 'exact-duplicate') &&
        (value.errorCode === undefined || validErrorCode(value.errorCode))
    );
}

function restoredEntries(
    value: unknown,
    scope: PickupManifestQueueScope,
    recoverInterruptedSending: boolean,
) {
    if (!isRecord(value) || value.version !== persistenceVersion) return [];
    if (!Array.isArray(value.entries)) return [];

    const entriesByOperationId = new Map<string, PickupManifestQueueEntry>();
    for (const candidate of value.entries) {
        if (
            !isQueueEntry(candidate) ||
            candidate.command.runId !== scope.runId
        ) {
            continue;
        }
        const restored =
            recoverInterruptedSending && candidate.state === 'sending'
                ? { ...candidate, state: 'queued' as const }
                : candidate;
        const existing = entriesByOperationId.get(restored.command.operationId);
        if (!existing) {
            entriesByOperationId.set(restored.command.operationId, restored);
            continue;
        }
        if (
            commandFingerprint(existing.command) !==
            commandFingerprint(restored.command)
        ) {
            throw new PickupManifestOperationConflictError(
                restored.command.operationId,
            );
        }
    }

    return Array.from(entriesByOperationId.values()).sort(
        (first, second) => first.sequence - second.sequence,
    );
}

function commandFingerprint(command: PickupManifestCommand) {
    const common = [
        command.operationId,
        command.runId,
        command.pickupNodeId,
        command.kind,
        command.occurredAt,
    ];
    switch (command.kind) {
        case 'scan':
            return JSON.stringify([...common, command.tracePath]);
        case 'manual-outcome':
            return JSON.stringify([
                ...common,
                command.manifestId,
                command.stopId,
                command.outcome,
            ]);
        case 'confirm':
            return JSON.stringify([...common, command.manifestId]);
    }
}

function cloneEntry(entry: PickupManifestQueueEntry): PickupManifestQueueEntry {
    return { ...entry, command: { ...entry.command } };
}

function snapshotFor(
    scope: PickupManifestQueueScope,
    entries: readonly PickupManifestQueueEntry[],
    durability: PickupManifestQueueDurability,
    coordination: PickupManifestQueueCoordination,
): PickupManifestQueueSnapshot {
    const clonedEntries = entries.map(cloneEntry);
    const queuedCount = entries.filter(
        (entry) => entry.state === 'queued',
    ).length;
    const sendingCount = entries.filter(
        (entry) => entry.state === 'sending',
    ).length;
    const syncedCount = entries.filter(
        (entry) => entry.state === 'synced',
    ).length;
    const failedCount = entries.filter(
        (entry) => entry.state === 'failed',
    ).length;
    const conflictedCount = entries.filter(
        (entry) => entry.state === 'conflicted',
    ).length;
    const status: PickupManifestQueueStatus = sendingCount
        ? 'sending'
        : conflictedCount
          ? 'conflicted'
          : failedCount
            ? 'failed'
            : queuedCount
              ? 'queued'
              : entries.length
                ? 'synced'
                : 'idle';

    return {
        scope: { ...scope },
        status,
        durability,
        coordination,
        entries: clonedEntries,
        queuedCount,
        sendingCount,
        syncedCount,
        failedCount,
        conflictedCount,
    };
}

export function pickupManifestQueueStorageKey(scope: PickupManifestQueueScope) {
    return `${webStoragePrefix}${encodeURIComponent(scope.userId)}:${encodeURIComponent(scope.runId)}`;
}

function storageUserPrefix(userId: string) {
    return `${webStoragePrefix}${encodeURIComponent(userId)}:`;
}

function persistencePayload(entries: readonly PickupManifestQueueEntry[]) {
    return { version: persistenceVersion, entries };
}

function clonePersistedValue(value: unknown) {
    return value === undefined
        ? undefined
        : (JSON.parse(JSON.stringify(value)) as unknown);
}

function occurredAt(value: string | undefined, now: () => Date) {
    const resolved = value ?? now().toISOString();
    if (!validOccurredAt(resolved)) {
        throw new TypeError(
            'Pickup manifest command has an invalid occurredAt value',
        );
    }
    return resolved;
}

export class PickupManifestOperationConflictError extends Error {
    override name = 'PickupManifestOperationConflictError';

    constructor(readonly operationId: string) {
        super(
            `Pickup manifest operation ${operationId} has conflicting payloads`,
        );
    }
}

export function createPickupManifestScanCommand({
    operationId,
    runId,
    pickupNodeId,
    scanValue,
    occurredAt: occurredAtValue,
    now = () => new Date(),
}: PickupManifestCommandInputBase & {
    scanValue: string;
    now?: () => Date;
}): PickupManifestScanCommand {
    const tracePath = normalizeHarvestTraceScanValue(scanValue);
    if (!tracePath) {
        throw new TypeError(
            'Pickup manifest scan is not a valid harvest trace',
        );
    }
    const command: PickupManifestScanCommand = {
        operationId,
        runId,
        pickupNodeId,
        kind: 'scan',
        tracePath,
        occurredAt: occurredAt(occurredAtValue, now),
    };
    if (!isPickupManifestCommand(command)) {
        throw new TypeError('Pickup manifest scan command is invalid');
    }
    return command;
}

export function createPickupManifestManualOutcomeCommand({
    operationId,
    runId,
    pickupNodeId,
    manifestId,
    stopId,
    outcome,
    occurredAt: occurredAtValue,
    now = () => new Date(),
}: PickupManifestCommandInputBase & {
    manifestId: string;
    stopId: number;
    outcome: PickupManifestManualOutcome;
    now?: () => Date;
}): PickupManifestManualOutcomeCommand {
    const command: PickupManifestManualOutcomeCommand = {
        operationId,
        runId,
        pickupNodeId,
        kind: 'manual-outcome',
        manifestId,
        stopId,
        outcome,
        occurredAt: occurredAt(occurredAtValue, now),
    };
    if (!isPickupManifestCommand(command)) {
        throw new TypeError(
            'Pickup manifest manual outcome command is invalid',
        );
    }
    return command;
}

export function createPickupManifestConfirmCommand({
    operationId,
    runId,
    pickupNodeId,
    manifestId,
    occurredAt: occurredAtValue,
    now = () => new Date(),
}: PickupManifestCommandInputBase & {
    manifestId: string;
    now?: () => Date;
}): PickupManifestConfirmCommand {
    const command: PickupManifestConfirmCommand = {
        operationId,
        runId,
        pickupNodeId,
        kind: 'confirm',
        manifestId,
        occurredAt: occurredAt(occurredAtValue, now),
    };
    if (!isPickupManifestCommand(command)) {
        throw new TypeError('Pickup manifest confirm command is invalid');
    }
    return command;
}

export function createMemoryPickupManifestQueuePersistence(): PickupManifestQueuePersistence {
    const values = new Map<string, unknown>();
    return {
        durability: 'memory',
        durableCleanupRequired: false,
        async load(scope) {
            return clonePersistedValue(
                values.get(pickupManifestQueueStorageKey(scope)),
            );
        },
        async save(scope, entries) {
            values.set(
                pickupManifestQueueStorageKey(scope),
                clonePersistedValue(persistencePayload(entries)),
            );
        },
        async clear(scope) {
            if (scope.runId) {
                values.delete(
                    pickupManifestQueueStorageKey({
                        userId: scope.userId,
                        runId: scope.runId,
                    }),
                );
                return;
            }
            const prefix = storageUserPrefix(scope.userId);
            for (const key of values.keys()) {
                if (key.startsWith(prefix)) values.delete(key);
            }
        },
        async clearOtherRuns({ userId, activeRunId }) {
            const prefix = storageUserPrefix(userId);
            const activeKey = pickupManifestQueueStorageKey({
                userId,
                runId: activeRunId,
            });
            for (const key of values.keys()) {
                if (key.startsWith(prefix) && key !== activeKey) {
                    values.delete(key);
                }
            }
        },
    };
}

export function createWebStoragePickupManifestQueuePersistence(
    storage: PickupManifestWebStorage,
): PickupManifestQueuePersistence {
    const fallbackValues = new Map<string, string>();
    let durable = true;

    function parsedValue(value: string | null) {
        if (!value) return undefined;
        try {
            return JSON.parse(value) as unknown;
        } catch {
            return undefined;
        }
    }

    return {
        get durability() {
            return durable ? 'durable' : 'memory';
        },
        durableCleanupRequired: true,
        async load(scope) {
            const key = pickupManifestQueueStorageKey(scope);
            if (durable) {
                try {
                    const value = storage.getItem(key);
                    if (value === null) fallbackValues.delete(key);
                    else fallbackValues.set(key, value);
                    return parsedValue(value);
                } catch {
                    durable = false;
                }
            }
            return parsedValue(fallbackValues.get(key) ?? null);
        },
        async save(scope, entries) {
            const key = pickupManifestQueueStorageKey(scope);
            const value = JSON.stringify(persistencePayload(entries));
            fallbackValues.set(key, value);
            if (!durable) return;
            try {
                storage.setItem(key, value);
            } catch {
                durable = false;
            }
        },
        async clear(scope) {
            if (scope.runId) {
                const key = pickupManifestQueueStorageKey({
                    userId: scope.userId,
                    runId: scope.runId,
                });
                try {
                    storage.removeItem(key);
                    fallbackValues.delete(key);
                    durable = true;
                } catch {
                    durable = false;
                    throw new Error(
                        'Durable pickup cleanup could not be confirmed',
                    );
                }
                return;
            }
            const prefix = storageUserPrefix(scope.userId);
            try {
                const keys = Array.from(
                    { length: storage.length },
                    (_, index) => storage.key(index),
                );
                for (const key of keys) {
                    if (key?.startsWith(prefix)) storage.removeItem(key);
                }
                for (const key of fallbackValues.keys()) {
                    if (key.startsWith(prefix)) fallbackValues.delete(key);
                }
                durable = true;
            } catch {
                durable = false;
                throw new Error(
                    'Durable pickup cleanup could not be confirmed',
                );
            }
        },
        async clearOtherRuns({ userId, activeRunId }) {
            const prefix = storageUserPrefix(userId);
            const activeKey = pickupManifestQueueStorageKey({
                userId,
                runId: activeRunId,
            });
            try {
                const keys = Array.from(
                    { length: storage.length },
                    (_, index) => storage.key(index),
                );
                for (const key of keys) {
                    if (key?.startsWith(prefix) && key !== activeKey) {
                        storage.removeItem(key);
                    }
                }
                for (const key of fallbackValues.keys()) {
                    if (key.startsWith(prefix) && key !== activeKey) {
                        fallbackValues.delete(key);
                    }
                }
                durable = true;
            } catch {
                durable = false;
                throw new Error(
                    'Durable pickup cleanup could not be confirmed',
                );
            }
        },
    };
}

export async function clearPickupManifestQueueScope(
    persistence: PickupManifestQueuePersistence,
    scope: { userId: string; runId?: string },
) {
    await persistence.clear(scope);
}

export async function clearOtherPickupManifestQueueScopes(
    persistence: PickupManifestQueuePersistence,
    scope: { userId: string; activeRunId: string },
) {
    await persistence.clearOtherRuns?.(scope);
}

export class PickupManifestQueue {
    private entries: PickupManifestQueueEntry[] = [];
    private snapshot: PickupManifestQueueSnapshot;
    private readonly serverSnapshot: PickupManifestQueueSnapshot;
    private readonly listeners = new Set<() => void>();
    private operationChain: Promise<void> = Promise.resolve();
    private replayPromise: Promise<PickupManifestQueueSnapshot> | null = null;
    private nextSequence = 0;
    private generation = 0;
    private readonly now: () => Date;

    constructor(private readonly options: QueueOptions) {
        if (
            !validIdentifier(options.scope.userId) ||
            !validIdentifier(options.scope.runId)
        ) {
            throw new TypeError('Pickup manifest queue scope is invalid');
        }
        this.now = options.now ?? (() => new Date());
        const coordination =
            options.coordinator && options.replayCoordinator
                ? 'coordinated'
                : 'best-effort';
        this.serverSnapshot = snapshotFor(
            options.scope,
            [],
            'memory',
            'best-effort',
        );
        this.snapshot = snapshotFor(
            options.scope,
            [],
            options.persistence.durability,
            coordination,
        );
    }

    getSnapshot = () => this.snapshot;
    getServerSnapshot = () => this.serverSnapshot;

    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    async restore() {
        return await this.runExclusive(async () => {
            await this.synchronizeFromPersistence(true);
            return this.snapshot;
        });
    }

    async refresh() {
        return await this.runExclusive(async () => {
            await this.synchronizeFromPersistence(false);
            return this.snapshot;
        });
    }

    async enqueue(command: PickupManifestCommand) {
        if (
            !isPickupManifestCommand(command) ||
            command.runId !== this.options.scope.runId
        ) {
            throw new TypeError(
                'Pickup manifest command does not match its queue',
            );
        }

        return await this.runExclusive(async () => {
            await this.synchronizeFromPersistence(false);
            const existing = this.entries.find(
                (entry) => entry.command.operationId === command.operationId,
            );
            if (existing) {
                if (
                    commandFingerprint(existing.command) !==
                    commandFingerprint(command)
                ) {
                    throw new PickupManifestOperationConflictError(
                        command.operationId,
                    );
                }
                return cloneEntry(existing);
            }

            const entry: PickupManifestQueueEntry = {
                sequence: this.nextSequence,
                command: { ...command },
                state: 'queued',
                attemptCount: 0,
                updatedAt: this.now().toISOString(),
            };
            this.nextSequence += 1;
            this.entries.push(entry);
            this.publish();
            await this.persist();
            return cloneEntry(entry);
        });
    }

    async replay(): Promise<PickupManifestQueueSnapshot> {
        if (this.replayPromise) {
            await this.replayPromise;
            const current = this.getSnapshot();
            if (
                current.queuedCount > 0 &&
                current.failedCount === 0 &&
                current.conflictedCount === 0
            ) {
                return await this.replay();
            }
            return current;
        }

        const replayTask = () => this.replayEntries(this.generation);
        this.replayPromise = (
            this.options.replayCoordinator
                ? this.options.replayCoordinator.runExclusive(
                      this.options.scope,
                      replayTask,
                  )
                : replayTask()
        ).finally(() => {
            this.replayPromise = null;
        });
        return await this.replayPromise;
    }

    async retryEntry(operationId: string) {
        return await this.runExclusive(async () => {
            await this.synchronizeFromPersistence(false);
            const entry = this.entries.find(
                (candidate) => candidate.command.operationId === operationId,
            );
            if (entry?.state !== 'failed') {
                return false;
            }
            entry.state = 'queued';
            entry.updatedAt = this.now().toISOString();
            delete entry.acknowledgement;
            delete entry.errorCode;
            this.publish();
            await this.persist();
            return true;
        });
    }

    async discardEntry(operationId: string) {
        return await this.runExclusive(async () => {
            await this.synchronizeFromPersistence(false);
            const nextEntries = this.entries.filter(
                (entry) => entry.command.operationId !== operationId,
            );
            if (nextEntries.length === this.entries.length) return false;
            this.entries = nextEntries;
            this.publish();
            await this.persist();
            return true;
        });
    }

    async discard(operationId: string) {
        return await this.discardEntry(operationId);
    }

    async reconcileEntry(
        operationId: string,
        acknowledgement: PickupManifestAcknowledgement = 'applied',
    ) {
        return await this.runExclusive(async () => {
            await this.synchronizeFromPersistence(false);
            const entry = this.entries.find(
                (candidate) => candidate.command.operationId === operationId,
            );
            if (!entry || entry.state === 'synced') return false;
            entry.state = 'synced';
            entry.acknowledgement = acknowledgement;
            entry.updatedAt = this.now().toISOString();
            delete entry.errorCode;
            this.publish();
            await this.persist();
            return true;
        });
    }

    async clear() {
        await this.runExclusive(async () => {
            await this.synchronizeFromPersistence(false);
            const requiredDurability =
                this.options.persistence.durableCleanupRequired ??
                this.options.persistence.durability === 'durable';
            try {
                await this.options.persistence.clear(this.options.scope);
            } catch (error) {
                this.publish();
                throw error;
            }
            if (
                requiredDurability &&
                this.options.persistence.durability !== 'durable'
            ) {
                this.publish();
                throw new Error(
                    'Durable pickup cleanup could not be confirmed',
                );
            }
            this.generation += 1;
            this.entries = [];
            this.nextSequence = 0;
            this.publish();
        });
    }

    private runExclusive<Result>(task: () => Promise<Result>) {
        const coordinatedTask = () =>
            this.options.coordinator
                ? this.options.coordinator.runExclusive(
                      this.options.scope,
                      task,
                  )
                : task();
        const result = this.operationChain.then(
            coordinatedTask,
            coordinatedTask,
        );
        this.operationChain = result.then(
            () => undefined,
            () => undefined,
        );
        return result;
    }

    private async synchronizeFromPersistence(
        recoverInterruptedSending: boolean,
    ) {
        const value = await this.options.persistence.load(this.options.scope);
        this.entries = restoredEntries(
            value,
            this.options.scope,
            recoverInterruptedSending,
        );
        this.nextSequence =
            Math.max(-1, ...this.entries.map((entry) => entry.sequence)) + 1;
        this.publish();
    }

    private async replayEntries(replayGeneration: number) {
        while (replayGeneration === this.generation) {
            const command = await this.runExclusive(async () => {
                if (replayGeneration !== this.generation) return null;
                await this.synchronizeFromPersistence(false);
                const entry = this.entries.find(
                    (candidate) => candidate.state !== 'synced',
                );
                if (!entry || entry.state === 'conflicted') return null;

                entry.state = 'sending';
                entry.attemptCount += 1;
                entry.updatedAt = this.now().toISOString();
                delete entry.acknowledgement;
                delete entry.errorCode;
                this.publish();
                await this.persist();
                return { ...entry.command };
            });
            if (!command) break;

            let result: PickupManifestTransportResult;
            try {
                result = await this.options.transport(command);
            } catch {
                result = {
                    status: 'retryable-failure',
                    code: 'transport-error',
                };
            }
            if (replayGeneration !== this.generation) break;

            const shouldStop = await this.runExclusive(async () => {
                if (replayGeneration !== this.generation) return true;
                await this.synchronizeFromPersistence(false);
                const entry = this.entries.find(
                    (candidate) =>
                        candidate.command.operationId === command.operationId,
                );
                if (!entry) return false;
                if (entry.state === 'synced') return false;
                if (entry.state === 'conflicted') return true;

                entry.updatedAt = this.now().toISOString();
                switch (result.status) {
                    case 'applied':
                        entry.state = 'synced';
                        entry.acknowledgement = 'applied';
                        break;
                    case 'exact-duplicate':
                        entry.state = 'synced';
                        entry.acknowledgement = 'exact-duplicate';
                        break;
                    case 'permanent-failure':
                        entry.state = 'conflicted';
                        entry.errorCode = validErrorCode(result.code)
                            ? result.code
                            : 'pickup-manifest-conflict';
                        break;
                    case 'retryable-failure':
                        entry.state = 'failed';
                        entry.errorCode = validErrorCode(result.code)
                            ? result.code
                            : 'pickup-manifest-sync-failed';
                        break;
                }
                this.publish();
                await this.persist();
                return entry.state === 'failed' || entry.state === 'conflicted';
            });
            if (shouldStop) break;
        }
        return this.snapshot;
    }

    private publish() {
        this.snapshot = snapshotFor(
            this.options.scope,
            this.entries,
            this.options.persistence.durability,
            this.options.persistence.durability === 'durable' &&
                this.options.coordinator &&
                this.options.replayCoordinator
                ? 'coordinated'
                : 'best-effort',
        );
        for (const listener of this.listeners) listener();
    }

    private async persist() {
        await this.options.persistence.save(
            this.options.scope,
            this.entries.map(cloneEntry),
        );
        this.publish();
    }
}
