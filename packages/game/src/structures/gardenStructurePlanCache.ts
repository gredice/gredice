import {
    compileGardenStructurePlan,
    getGardenStructurePlanCacheKey,
} from './compileGardenStructurePlan';
import type {
    GardenStructureCompileInput,
    GardenStructureSemanticPlan,
} from './structurePlanTypes';

export const gardenStructurePlanCacheMaxEntryCount = 32;
export const gardenStructurePlanCacheMaxEstimatedBytes = 8 * 1024 * 1024;

export type GardenStructurePlanCacheDisposalReason =
    | 'evicted'
    | 'replaced'
    | 'deleted'
    | 'cleared';

export type GardenStructurePlanCacheDispose = (
    plan: GardenStructureSemanticPlan,
    reason: GardenStructurePlanCacheDisposalReason,
) => void;

export type GardenStructurePlanCacheOptions = Readonly<{
    maxEntryCount?: number;
    maxEstimatedBytes?: number;
    dispose?: GardenStructurePlanCacheDispose;
}>;

export type GardenStructurePlanCacheSnapshot = Readonly<{
    entryCount: number;
    estimatedBytes: number;
    maxEntryCount: number;
    maxEstimatedBytes: number;
    hitCount: number;
    missCount: number;
    writeCount: number;
    evictionCount: number;
    oversizeSkipCount: number;
    disposalCount: number;
    peakEstimatedBytes: number;
}>;

type GardenStructurePlanCacheEntry = Readonly<{
    plan: GardenStructureSemanticPlan;
    estimatedBytes: number;
}>;

function getUnknownValueEstimatedBytes(
    value: unknown,
    seen: WeakSet<object>,
): number {
    if (value === null || value === undefined) {
        return 0;
    }
    if (typeof value === 'string') {
        return 16 + value.length * 2;
    }
    if (typeof value === 'number' || typeof value === 'bigint') {
        return 8;
    }
    if (typeof value === 'boolean') {
        return 4;
    }
    if (typeof value !== 'object' || seen.has(value)) {
        return 0;
    }

    seen.add(value);
    if (value instanceof ArrayBuffer) {
        return 32 + value.byteLength;
    }
    if (ArrayBuffer.isView(value)) {
        return 48 + value.byteLength;
    }
    if (Array.isArray(value)) {
        return (
            32 +
            value.reduce(
                (total, item) =>
                    total + getUnknownValueEstimatedBytes(item, seen),
                0,
            )
        );
    }

    return Object.entries(value).reduce(
        (total, [key, item]) =>
            total +
            16 +
            key.length * 2 +
            getUnknownValueEstimatedBytes(item, seen),
        48,
    );
}

/** Conservative heap estimate used only to enforce a deterministic bound. */
export function getGardenStructureSemanticPlanEstimatedBytes(
    plan: GardenStructureSemanticPlan,
) {
    return getUnknownValueEstimatedBytes(plan, new WeakSet());
}

export function getGardenStructurePlanCacheEntryEstimatedBytes(
    plan: GardenStructureSemanticPlan,
) {
    return (
        getGardenStructureSemanticPlanEstimatedBytes(plan) +
        plan.cacheKey.length * 2 +
        96
    );
}

function requirePositiveSafeInteger(value: number, name: string) {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new RangeError(`${name} must be a positive safe integer.`);
    }
    return value;
}

/**
 * LRU cache for renderer-independent structure plans. Plans can indirectly
 * own renderer resources in consumers, so every removal path reports a
 * disposal reason through the caller-provided callback.
 */
export class GardenStructurePlanCache {
    private readonly entries = new Map<string, GardenStructurePlanCacheEntry>();
    private readonly maxEntryCount: number;
    private readonly maxEstimatedBytes: number;
    private readonly dispose: GardenStructurePlanCacheDispose | undefined;
    private estimatedBytes = 0;
    private hitCount = 0;
    private missCount = 0;
    private writeCount = 0;
    private evictionCount = 0;
    private oversizeSkipCount = 0;
    private disposalCount = 0;
    private peakEstimatedBytes = 0;

    constructor(options: GardenStructurePlanCacheOptions = {}) {
        this.maxEntryCount = requirePositiveSafeInteger(
            options.maxEntryCount ?? gardenStructurePlanCacheMaxEntryCount,
            'maxEntryCount',
        );
        this.maxEstimatedBytes = requirePositiveSafeInteger(
            options.maxEstimatedBytes ??
                gardenStructurePlanCacheMaxEstimatedBytes,
            'maxEstimatedBytes',
        );
        this.dispose = options.dispose;
    }

    get(key: string) {
        const entry = this.entries.get(key);
        if (!entry) {
            this.missCount += 1;
            return undefined;
        }

        this.entries.delete(key);
        this.entries.set(key, entry);
        this.hitCount += 1;
        return entry.plan;
    }

    has(key: string) {
        return this.entries.has(key);
    }

    getOrCompile(input: GardenStructureCompileInput) {
        const expectedKey = getGardenStructurePlanCacheKey(input);
        const cached = this.get(expectedKey);
        if (cached) {
            return cached;
        }

        const plan = compileGardenStructurePlan(input);
        if (plan.cacheKey !== expectedKey) {
            throw new Error(
                'Structure compiler returned an unexpected cache key.',
            );
        }
        this.set(plan);
        return plan;
    }

    set(plan: GardenStructureSemanticPlan) {
        const estimatedBytes =
            getGardenStructurePlanCacheEntryEstimatedBytes(plan);
        if (estimatedBytes > this.maxEstimatedBytes) {
            this.oversizeSkipCount += 1;
            return false;
        }

        const existing = this.entries.get(plan.cacheKey);
        if (existing?.plan === plan) {
            this.entries.delete(plan.cacheKey);
            this.entries.set(plan.cacheKey, existing);
            return true;
        }
        if (existing) {
            this.remove(plan.cacheKey, 'replaced');
        }

        while (
            this.entries.size >= this.maxEntryCount ||
            this.estimatedBytes + estimatedBytes > this.maxEstimatedBytes
        ) {
            const oldestKey = this.entries.keys().next().value;
            if (typeof oldestKey !== 'string') {
                break;
            }
            this.remove(oldestKey, 'evicted');
            this.evictionCount += 1;
        }

        this.entries.set(plan.cacheKey, { plan, estimatedBytes });
        this.estimatedBytes += estimatedBytes;
        this.peakEstimatedBytes = Math.max(
            this.peakEstimatedBytes,
            this.estimatedBytes,
        );
        this.writeCount += 1;
        return true;
    }

    delete(key: string) {
        return this.remove(key, 'deleted');
    }

    clear() {
        for (const key of [...this.entries.keys()]) {
            this.remove(key, 'cleared');
        }
    }

    snapshot(): GardenStructurePlanCacheSnapshot {
        return {
            entryCount: this.entries.size,
            estimatedBytes: this.estimatedBytes,
            maxEntryCount: this.maxEntryCount,
            maxEstimatedBytes: this.maxEstimatedBytes,
            hitCount: this.hitCount,
            missCount: this.missCount,
            writeCount: this.writeCount,
            evictionCount: this.evictionCount,
            oversizeSkipCount: this.oversizeSkipCount,
            disposalCount: this.disposalCount,
            peakEstimatedBytes: this.peakEstimatedBytes,
        };
    }

    private remove(
        key: string,
        reason: GardenStructurePlanCacheDisposalReason,
    ) {
        const entry = this.entries.get(key);
        if (!entry) {
            return false;
        }

        this.entries.delete(key);
        this.estimatedBytes -= entry.estimatedBytes;
        if (this.dispose) {
            this.dispose(entry.plan, reason);
            this.disposalCount += 1;
        }
        return true;
    }
}
