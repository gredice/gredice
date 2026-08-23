import assert from 'node:assert/strict';
import test from 'node:test';
import {
    normalizeRainParticleIntensity,
    rainParticleVisibilityThreshold,
    resolveRainParticleState,
} from './rainParticles';

test('normalizes rain particle intensity to a finite unit value', () => {
    assert.equal(normalizeRainParticleIntensity(Number.NaN), 0);
    assert.equal(normalizeRainParticleIntensity(Number.POSITIVE_INFINITY), 0);
    assert.equal(normalizeRainParticleIntensity(-0.5), 0);
    assert.equal(normalizeRainParticleIntensity(0.5), 0.5);
    assert.equal(normalizeRainParticleIntensity(2), 1);
});

test('stops particles at the shader visibility threshold', () => {
    assert.deepEqual(
        resolveRainParticleState(rainParticleVisibilityThreshold, 1),
        {
            activeCount: 0,
            intensity: rainParticleVisibilityThreshold,
        },
    );
    assert.deepEqual(
        resolveRainParticleState(rainParticleVisibilityThreshold + 0.001, 1),
        {
            activeCount: 200,
            intensity: rainParticleVisibilityThreshold + 0.001,
        },
    );
});

test('preserves quality-scaled particle tiers while rain is visible', () => {
    assert.deepEqual(resolveRainParticleState(0.2, 0.5), {
        activeCount: 100,
        intensity: 0.2,
    });
    assert.deepEqual(resolveRainParticleState(0.5, 0.7), {
        activeCount: 420,
        intensity: 0.5,
    });
    assert.deepEqual(resolveRainParticleState(1, 1), {
        activeCount: 2000,
        intensity: 1,
    });
});

test('does not mount a zero-count particle system', () => {
    assert.deepEqual(resolveRainParticleState(1, 0), {
        activeCount: 0,
        intensity: 1,
    });
});
