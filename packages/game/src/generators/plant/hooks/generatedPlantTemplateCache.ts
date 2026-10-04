import {
    getPackedPlantRenderDataTransferByteLength,
    type PackedPlantRenderData,
} from '../lib/packedPlantRenderData';

export const generatedPlantTemplateCacheMaxEntryCount = 256;
export const generatedPlantTemplateCacheMaxEstimatedBytes = 16 * 1024 * 1024;

type GeneratedPlantTemplateCacheEntry = {
    estimatedBytes: number;
    value: PackedPlantRenderData;
};

export type GeneratedPlantTemplateCacheSnapshot = {
    entryCount: number;
    estimatedBytes: number;
    evictionCount: number;
    hitCount: number;
    maxEntryCount: number;
    maxEstimatedBytes: number;
    missCount: number;
    oversizeSkipCount: number;
    peakEstimatedBytes: number;
    writeCount: number;
};

export type GeneratedPlantTemplateCacheDelta = Pick<
    GeneratedPlantTemplateCacheSnapshot,
    | 'evictionCount'
    | 'hitCount'
    | 'missCount'
    | 'oversizeSkipCount'
    | 'writeCount'
>;

export function getGeneratedPlantTemplateCacheDelta(
    before: GeneratedPlantTemplateCacheSnapshot,
    after: GeneratedPlantTemplateCacheSnapshot,
): GeneratedPlantTemplateCacheDelta {
    return {
        evictionCount: Math.max(0, after.evictionCount - before.evictionCount),
        hitCount: Math.max(0, after.hitCount - before.hitCount),
        missCount: Math.max(0, after.missCount - before.missCount),
        oversizeSkipCount: Math.max(
            0,
            after.oversizeSkipCount - before.oversizeSkipCount,
        ),
        writeCount: Math.max(0, after.writeCount - before.writeCount),
    };
}

export class GeneratedPlantTemplateCache {
    private readonly entries = new Map<
        string,
        GeneratedPlantTemplateCacheEntry
    >();
    private estimatedBytes = 0;
    private evictionCount = 0;
    private hitCount = 0;
    private missCount = 0;
    private oversizeSkipCount = 0;
    private peakEstimatedBytes = 0;
    private writeCount = 0;

    constructor(
        private readonly limits: {
            maxEntryCount: number;
            maxEstimatedBytes: number;
        } = {
            maxEntryCount: generatedPlantTemplateCacheMaxEntryCount,
            maxEstimatedBytes: generatedPlantTemplateCacheMaxEstimatedBytes,
        },
    ) {}

    get(key: string) {
        const entry = this.entries.get(key);
        if (!entry) {
            this.missCount += 1;
            return undefined;
        }

        this.entries.delete(key);
        this.entries.set(key, entry);
        this.hitCount += 1;
        return entry.value;
    }

    has(key: string) {
        return this.entries.has(key);
    }

    set(key: string, value: PackedPlantRenderData) {
        const estimatedBytes =
            getPackedPlantRenderDataTransferByteLength(value) +
            key.length * 2 +
            256;
        if (estimatedBytes > this.limits.maxEstimatedBytes) {
            this.oversizeSkipCount += 1;
            return this;
        }

        const existing = this.entries.get(key);
        if (existing) {
            this.entries.delete(key);
            this.estimatedBytes -= existing.estimatedBytes;
        }

        while (
            this.entries.size >= this.limits.maxEntryCount ||
            this.estimatedBytes + estimatedBytes > this.limits.maxEstimatedBytes
        ) {
            const oldestKey = this.entries.keys().next().value;
            if (typeof oldestKey !== 'string') {
                break;
            }

            const oldestEntry = this.entries.get(oldestKey);
            this.entries.delete(oldestKey);
            if (oldestEntry) {
                this.estimatedBytes -= oldestEntry.estimatedBytes;
                this.evictionCount += 1;
            }
        }

        this.entries.set(key, { estimatedBytes, value });
        this.estimatedBytes += estimatedBytes;
        this.peakEstimatedBytes = Math.max(
            this.peakEstimatedBytes,
            this.estimatedBytes,
        );
        this.writeCount += 1;
        return this;
    }

    snapshot(): GeneratedPlantTemplateCacheSnapshot {
        return {
            entryCount: this.entries.size,
            estimatedBytes: this.estimatedBytes,
            evictionCount: this.evictionCount,
            hitCount: this.hitCount,
            maxEntryCount: this.limits.maxEntryCount,
            maxEstimatedBytes: this.limits.maxEstimatedBytes,
            missCount: this.missCount,
            oversizeSkipCount: this.oversizeSkipCount,
            peakEstimatedBytes: this.peakEstimatedBytes,
            writeCount: this.writeCount,
        };
    }
}
