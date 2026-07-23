import type { LSystemSymbol } from '../lib/l-system';

export const generatedLSystemCacheMaxEstimatedBytes = 16 * 1024 * 1024;
export const generatedLSystemCacheMaxEntryCount = 4096;

type GeneratedLSystemCacheEntry = {
    estimatedBytes: number;
    symbols: LSystemSymbol[];
};

export type GeneratedLSystemCacheSnapshot = {
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

export function estimateGeneratedLSystemCacheEntryBytes(
    key: string,
    symbols: LSystemSymbol[],
) {
    let estimatedBytes = 64 + 24 + key.length * 2 + 24 + symbols.length * 8;

    for (const symbol of symbols) {
        estimatedBytes += 64;
        if (symbol.params) {
            estimatedBytes += 24 + symbol.params.length * 8;
        }
        if (symbol.growthStart !== undefined) {
            estimatedBytes += 8;
        }
    }

    return estimatedBytes;
}

export class GeneratedLSystemCache {
    private readonly entries = new Map<string, GeneratedLSystemCacheEntry>();
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
            maxEntryCount: generatedLSystemCacheMaxEntryCount,
            maxEstimatedBytes: generatedLSystemCacheMaxEstimatedBytes,
        },
    ) {}

    get(key: string) {
        const entry = this.entries.get(key);
        if (!entry) {
            this.missCount += 1;
            return undefined;
        }

        this.hitCount += 1;
        this.entries.delete(key);
        this.entries.set(key, entry);
        return entry.symbols;
    }

    has(key: string) {
        return this.entries.has(key);
    }

    set(key: string, symbols: LSystemSymbol[]) {
        const estimatedBytes = estimateGeneratedLSystemCacheEntryBytes(
            key,
            symbols,
        );
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

        this.entries.set(key, { estimatedBytes, symbols });
        this.estimatedBytes += estimatedBytes;
        this.peakEstimatedBytes = Math.max(
            this.peakEstimatedBytes,
            this.estimatedBytes,
        );
        this.writeCount += 1;
        return this;
    }

    snapshot(): GeneratedLSystemCacheSnapshot {
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

export const generatedLSystemCache = new GeneratedLSystemCache();

export function getGeneratedLSystemCacheSnapshot() {
    return generatedLSystemCache.snapshot();
}
