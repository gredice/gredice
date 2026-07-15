import type {
    DeliveryPickupStepSummary,
    DeliveryRouteStepSummary,
    DeliveryStopSummary,
    DriverDeliveryDashboard,
} from './deliveryDashboardTypes';

export const offlineRouteCacheVersion = 1;
export const offlineRouteCacheTtlMs = 24 * 60 * 60 * 1_000;

type OfflineRouteActionState = 'locked' | 'upcoming' | 'current';

function projectActionState(
    actionState: DeliveryRouteStepSummary['actionState'],
): OfflineRouteActionState {
    if (actionState === 'completed') {
        throw new TypeError('Completed route steps cannot be cached');
    }
    return actionState;
}

export type OfflineRouteHarvest = {
    plantName: string;
    raisedBedName: string | null;
    fieldName: string | null;
    tracePath: string | null;
};

export type OfflineRoutePickupItem = {
    manifestId: string;
    stopId: number;
    requestId: string;
    state: 'ready' | 'scanned' | 'missing-label' | 'not-ready';
    harvest: OfflineRouteHarvest;
};

export type OfflineRouteDeliveryItem = {
    stopId: number;
    requestId: string;
    stopState: string | null;
    requestState: string;
    contactName: string;
    phone: string | null;
    requestNotes: string | null;
    harvest: OfflineRouteHarvest;
    exception: {
        outcome: string;
        reason: string;
        occurredAt: string;
    } | null;
};

type OfflineRouteStepBase = {
    itinerarySequence: number;
    actionState: OfflineRouteActionState;
    address: string;
    estimatedArrivalAt: string | null;
    estimatedTravelSeconds: number | null;
    estimatedDistanceMeters: number | null;
};

export type OfflineRoutePickupStep = OfflineRouteStepBase & {
    kind: 'pickup';
    id: string;
    name: string;
    state: 'pending' | 'partial' | 'confirmed';
    expectedCount: number;
    scannedCount: number;
    missingLabelCount: number;
    notReadyCount: number;
    remainingCount: number;
    items: OfflineRoutePickupItem[];
};

export type OfflineRouteDeliveryStep = OfflineRouteStepBase & {
    kind: 'delivery';
    id: number | null;
    stopState: string | null;
    statusLabel: string;
    slotStartAt: string | null;
    slotEndAt: string | null;
    arrivedAt: string | null;
    deliveredAt: string | null;
    retryLaneRank: number | null;
    retryAttempt: number;
    lockedReason: string | null;
    items: OfflineRouteDeliveryItem[];
};

export type OfflineRouteStep =
    | OfflineRoutePickupStep
    | OfflineRouteDeliveryStep;

export type OfflineRouteSnapshot = {
    version: typeof offlineRouteCacheVersion;
    scope: {
        userId: string;
        runId: string;
    };
    source: {
        routeRevision: number;
        refreshedAt: string;
        reroutePending: boolean;
    };
    cachedAt: string;
    expiresAt: string;
    steps: OfflineRouteStep[];
};

export type OfflineRouteCacheDurability = 'durable' | 'memory';

export type OfflineRouteCachePersistence = {
    readonly durability: OfflineRouteCacheDurability;
    readonly durableCleanupRequired?: boolean;
    load: (scope: {
        userId: string;
        runId?: string;
        now?: Date;
    }) => Promise<OfflineRouteSnapshot | null>;
    save: (snapshot: OfflineRouteSnapshot) => Promise<void>;
    clear: (scope: { userId: string; runId?: string }) => Promise<void>;
    clearUser: (userId: string) => Promise<void>;
};

function projectHarvest({
    plantName,
    raisedBedName,
    fieldName,
    tracePath,
}: {
    plantName: string;
    raisedBedName: string | null;
    fieldName: string | null;
    tracePath: string | null;
}): OfflineRouteHarvest {
    return { plantName, raisedBedName, fieldName, tracePath };
}

function projectPickupStep(
    step: Extract<DeliveryRouteStepSummary, { kind: 'pickup' }>,
): OfflineRoutePickupStep {
    const pickup: DeliveryPickupStepSummary = step.pickup;
    return {
        kind: 'pickup',
        id: pickup.id,
        itinerarySequence: step.itinerarySequence,
        actionState: projectActionState(step.actionState),
        name: pickup.name,
        address: pickup.address,
        estimatedArrivalAt: pickup.estimatedArrivalAt,
        estimatedTravelSeconds: pickup.estimatedTravelSeconds,
        estimatedDistanceMeters: pickup.estimatedDistanceMeters,
        state: pickup.state,
        expectedCount: pickup.expectedCount,
        scannedCount: pickup.scannedCount,
        missingLabelCount: pickup.missingLabelCount,
        notReadyCount: pickup.notReadyCount,
        remainingCount: pickup.remainingCount,
        items: pickup.manifests.flatMap((manifest) =>
            manifest.items.map((item) => ({
                manifestId: manifest.id,
                stopId: item.stopId,
                requestId: item.requestId,
                state: item.state,
                harvest: projectHarvest(item.harvest),
            })),
        ),
    };
}

function projectDeliveryStep(
    step: Extract<DeliveryRouteStepSummary, { kind: 'delivery' }>,
): OfflineRouteDeliveryStep {
    const stop: DeliveryStopSummary = step.stop;
    return {
        kind: 'delivery',
        id: stop.id,
        itinerarySequence: step.itinerarySequence,
        actionState: projectActionState(step.actionState),
        address: stop.address,
        estimatedArrivalAt: stop.estimatedArrivalAt,
        estimatedTravelSeconds: stop.estimatedTravelSeconds,
        estimatedDistanceMeters: stop.estimatedDistanceMeters,
        stopState: stop.stopState,
        statusLabel: stop.statusLabel,
        slotStartAt: stop.slotStartAt,
        slotEndAt: stop.slotEndAt,
        arrivedAt: stop.arrivedAt,
        deliveredAt: stop.deliveredAt,
        retryLaneRank: step.retryLaneRank,
        retryAttempt: step.retryAttempt,
        lockedReason: step.lockedReason,
        items: stop.deliveries.flatMap((delivery) =>
            delivery.stopId === null
                ? []
                : [
                      {
                          stopId: delivery.stopId,
                          requestId: delivery.requestId,
                          stopState: delivery.stopState,
                          requestState: delivery.requestState,
                          contactName: delivery.contactName,
                          phone: delivery.phone,
                          requestNotes: delivery.requestNotes,
                          harvest: projectHarvest(delivery.harvest),
                          exception: delivery.exception
                              ? {
                                    outcome: delivery.exception.outcome,
                                    reason: delivery.exception.reason,
                                    occurredAt: delivery.exception.occurredAt,
                                }
                              : null,
                      },
                  ],
        ),
    };
}

function projectRouteStep(step: DeliveryRouteStepSummary): OfflineRouteStep {
    return step.kind === 'pickup'
        ? projectPickupStep(step)
        : projectDeliveryStep(step);
}

export function createOfflineRouteSnapshot({
    authenticatedUserId,
    dashboard,
    now = new Date(),
}: {
    authenticatedUserId: string;
    dashboard: DriverDeliveryDashboard;
    now?: Date;
}): OfflineRouteSnapshot | null {
    const run = dashboard.activeRun;
    if (
        !validIdentifier(authenticatedUserId) ||
        dashboard.user.id !== authenticatedUserId ||
        !run ||
        !Number.isFinite(now.getTime())
    ) {
        return null;
    }
    const currentIndex = run.routeSteps.findIndex(
        (step) => step.actionState === 'current',
    );
    if (currentIndex < 0) return null;
    const current = run.routeSteps[currentIndex];
    if (!current) return null;
    const next = run.routeSteps
        .slice(currentIndex + 1)
        .find((step) => step.actionState !== 'completed');
    const cachedAt = now.toISOString();
    return {
        version: offlineRouteCacheVersion,
        scope: { userId: authenticatedUserId, runId: run.id },
        source: {
            routeRevision: run.routeRevision,
            refreshedAt: dashboard.refreshedAt,
            reroutePending: run.reroutePending,
        },
        cachedAt,
        expiresAt: new Date(
            now.getTime() + offlineRouteCacheTtlMs,
        ).toISOString(),
        steps: [current, ...(next ? [next] : [])].map(projectRouteStep),
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function hasOnlyKeys(
    value: Record<string, unknown>,
    allowedKeys: readonly string[],
) {
    const allowed = new Set(allowedKeys);
    return Object.keys(value).every((key) => allowed.has(key));
}

function validIdentifier(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        value.trim() === value &&
        value.length > 0 &&
        value.length <= 256
    );
}

function validString(value: unknown): value is string {
    return typeof value === 'string' && value.length <= 2_000;
}

function nullableString(value: unknown): value is string | null {
    return value === null || validString(value);
}

function validDateString(value: unknown): value is string {
    return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function nullableDateString(value: unknown): value is string | null {
    return value === null || validDateString(value);
}

function validNonNegativeInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function nullableNonNegativeNumber(value: unknown): value is number | null {
    return (
        value === null ||
        (typeof value === 'number' && Number.isFinite(value) && value >= 0)
    );
}

function parseHarvest(value: unknown): OfflineRouteHarvest | null {
    if (
        !isRecord(value) ||
        !hasOnlyKeys(value, [
            'plantName',
            'raisedBedName',
            'fieldName',
            'tracePath',
        ]) ||
        !validString(value.plantName) ||
        !nullableString(value.raisedBedName) ||
        !nullableString(value.fieldName) ||
        !nullableString(value.tracePath)
    ) {
        return null;
    }
    return {
        plantName: value.plantName,
        raisedBedName: value.raisedBedName,
        fieldName: value.fieldName,
        tracePath: value.tracePath,
    };
}

function parseActionState(value: unknown): OfflineRouteActionState | null {
    return value === 'locked' || value === 'upcoming' || value === 'current'
        ? value
        : null;
}

function parseCommonStep(value: Record<string, unknown>) {
    const actionState = parseActionState(value.actionState);
    if (
        !validNonNegativeInteger(value.itinerarySequence) ||
        !actionState ||
        !validString(value.address) ||
        !nullableDateString(value.estimatedArrivalAt) ||
        !nullableNonNegativeNumber(value.estimatedTravelSeconds) ||
        !nullableNonNegativeNumber(value.estimatedDistanceMeters)
    ) {
        return null;
    }
    return {
        itinerarySequence: value.itinerarySequence,
        actionState,
        address: value.address,
        estimatedArrivalAt: value.estimatedArrivalAt,
        estimatedTravelSeconds: value.estimatedTravelSeconds,
        estimatedDistanceMeters: value.estimatedDistanceMeters,
    };
}

function parsePickupItem(value: unknown): OfflineRoutePickupItem | null {
    if (
        !isRecord(value) ||
        !hasOnlyKeys(value, [
            'manifestId',
            'stopId',
            'requestId',
            'state',
            'harvest',
        ]) ||
        !validIdentifier(value.manifestId) ||
        !validNonNegativeInteger(value.stopId) ||
        value.stopId === 0 ||
        !validIdentifier(value.requestId) ||
        !(
            value.state === 'ready' ||
            value.state === 'scanned' ||
            value.state === 'missing-label' ||
            value.state === 'not-ready'
        )
    ) {
        return null;
    }
    const harvest = parseHarvest(value.harvest);
    return harvest
        ? {
              manifestId: value.manifestId,
              stopId: value.stopId,
              requestId: value.requestId,
              state: value.state,
              harvest,
          }
        : null;
}

function parsePickupState(
    value: unknown,
): OfflineRoutePickupStep['state'] | null {
    return value === 'pending' || value === 'partial' || value === 'confirmed'
        ? value
        : null;
}

function parseDeliveryItem(value: unknown): OfflineRouteDeliveryItem | null {
    if (
        !isRecord(value) ||
        !hasOnlyKeys(value, [
            'stopId',
            'requestId',
            'stopState',
            'requestState',
            'contactName',
            'phone',
            'requestNotes',
            'harvest',
            'exception',
        ]) ||
        !validNonNegativeInteger(value.stopId) ||
        value.stopId === 0 ||
        !validIdentifier(value.requestId) ||
        !nullableString(value.stopState) ||
        !validString(value.requestState) ||
        !validString(value.contactName) ||
        !nullableString(value.phone) ||
        !nullableString(value.requestNotes)
    ) {
        return null;
    }
    const harvest = parseHarvest(value.harvest);
    if (!harvest) return null;
    let exception: OfflineRouteDeliveryItem['exception'] = null;
    if (value.exception !== null) {
        if (
            !isRecord(value.exception) ||
            !hasOnlyKeys(value.exception, [
                'outcome',
                'reason',
                'occurredAt',
            ]) ||
            !validString(value.exception.outcome) ||
            !validString(value.exception.reason) ||
            !validDateString(value.exception.occurredAt)
        ) {
            return null;
        }
        exception = {
            outcome: value.exception.outcome,
            reason: value.exception.reason,
            occurredAt: value.exception.occurredAt,
        };
    }
    return {
        stopId: value.stopId,
        requestId: value.requestId,
        stopState: value.stopState,
        requestState: value.requestState,
        contactName: value.contactName,
        phone: value.phone,
        requestNotes: value.requestNotes,
        harvest,
        exception,
    };
}

function parsePickupStep(value: Record<string, unknown>) {
    const common = parseCommonStep(value);
    const state = parsePickupState(value.state);
    if (
        !hasOnlyKeys(value, [
            'kind',
            'id',
            'itinerarySequence',
            'actionState',
            'name',
            'address',
            'estimatedArrivalAt',
            'estimatedTravelSeconds',
            'estimatedDistanceMeters',
            'state',
            'expectedCount',
            'scannedCount',
            'missingLabelCount',
            'notReadyCount',
            'remainingCount',
            'items',
        ]) ||
        !common ||
        !validIdentifier(value.id) ||
        !validString(value.name) ||
        !state ||
        !validNonNegativeInteger(value.expectedCount) ||
        !validNonNegativeInteger(value.scannedCount) ||
        !validNonNegativeInteger(value.missingLabelCount) ||
        !validNonNegativeInteger(value.notReadyCount) ||
        !validNonNegativeInteger(value.remainingCount) ||
        !Array.isArray(value.items)
    ) {
        return null;
    }
    const items = value.items.map(parsePickupItem);
    if (items.some((item) => item === null)) return null;
    return {
        kind: 'pickup' as const,
        ...common,
        id: value.id,
        name: value.name,
        state,
        expectedCount: value.expectedCount,
        scannedCount: value.scannedCount,
        missingLabelCount: value.missingLabelCount,
        notReadyCount: value.notReadyCount,
        remainingCount: value.remainingCount,
        items: items.flatMap((item) => (item ? [item] : [])),
    };
}

function parseDeliveryStep(value: Record<string, unknown>) {
    const common = parseCommonStep(value);
    if (
        !hasOnlyKeys(value, [
            'kind',
            'id',
            'itinerarySequence',
            'actionState',
            'address',
            'estimatedArrivalAt',
            'estimatedTravelSeconds',
            'estimatedDistanceMeters',
            'stopState',
            'statusLabel',
            'slotStartAt',
            'slotEndAt',
            'arrivedAt',
            'deliveredAt',
            'retryLaneRank',
            'retryAttempt',
            'lockedReason',
            'items',
        ]) ||
        !common ||
        !(
            value.id === null ||
            (validNonNegativeInteger(value.id) && value.id > 0)
        ) ||
        !nullableString(value.stopState) ||
        !validString(value.statusLabel) ||
        !nullableDateString(value.slotStartAt) ||
        !nullableDateString(value.slotEndAt) ||
        !nullableDateString(value.arrivedAt) ||
        !nullableDateString(value.deliveredAt) ||
        !(
            value.retryLaneRank === null ||
            (validNonNegativeInteger(value.retryLaneRank) &&
                value.retryLaneRank > 0)
        ) ||
        !validNonNegativeInteger(value.retryAttempt) ||
        !nullableString(value.lockedReason) ||
        !Array.isArray(value.items)
    ) {
        return null;
    }
    const items = value.items.map(parseDeliveryItem);
    if (items.some((item) => item === null)) return null;
    return {
        kind: 'delivery' as const,
        ...common,
        id: value.id,
        stopState: value.stopState,
        statusLabel: value.statusLabel,
        slotStartAt: value.slotStartAt,
        slotEndAt: value.slotEndAt,
        arrivedAt: value.arrivedAt,
        deliveredAt: value.deliveredAt,
        retryLaneRank: value.retryLaneRank,
        retryAttempt: value.retryAttempt,
        lockedReason: value.lockedReason,
        items: items.flatMap((item) => (item ? [item] : [])),
    };
}

function parseStep(value: unknown): OfflineRouteStep | null {
    if (!isRecord(value)) return null;
    if (value.kind === 'pickup') return parsePickupStep(value);
    if (value.kind === 'delivery') return parseDeliveryStep(value);
    return null;
}

export function parseOfflineRouteSnapshot(
    value: unknown,
    {
        userId,
        runId,
        now = new Date(),
    }: {
        userId: string;
        runId?: string;
        now?: Date;
    },
): OfflineRouteSnapshot | null {
    const cachedAt =
        isRecord(value) && validDateString(value.cachedAt)
            ? Date.parse(value.cachedAt)
            : Number.NaN;
    const expiresAt =
        isRecord(value) && validDateString(value.expiresAt)
            ? Date.parse(value.expiresAt)
            : Number.NaN;
    if (
        !isRecord(value) ||
        !hasOnlyKeys(value, [
            'version',
            'scope',
            'source',
            'cachedAt',
            'expiresAt',
            'steps',
        ]) ||
        value.version !== offlineRouteCacheVersion ||
        !isRecord(value.scope) ||
        !hasOnlyKeys(value.scope, ['userId', 'runId']) ||
        value.scope.userId !== userId ||
        !validIdentifier(value.scope.runId) ||
        (runId !== undefined && value.scope.runId !== runId) ||
        !isRecord(value.source) ||
        !hasOnlyKeys(value.source, [
            'routeRevision',
            'refreshedAt',
            'reroutePending',
        ]) ||
        !validNonNegativeInteger(value.source.routeRevision) ||
        !validDateString(value.source.refreshedAt) ||
        typeof value.source.reroutePending !== 'boolean' ||
        !validDateString(value.cachedAt) ||
        !validDateString(value.expiresAt) ||
        !Array.isArray(value.steps) ||
        value.steps.length < 1 ||
        value.steps.length > 2 ||
        !Number.isFinite(now.getTime()) ||
        expiresAt <= now.getTime() ||
        expiresAt <= cachedAt ||
        expiresAt - cachedAt > offlineRouteCacheTtlMs
    ) {
        return null;
    }
    const steps = value.steps.map(parseStep);
    if (
        steps.some((step) => step === null) ||
        steps[0]?.actionState !== 'current' ||
        steps.slice(1).some((step) => step?.actionState === 'current')
    ) {
        return null;
    }
    return {
        version: offlineRouteCacheVersion,
        scope: { userId, runId: value.scope.runId },
        source: {
            routeRevision: value.source.routeRevision,
            refreshedAt: value.source.refreshedAt,
            reroutePending: value.source.reroutePending,
        },
        cachedAt: value.cachedAt,
        expiresAt: value.expiresAt,
        steps: steps.flatMap((step) => (step ? [step] : [])),
    };
}

function cloneSnapshot(value: OfflineRouteSnapshot) {
    const serialized: unknown = JSON.parse(JSON.stringify(value));
    const clone = parseOfflineRouteSnapshot(serialized, {
        userId: value.scope.userId,
        runId: value.scope.runId,
        now: new Date(value.cachedAt),
    });
    if (!clone) throw new TypeError('Offline route snapshot is invalid');
    return clone;
}

function rawScopeMatches(
    value: unknown,
    { userId, runId }: { userId: string; runId?: string },
) {
    return (
        isRecord(value) &&
        isRecord(value.scope) &&
        value.scope.userId === userId &&
        (runId === undefined || value.scope.runId === runId)
    );
}

export function createMemoryOfflineRouteCachePersistence(
    snapshots: Map<string, unknown> = new Map(),
): OfflineRouteCachePersistence {
    return {
        durability: 'memory',
        durableCleanupRequired: false,
        async load({ userId, runId, now }) {
            const stored = snapshots.get(userId);
            if (stored === undefined) return null;
            const parsed = parseOfflineRouteSnapshot(stored, {
                userId,
                now,
            });
            if (!parsed) {
                snapshots.delete(userId);
                return null;
            }
            if (runId !== undefined && parsed.scope.runId !== runId) {
                return null;
            }
            return parsed ? cloneSnapshot(parsed) : null;
        },
        async save(snapshot) {
            const parsed = parseOfflineRouteSnapshot(snapshot, {
                userId: snapshot.scope.userId,
                runId: snapshot.scope.runId,
                now: new Date(snapshot.cachedAt),
            });
            if (!parsed)
                throw new TypeError('Offline route snapshot is invalid');
            snapshots.set(snapshot.scope.userId, cloneSnapshot(parsed));
        },
        async clear({ userId, runId }) {
            if (
                runId === undefined ||
                rawScopeMatches(snapshots.get(userId), { userId, runId })
            ) {
                snapshots.delete(userId);
            }
        },
        async clearUser(userId) {
            snapshots.delete(userId);
        },
    };
}

function requestResult<Result>(request: IDBRequest<Result>) {
    return new Promise<Result>((resolve, reject) => {
        request.addEventListener('success', () => resolve(request.result), {
            once: true,
        });
        request.addEventListener('error', () => reject(request.error), {
            once: true,
        });
    });
}

function transactionCompleted(transaction: IDBTransaction) {
    const completed = new Promise<void>((resolve, reject) => {
        transaction.addEventListener('complete', () => resolve(), {
            once: true,
        });
        transaction.addEventListener('abort', () => reject(transaction.error), {
            once: true,
        });
        transaction.addEventListener('error', () => reject(transaction.error), {
            once: true,
        });
    });
    // Request failures often abort the transaction before the request promise
    // reaches its caller. Attach a handler immediately, while still returning
    // the rejecting promise for the normal awaited control flow.
    void completed.catch(() => undefined);
    return completed;
}

const offlineRouteDatabaseName = 'gredice-delivery-offline-route-v1';
const offlineRouteStoreName = 'active-routes';

type OfflineRouteIndexedDbFactory = Pick<IDBFactory, 'open'>;

function openOfflineRouteDatabase(factory: OfflineRouteIndexedDbFactory) {
    return new Promise<IDBDatabase>((resolve, reject) => {
        const request = factory.open(offlineRouteDatabaseName, 1);
        request.addEventListener(
            'upgradeneeded',
            () => {
                const database = request.result;
                if (
                    !database.objectStoreNames.contains(offlineRouteStoreName)
                ) {
                    database.createObjectStore(offlineRouteStoreName);
                }
            },
            { once: true },
        );
        request.addEventListener(
            'success',
            () => {
                request.result.addEventListener(
                    'versionchange',
                    () => request.result.close(),
                    { once: true },
                );
                resolve(request.result);
            },
            { once: true },
        );
        request.addEventListener('error', () => reject(request.error), {
            once: true,
        });
        request.addEventListener(
            'blocked',
            () =>
                reject(new Error('Offline route database upgrade is blocked')),
            { once: true },
        );
    });
}

export function createIndexedDbOfflineRouteCachePersistence(
    factory: OfflineRouteIndexedDbFactory,
): OfflineRouteCachePersistence {
    const memory = createMemoryOfflineRouteCachePersistence();
    let durable = true;
    let databasePromise: Promise<IDBDatabase> | null = null;
    const database = () => {
        databasePromise ??= openOfflineRouteDatabase(factory);
        return databasePromise;
    };
    const markDurableStoreUnavailable = () => {
        durable = false;
        if (databasePromise) {
            void databasePromise
                .then((openDatabase) => openDatabase.close())
                .catch(() => undefined);
        }
        databasePromise = null;
    };
    const withFallback = async <Result>(
        durableTask: () => Promise<Result>,
        fallbackTask: () => Promise<Result>,
    ) => {
        if (!durable) return await fallbackTask();
        try {
            return await durableTask();
        } catch {
            markDurableStoreUnavailable();
            return await fallbackTask();
        }
    };
    return {
        get durability() {
            return durable ? 'durable' : 'memory';
        },
        durableCleanupRequired: true,
        async load({ userId, runId, now }) {
            return await withFallback(
                async () => {
                    const db = await database();
                    const transaction = db.transaction(
                        offlineRouteStoreName,
                        'readwrite',
                    );
                    const completed = transactionCompleted(transaction);
                    const store = transaction.objectStore(
                        offlineRouteStoreName,
                    );
                    const raw: unknown = await requestResult(store.get(userId));
                    const parsed = parseOfflineRouteSnapshot(raw, {
                        userId,
                        now,
                    });
                    if (raw !== undefined && !parsed) {
                        await requestResult(store.delete(userId));
                    }
                    await completed;
                    if (!parsed) {
                        await memory.clearUser(userId);
                        return null;
                    }
                    await memory.save(parsed);
                    if (runId !== undefined && parsed.scope.runId !== runId) {
                        return null;
                    }
                    return cloneSnapshot(parsed);
                },
                async () => await memory.load({ userId, runId, now }),
            );
        },
        async save(snapshot) {
            await withFallback(
                async () => {
                    const parsed = parseOfflineRouteSnapshot(snapshot, {
                        userId: snapshot.scope.userId,
                        runId: snapshot.scope.runId,
                        now: new Date(snapshot.cachedAt),
                    });
                    if (!parsed) {
                        throw new TypeError(
                            'Offline route snapshot is invalid',
                        );
                    }
                    await memory.save(parsed);
                    const db = await database();
                    const transaction = db.transaction(
                        offlineRouteStoreName,
                        'readwrite',
                    );
                    const completed = transactionCompleted(transaction);
                    await requestResult(
                        transaction
                            .objectStore(offlineRouteStoreName)
                            .put(parsed, snapshot.scope.userId),
                    );
                    await completed;
                },
                async () => await memory.save(snapshot),
            );
        },
        async clear({ userId, runId }) {
            try {
                const db = await database();
                const transaction = db.transaction(
                    offlineRouteStoreName,
                    'readwrite',
                );
                const completed = transactionCompleted(transaction);
                const store = transaction.objectStore(offlineRouteStoreName);
                if (!runId) {
                    await requestResult(store.delete(userId));
                } else {
                    const raw: unknown = await requestResult(store.get(userId));
                    if (rawScopeMatches(raw, { userId, runId })) {
                        await requestResult(store.delete(userId));
                    }
                }
                await completed;
                await memory.clear({ userId, runId });
                durable = true;
            } catch {
                markDurableStoreUnavailable();
                throw new Error(
                    'Durable offline route cleanup could not be confirmed',
                );
            }
        },
        async clearUser(userId) {
            try {
                const db = await database();
                const transaction = db.transaction(
                    offlineRouteStoreName,
                    'readwrite',
                );
                const completed = transactionCompleted(transaction);
                await requestResult(
                    transaction
                        .objectStore(offlineRouteStoreName)
                        .delete(userId),
                );
                await completed;
                await memory.clearUser(userId);
                durable = true;
            } catch {
                markDurableStoreUnavailable();
                throw new Error(
                    'Durable offline route cleanup could not be confirmed',
                );
            }
        },
    };
}

export function createBrowserOfflineRouteCachePersistence(): OfflineRouteCachePersistence {
    try {
        return typeof indexedDB === 'undefined'
            ? createMemoryOfflineRouteCachePersistence()
            : createIndexedDbOfflineRouteCachePersistence(indexedDB);
    } catch {
        const memory = createMemoryOfflineRouteCachePersistence();
        return {
            ...memory,
            durableCleanupRequired: true,
            async clear() {
                throw new Error(
                    'Durable offline route cleanup could not be confirmed',
                );
            },
            async clearUser() {
                throw new Error(
                    'Durable offline route cleanup could not be confirmed',
                );
            },
        };
    }
}

export async function clearOtherOfflineRouteCacheScopes(
    persistence: OfflineRouteCachePersistence,
    scope: { userId: string; activeRunId: string },
) {
    const stored = await persistence.load({ userId: scope.userId });
    if (
        persistence.durableCleanupRequired &&
        persistence.durability !== 'durable'
    ) {
        throw new Error('Durable offline route cleanup could not be confirmed');
    }
    if (!stored || stored.scope.runId === scope.activeRunId) return;
    await persistence.clear({
        userId: scope.userId,
        runId: stored.scope.runId,
    });
    if (
        persistence.durableCleanupRequired &&
        persistence.durability !== 'durable'
    ) {
        throw new Error('Durable offline route cleanup could not be confirmed');
    }
}
