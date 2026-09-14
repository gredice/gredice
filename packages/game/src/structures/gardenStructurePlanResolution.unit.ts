import assert from 'node:assert/strict';
import test from 'node:test';
import { createGardenStructureTemplateSeed } from '@gredice/js/gardenStructures';
import { GardenStructurePlanCache } from './gardenStructurePlanCache';
import { resolveGardenStructurePlanWithCache } from './gardenStructurePlanResolution';
import type { GardenStructureCompileInput } from './structurePlanTypes';

test('prepares once and includes preparation in hit and miss timings', () => {
    const document = createGardenStructureTemplateSeed('house').document;
    let documentReadCount = 0;
    const input: GardenStructureCompileInput = {
        document,
        placement: { anchorX: 2, anchorY: 3, rotation: 1 },
        revision: 4,
        structureId: 'profile-resolution',
    };
    Object.defineProperty(input, 'document', {
        configurable: true,
        enumerable: true,
        get: () => {
            documentReadCount += 1;
            return document;
        },
    });
    const cache = new GardenStructurePlanCache();
    const timestamps = [0, 5, 12, 20, 24];
    const now = () => timestamps.shift() ?? 24;

    const miss = resolveGardenStructurePlanWithCache({
        cache,
        input,
        measureDurations: true,
        now,
    });
    const hit = resolveGardenStructurePlanWithCache({
        cache,
        input,
        measureDurations: true,
        now,
    });

    assert.equal(documentReadCount, 2);
    assert.equal(miss.cacheOutcome, 'miss');
    assert.equal(miss.lookupDurationMs, 5);
    assert.equal(miss.compileDurationMs, 12);
    assert.equal(hit.cacheOutcome, 'hit');
    assert.equal(hit.lookupDurationMs, 4);
    assert.equal(hit.compileDurationMs, 0);
    assert.equal(hit.plan, miss.plan);
    assert.deepEqual(
        {
            hits: cache.snapshot().hitCount,
            misses: cache.snapshot().missCount,
        },
        { hits: 1, misses: 1 },
    );
});

test('does not call the profile clock when duration measurement is disabled', () => {
    const cache = new GardenStructurePlanCache();
    const input: GardenStructureCompileInput = {
        document: createGardenStructureTemplateSeed('barn').document,
        placement: { anchorX: 0, anchorY: 0, rotation: 0 },
        revision: 1,
        structureId: 'unmeasured-resolution',
    };
    let clockCallCount = 0;

    const resolution = resolveGardenStructurePlanWithCache({
        cache,
        input,
        now: () => {
            clockCallCount += 1;
            return clockCallCount;
        },
    });

    assert.equal(clockCallCount, 0);
    assert.equal(resolution.lookupDurationMs, 0);
    assert.equal(resolution.compileDurationMs, 0);
});
