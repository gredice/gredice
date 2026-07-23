import assert from 'node:assert/strict';
import test from 'node:test';
import { GeneratedLSystemCache } from './generatedLSystemCache';
import { resolveGeneratedLSystemTaskSymbols } from './generatedLSystemTaskState';

test('keeps the current oversized result satisfied without caching it', () => {
    const cache = new GeneratedLSystemCache({
        maxEntryCount: 1,
        maxEstimatedBytes: 1,
    });
    const symbols = [{ char: 'F', generation: 0 }];
    const taskKey = 'oversized-task';

    cache.set(taskKey, symbols);

    assert.equal(cache.get(taskKey), undefined);
    assert.equal(
        resolveGeneratedLSystemTaskSymbols({ symbols, taskKey }, taskKey),
        symbols,
    );
    assert.equal(
        resolveGeneratedLSystemTaskSymbols({ symbols, taskKey }, 'next-task'),
        null,
    );
});
