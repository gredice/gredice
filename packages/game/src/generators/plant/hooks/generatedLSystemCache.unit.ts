import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { LSystemSymbol } from '../lib/l-system';
import {
    estimateGeneratedLSystemCacheEntryBytes,
    GeneratedLSystemCache,
} from './generatedLSystemCache';

function symbols(count: number): LSystemSymbol[] {
    return Array.from({ length: count }, (_, generation) => ({
        char: 'F',
        generation,
        growthStart: generation / Math.max(1, count),
        params: [generation, generation + 1],
    }));
}

describe('GeneratedLSystemCache', () => {
    it('evicts the least recently used entries by estimated byte weight', () => {
        const value = symbols(2);
        const entryBytes = estimateGeneratedLSystemCacheEntryBytes('a', value);
        const cache = new GeneratedLSystemCache({
            maxEntryCount: 10,
            maxEstimatedBytes: entryBytes * 2,
        });

        cache.set('a', value).set('b', value);
        assert.equal(cache.get('a'), value);
        cache.set('c', value);

        assert.equal(cache.has('a'), true);
        assert.equal(cache.has('b'), false);
        assert.equal(cache.has('c'), true);
        assert.equal(cache.snapshot().evictionCount, 1);
    });

    it('enforces the entry ceiling for tiny values', () => {
        const cache = new GeneratedLSystemCache({
            maxEntryCount: 2,
            maxEstimatedBytes: 1_000_000,
        });

        cache.set('a', []).set('b', []).set('c', []);

        assert.equal(cache.snapshot().entryCount, 2);
        assert.equal(cache.has('a'), false);
    });

    it('replaces entries without growing the entry count', () => {
        const cache = new GeneratedLSystemCache({
            maxEntryCount: 4,
            maxEstimatedBytes: 1_000_000,
        });

        cache.set('a', symbols(1));
        const before = cache.snapshot().estimatedBytes;
        const replacement = symbols(3);
        cache.set('a', replacement);

        assert.equal(cache.snapshot().entryCount, 1);
        assert.ok(cache.snapshot().estimatedBytes > before);
        assert.equal(cache.get('a'), replacement);
    });

    it('skips oversized values without flushing retained entries', () => {
        const retained = symbols(1);
        const oversized = symbols(20);
        const cache = new GeneratedLSystemCache({
            maxEntryCount: 4,
            maxEstimatedBytes:
                estimateGeneratedLSystemCacheEntryBytes('retained', retained) +
                1,
        });

        cache.set('retained', retained);
        cache.set('oversized', oversized);

        assert.equal(cache.get('retained'), retained);
        assert.equal(cache.has('oversized'), false);
        assert.equal(cache.snapshot().oversizeSkipCount, 1);
    });

    it('reports exact counters and stays bounded through seed churn', () => {
        const value = symbols(1);
        const cache = new GeneratedLSystemCache({
            maxEntryCount: 32,
            maxEstimatedBytes: 12_000,
        });

        cache.get('missing');
        cache.set('first', value);
        cache.get('first');
        for (let index = 0; index < 10_000; index += 1) {
            cache.set(`seed:${index}`, symbols(index % 4));
            const snapshot = cache.snapshot();
            assert.ok(snapshot.entryCount <= snapshot.maxEntryCount);
            assert.ok(snapshot.estimatedBytes <= snapshot.maxEstimatedBytes);
        }

        const snapshot = cache.snapshot();
        assert.equal(snapshot.hitCount, 1);
        assert.equal(snapshot.missCount, 1);
        assert.equal(snapshot.writeCount, 10_001);
        assert.ok(snapshot.evictionCount > 0);
        assert.ok(snapshot.peakEstimatedBytes > 0);
    });
});
