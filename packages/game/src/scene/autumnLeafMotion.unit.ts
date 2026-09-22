import assert from 'node:assert/strict';
import test from 'node:test';
import {
    autumnLeafCaps,
    createAutumnLeafDescriptor,
    resolveAutumnLeafCount,
    sampleAutumnLeaf,
} from './autumnLeafMotion';

test('ambient leaf pools stay bounded and stop outside shedding or when disabled', () => {
    for (const tier of [
        'low',
        'auto-constrained',
        'medium',
        'high',
        'custom',
    ] as const) {
        assert.equal(
            resolveAutumnLeafCount(tier, 1000, 1, 3),
            autumnLeafCaps[tier],
        );
        assert.equal(resolveAutumnLeafCount(tier, 10, 0, 3), 0);
        assert.equal(resolveAutumnLeafCount(tier, 10, 1, 3, false), 0);
        assert.equal(resolveAutumnLeafCount(tier, 0, 1, 3), 0);
        assert.equal(resolveAutumnLeafCount(tier, 10, NaN, 3), 0);
    }
});

test('leaf motion is seeded, finite, bounded and responds to wind direction', () => {
    const leaf = createAutumnLeafDescriptor('tree:a', 0);
    assert.deepEqual(leaf, createAutumnLeafDescriptor('tree:a', 0));
    assert.notDeepEqual(leaf, createAutumnLeafDescriptor('tree:b', 0));
    assert.deepEqual(
        sampleAutumnLeaf(leaf, 12, 3, 90),
        sampleAutumnLeaf(leaf, 12, 3, 90),
    );
    assert.ok(
        sampleAutumnLeaf(leaf, 12, 3, 90).x >
            sampleAutumnLeaf(leaf, 12, 0, 90).x,
    );
    for (let time = 0; time < 100; time += 0.1) {
        const sample = sampleAutumnLeaf(leaf, time, 1000, 45);
        assert.ok(sample.y >= 0 && sample.y <= 1.75);
        assert.ok(sample.scale >= 0 && sample.scale <= 1);
        assert.ok(Math.abs(sample.x) < 3 && Math.abs(sample.z) < 3);
    }
});
