import assert from 'node:assert/strict';
import test from 'node:test';
import {
    advanceSnowMotionOffset,
    clampSnowParticleCount,
    createSnowParticleAttributes,
    resolveSnowParticleCounts,
    resolveSnowWeatherMotion,
} from './snowParticles';

test('resolves stable capacities and active counts from quality and intensity', () => {
    assert.deepEqual(resolveSnowParticleCounts(1, 0.3), {
        activeCount: 1500,
        capacity: 1500,
    });
    assert.deepEqual(resolveSnowParticleCounts(0.7, 0.6), {
        activeCount: 2100,
        capacity: 3000,
    });
    assert.deepEqual(resolveSnowParticleCounts(1, 1), {
        activeCount: 5000,
        capacity: 5000,
    });
    assert.deepEqual(resolveSnowParticleCounts(1, 0.45), {
        activeCount: 2250,
        capacity: 2250,
    });
    assert.deepEqual(resolveSnowParticleCounts(-1, 2), {
        activeCount: 0,
        capacity: 5000,
    });
});

test('clamps active particles to the allocated capacity', () => {
    assert.equal(clampSnowParticleCount(2100, 3000), 2100);
    assert.equal(clampSnowParticleCount(4000, 3000), 3000);
    assert.equal(clampSnowParticleCount(-1, 3000), 0);
});

test('creates capacity-sized random-only snow attributes', () => {
    const attributes = createSnowParticleAttributes({
        capacity: 2,
        flakeSize: 0.08,
        heightRange: 15,
        random: () => 0.5,
        size: 30,
    });

    assert.equal(attributes.baseAttributes.length, 8);
    assert.equal(attributes.motionAttributes.length, 8);
    assert.equal(attributes.shapeAttributes.length, 8);
    assert.equal(attributes.baseAttributes[3], Math.fround(0.95));
    assert.equal(attributes.motionAttributes[0], 0);
    assert.equal(attributes.motionAttributes[1], 0);
    assert.equal(attributes.shapeAttributes[0], Math.fround(0.08));
});

test('resolves cardinal wind velocities using the existing scene convention', () => {
    const north = resolveSnowWeatherMotion({
        gravity: 0.002,
        windDirection: 0,
        windSpeed: 2,
    });
    const east = resolveSnowWeatherMotion({
        gravity: 0.002,
        windDirection: 90,
        windSpeed: 2,
    });

    assert.ok(Math.abs(north.windVelocityX) < 1e-12);
    assert.equal(north.windVelocityZ, -0.6);
    assert.equal(east.windVelocityX, 0.6);
    assert.ok(Math.abs(east.windVelocityZ) < 1e-12);
    assert.ok(Math.abs(north.fallVelocity - 0.72) < 1e-12);
});

test('rebases motion offsets continuously and wraps negative motion', () => {
    const singleStep = advanceSnowMotionOffset(2, 1.5, 4, 5);
    const firstHalf = advanceSnowMotionOffset(2, 1.5, 2, 5);
    const twoSteps = advanceSnowMotionOffset(firstHalf, 1.5, 2, 5);

    assert.equal(singleStep, 3);
    assert.equal(twoSteps, singleStep);
    assert.equal(advanceSnowMotionOffset(0.25, -1, 1, 5), 4.25);
});
