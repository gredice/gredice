import assert from 'node:assert/strict';
import test from 'node:test';
import {
    autumnLeafCaps,
    createAutumnLeafDescriptor,
    resolveAutumnLeafCount,
    sampleAutumnLeaf,
    writeAutumnLeafSourceCounts,
} from './autumnLeafMotion';

test('bush leaves fall from the half-tile canopy down to its base', () => {
    const leaf = createAutumnLeafDescriptor('bush:a', 0);
    for (let time = 0; time < 20; time += 0.1) {
        const bush = sampleAutumnLeaf(leaf, time, 2, 90, 0.5);
        const tree = sampleAutumnLeaf(leaf, time, 2, 90);
        assert.ok(bush.y >= 0 && bush.y <= 0.5);
        assert.equal(bush.x, tree.x);
        assert.equal(bush.z, tree.z);
        assert.ok(Math.abs(bush.y / 0.5 - tree.y / 1.75) < 1e-10);
    }
});

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

test('capped pools share leaves across visible sources, including more sources than slots', () => {
    const buffer: number[] = [];
    assert.equal(writeAutumnLeafSourceCounts(buffer, 10, 8, 24), buffer);
    assert.equal(
        buffer.reduce((sum, value) => sum + value, 0),
        24,
    );
    assert(buffer.every((value) => value === 2 || value === 3));
    writeAutumnLeafSourceCounts(buffer, 100, 8, 24);
    assert.equal(buffer.filter(Boolean).length, 24);
    assert(buffer.slice(80).some(Boolean));
    assert(buffer.every((value) => value <= 1));
    writeAutumnLeafSourceCounts(buffer, 0, 8, 24);
    assert.equal(buffer.length, 0);
});

test('leaf drift shares the compass convention used by clouds and snow', () => {
    const leaf = createAutumnLeafDescriptor('compass', 0);
    const calm = sampleAutumnLeaf(leaf, 12, 0, 0);
    assert(sampleAutumnLeaf(leaf, 12, 3, 0).z < calm.z);
    assert(sampleAutumnLeaf(leaf, 12, 3, 180).z > calm.z);
    assert(sampleAutumnLeaf(leaf, 12, 3, 90).x > calm.x);
    assert(sampleAutumnLeaf(leaf, 12, 3, 270).x < calm.x);
    const diagonal = sampleAutumnLeaf(leaf, 12, 3, 45);
    assert(diagonal.x > calm.x && diagonal.z < calm.z);
});
