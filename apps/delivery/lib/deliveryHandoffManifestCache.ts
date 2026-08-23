import {
    type DeliveryHandoffManifest,
    type DeliveryHandoffManifestScope,
    parseDeliveryHandoffManifest,
} from './deliveryHandoffManifest';
import { assertDeliveryOfflineWritesAllowed } from './deliveryOfflineEvents';

export const deliveryHandoffManifestCacheTtlMs = 24 * 60 * 60 * 1_000;

export type DeliveryHandoffManifestCacheRecord = {
    version: 1;
    scope: DeliveryHandoffManifestScope;
    manifest: DeliveryHandoffManifest;
    cachedAt: string;
    expiresAt: string;
};

export type DeliveryHandoffManifestCacheDurability = 'durable' | 'memory';

export type DeliveryHandoffManifestCacheClearScope = {
    userId: string;
    runId?: string;
    targetStopId?: number;
    expectedRetryAttempt?: number;
};

export type DeliveryHandoffManifestCachePersistence = {
    readonly durability: DeliveryHandoffManifestCacheDurability;
    readonly durableCleanupRequired?: boolean;
    load: (
        scope: DeliveryHandoffManifestScope,
        now?: Date,
    ) => Promise<DeliveryHandoffManifestCacheRecord | null>;
    save: (record: DeliveryHandoffManifestCacheRecord) => Promise<void>;
    clear: (scope: DeliveryHandoffManifestCacheClearScope) => Promise<void>;
    clearOtherRuns?: (scope: {
        userId: string;
        activeRunId: string;
    }) => Promise<void>;
};

export type DeliveryHandoffManifestWebStorage = {
    readonly length: number;
    key: (index: number) => string | null;
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
};

const storagePrefix = 'gredice:delivery:handoff-manifest:v1:';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]) {
    const allowedKeys = new Set(allowed);
    return Object.keys(value).every((key) => allowedKeys.has(key));
}

function validIdentifier(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        value.trim() === value &&
        value.length > 0 &&
        value.length <= 256
    );
}

function validStopId(value: unknown): value is number {
    return (
        typeof value === 'number' &&
        Number.isSafeInteger(value) &&
        value > 0 &&
        value <= 2_147_483_647
    );
}

function validRetryAttempt(value: unknown): value is number {
    return (
        typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    );
}

function validDate(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
        Number.isFinite(Date.parse(value))
    );
}

function validScope(value: unknown): value is DeliveryHandoffManifestScope {
    return (
        isRecord(value) &&
        hasOnlyKeys(value, [
            'userId',
            'runId',
            'targetStopId',
            'expectedRetryAttempt',
        ]) &&
        validIdentifier(value.userId) &&
        validIdentifier(value.runId) &&
        validStopId(value.targetStopId) &&
        validRetryAttempt(value.expectedRetryAttempt)
    );
}

function cacheKey(scope: DeliveryHandoffManifestScope) {
    return `${storagePrefix}${encodeURIComponent(scope.userId)}:${encodeURIComponent(scope.runId)}:${scope.targetStopId}:${scope.expectedRetryAttempt}`;
}

function clearPrefix(scope: DeliveryHandoffManifestCacheClearScope) {
    if (!validIdentifier(scope.userId)) {
        throw new TypeError('Delivery handoff manifest cache scope is invalid');
    }
    let prefix = `${storagePrefix}${encodeURIComponent(scope.userId)}:`;
    if (scope.runId === undefined) {
        if (
            scope.targetStopId !== undefined ||
            scope.expectedRetryAttempt !== undefined
        ) {
            throw new TypeError(
                'Delivery handoff manifest cache scope is invalid',
            );
        }
        return prefix;
    }
    if (!validIdentifier(scope.runId)) {
        throw new TypeError('Delivery handoff manifest cache scope is invalid');
    }
    prefix += `${encodeURIComponent(scope.runId)}:`;
    if (scope.targetStopId === undefined) {
        if (scope.expectedRetryAttempt !== undefined) {
            throw new TypeError(
                'Delivery handoff manifest cache scope is invalid',
            );
        }
        return prefix;
    }
    if (!validStopId(scope.targetStopId)) {
        throw new TypeError('Delivery handoff manifest cache scope is invalid');
    }
    prefix += `${scope.targetStopId}:`;
    if (scope.expectedRetryAttempt === undefined) return prefix;
    if (!validRetryAttempt(scope.expectedRetryAttempt)) {
        throw new TypeError('Delivery handoff manifest cache scope is invalid');
    }
    return `${prefix}${scope.expectedRetryAttempt}`;
}

function cacheKeyMatchesClearScope(
    key: string,
    scope: DeliveryHandoffManifestCacheClearScope,
) {
    const candidate = clearPrefix(scope);
    return scope.runId !== undefined &&
        scope.targetStopId !== undefined &&
        scope.expectedRetryAttempt !== undefined
        ? key === candidate
        : key.startsWith(candidate);
}

function parseCacheRecord(
    value: unknown,
    expectedScope?: DeliveryHandoffManifestScope,
): DeliveryHandoffManifestCacheRecord | null {
    if (
        !isRecord(value) ||
        !hasOnlyKeys(value, [
            'version',
            'scope',
            'manifest',
            'cachedAt',
            'expiresAt',
        ]) ||
        value.version !== 1 ||
        !validScope(value.scope) ||
        !validDate(value.cachedAt) ||
        !validDate(value.expiresAt)
    ) {
        return null;
    }
    const manifest = parseDeliveryHandoffManifest(value.manifest);
    if (
        !manifest ||
        manifest.runId !== value.scope.runId ||
        manifest.targetStopId !== value.scope.targetStopId ||
        manifest.retryAttempt !== value.scope.expectedRetryAttempt ||
        Date.parse(value.expiresAt) <= Date.parse(value.cachedAt) ||
        (expectedScope &&
            (expectedScope.userId !== value.scope.userId ||
                expectedScope.runId !== value.scope.runId ||
                expectedScope.targetStopId !== value.scope.targetStopId ||
                expectedScope.expectedRetryAttempt !==
                    value.scope.expectedRetryAttempt))
    ) {
        return null;
    }
    return {
        version: 1,
        scope: { ...value.scope },
        manifest,
        cachedAt: value.cachedAt,
        expiresAt: value.expiresAt,
    };
}

export function createDeliveryHandoffManifestCacheRecord({
    userId,
    manifest,
    now = new Date(),
}: {
    userId: string;
    manifest: DeliveryHandoffManifest;
    now?: Date;
}): DeliveryHandoffManifestCacheRecord {
    const parsedManifest = parseDeliveryHandoffManifest(manifest);
    if (
        !validIdentifier(userId) ||
        !parsedManifest ||
        !Number.isFinite(now.getTime())
    ) {
        throw new TypeError(
            'Delivery handoff manifest cache record is invalid',
        );
    }
    const cachedAt = now.toISOString();
    return {
        version: 1,
        scope: {
            userId,
            runId: parsedManifest.runId,
            targetStopId: parsedManifest.targetStopId,
            expectedRetryAttempt: parsedManifest.retryAttempt,
        },
        manifest: parsedManifest,
        cachedAt,
        expiresAt: new Date(
            now.getTime() + deliveryHandoffManifestCacheTtlMs,
        ).toISOString(),
    };
}

function serializedRecord(record: DeliveryHandoffManifestCacheRecord) {
    const parsed = parseCacheRecord(record);
    if (!parsed) {
        throw new TypeError(
            'Delivery handoff manifest cache record is invalid',
        );
    }
    return JSON.stringify(parsed);
}

function parsedSerializedRecord(
    value: string | null,
    expectedScope: DeliveryHandoffManifestScope,
) {
    if (!value) return null;
    try {
        return parseCacheRecord(JSON.parse(value), expectedScope);
    } catch {
        return null;
    }
}

function validAt(record: DeliveryHandoffManifestCacheRecord | null, now: Date) {
    return record &&
        Number.isFinite(now.getTime()) &&
        Date.parse(record.cachedAt) <= now.getTime() + 5 * 60 * 1_000 &&
        Date.parse(record.expiresAt) > now.getTime()
        ? record
        : null;
}

export function createMemoryDeliveryHandoffManifestCachePersistence(): DeliveryHandoffManifestCachePersistence {
    const values = new Map<string, string>();
    return {
        durability: 'memory',
        durableCleanupRequired: false,
        async load(scope, now = new Date()) {
            const key = cacheKey(scope);
            const record = validAt(
                parsedSerializedRecord(values.get(key) ?? null, scope),
                now,
            );
            if (!record) values.delete(key);
            return record;
        },
        async save(record) {
            assertDeliveryOfflineWritesAllowed();
            values.set(cacheKey(record.scope), serializedRecord(record));
        },
        async clear(scope) {
            for (const key of values.keys()) {
                if (cacheKeyMatchesClearScope(key, scope)) values.delete(key);
            }
        },
        async clearOtherRuns({ userId, activeRunId }) {
            const userPrefix = clearPrefix({ userId });
            const activePrefix = clearPrefix({ userId, runId: activeRunId });
            for (const key of values.keys()) {
                if (
                    key.startsWith(userPrefix) &&
                    !key.startsWith(activePrefix)
                ) {
                    values.delete(key);
                }
            }
        },
    };
}

export function createWebStorageDeliveryHandoffManifestCachePersistence(
    storage: DeliveryHandoffManifestWebStorage,
): DeliveryHandoffManifestCachePersistence {
    const fallbackValues = new Map<string, string>();
    let durable = true;

    function storageKeys() {
        return Array.from({ length: storage.length }, (_, index) =>
            storage.key(index),
        );
    }

    return {
        get durability() {
            return durable ? 'durable' : 'memory';
        },
        durableCleanupRequired: true,
        async load(scope, now = new Date()) {
            const key = cacheKey(scope);
            if (durable) {
                try {
                    const serialized = storage.getItem(key);
                    if (serialized === null) fallbackValues.delete(key);
                    else fallbackValues.set(key, serialized);
                    const record = validAt(
                        parsedSerializedRecord(serialized, scope),
                        now,
                    );
                    if (!record && serialized !== null) {
                        storage.removeItem(key);
                        fallbackValues.delete(key);
                    }
                    return record;
                } catch {
                    durable = false;
                }
            }
            const record = validAt(
                parsedSerializedRecord(fallbackValues.get(key) ?? null, scope),
                now,
            );
            if (!record) fallbackValues.delete(key);
            return record;
        },
        async save(record) {
            assertDeliveryOfflineWritesAllowed();
            const value = serializedRecord(record);
            const key = cacheKey(record.scope);
            fallbackValues.set(key, value);
            if (!durable) return;
            try {
                storage.setItem(key, value);
            } catch {
                durable = false;
            }
        },
        async clear(scope) {
            try {
                for (const key of storageKeys()) {
                    if (key && cacheKeyMatchesClearScope(key, scope)) {
                        storage.removeItem(key);
                    }
                }
                for (const key of fallbackValues.keys()) {
                    if (cacheKeyMatchesClearScope(key, scope)) {
                        fallbackValues.delete(key);
                    }
                }
                durable = true;
            } catch {
                durable = false;
                throw new Error(
                    'Durable delivery handoff manifest cleanup could not be confirmed',
                );
            }
        },
        async clearOtherRuns({ userId, activeRunId }) {
            const userPrefix = clearPrefix({ userId });
            const activePrefix = clearPrefix({ userId, runId: activeRunId });
            try {
                for (const key of storageKeys()) {
                    if (
                        key?.startsWith(userPrefix) &&
                        !key.startsWith(activePrefix)
                    ) {
                        storage.removeItem(key);
                    }
                }
                for (const key of fallbackValues.keys()) {
                    if (
                        key.startsWith(userPrefix) &&
                        !key.startsWith(activePrefix)
                    ) {
                        fallbackValues.delete(key);
                    }
                }
                durable = true;
            } catch {
                durable = false;
                throw new Error(
                    'Durable delivery handoff manifest cleanup could not be confirmed',
                );
            }
        },
    };
}
