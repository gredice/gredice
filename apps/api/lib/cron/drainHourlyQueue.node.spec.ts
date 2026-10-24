import assert from 'node:assert/strict';
import test from 'node:test';
import { drainHourlyQueue } from './drainHourlyQueue';

test('hourly window processes a burst larger than one former batch', async () => {
    const pending = [100, 100, 37];
    const result = await drainHourlyQueue({
        runBatch: async () => pending.shift() ?? 0,
        shouldContinue: (count) => count === 100,
    });
    assert.deepEqual(result.results, [100, 100, 37]);
    assert.equal(result.capacityReached, false);
});
test('empty and retry-blocked workers stop without repeated provider attempts', async () => {
    let runs = 0;
    const result = await drainHourlyQueue({
        runBatch: async () => {
            runs += 1;
            return { count: 100, retrying: true };
        },
        shouldContinue: (batch) => batch.count === 100 && !batch.retrying,
    });
    assert.equal(runs, 1);
    assert.equal(result.capacityReached, false);
});
test('hourly workers bound capacity and stop before starting work beyond the window', async () => {
    const full = await drainHourlyQueue({
        runBatch: async () => 100,
        shouldContinue: () => true,
    });
    assert.equal(full.results.length, 12);
    assert.equal(full.capacityReached, true);
    let elapsed = 0;
    const timed = await drainHourlyQueue({
        now: () => elapsed,
        runBatch: async () => {
            elapsed = 240_000;
            return 100;
        },
        shouldContinue: () => true,
    });
    assert.deepEqual(timed.results, [100]);
    assert.equal(timed.capacityReached, true);
});
test('persistence failure stops the invocation without issuing another batch', async () => {
    let runs = 0;
    await assert.rejects(
        drainHourlyQueue({
            runBatch: async () => {
                runs += 1;
                throw new Error('lost persistence');
            },
            shouldContinue: () => true,
        }),
        /lost persistence/,
    );
    assert.equal(runs, 1);
});
