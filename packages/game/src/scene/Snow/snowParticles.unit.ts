import assert from 'node:assert/strict';
import test from 'node:test';
import {
    advanceSnowFieldMotion,
    advanceSnowMotionOffset,
    clampSnowParticleCount,
    createSnowFieldMotion,
    createSnowFlakeSeeds,
    createSnowParticleAttributes,
    resolveSnowFieldDrift,
    resolveSnowFieldGeometry,
    resolveSnowFieldMotionSeconds,
    resolveSnowParticleCounts,
    resolveSnowSparkleCount,
    resolveSnowSparkleSpots,
    resolveSnowWeatherMotion,
    snowFieldStyle,
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

test('fixed scene seeds reproduce every snow attribute independently of other field creation', () => {
    const options = {
        capacity: 8,
        flakeSize: 0.08,
        heightRange: 15,
        size: 30,
        seed: 43_200,
    };
    const first = createSnowParticleAttributes(options);
    const other = createSnowParticleAttributes({ ...options, seed: 0 });
    const repeated = createSnowParticleAttributes(options);
    assert.deepEqual(first, repeated);
    assert.notDeepEqual(first.baseAttributes, other.baseAttributes);
    const larger = createSnowParticleAttributes({ ...options, capacity: 16 });
    assert.deepEqual(
        first.baseAttributes,
        larger.baseAttributes.slice(0, first.baseAttributes.length),
    );
    assert.deepEqual(
        first.motionAttributes,
        larger.motionAttributes.slice(0, first.motionAttributes.length),
    );
    assert.deepEqual(
        first.shapeAttributes,
        larger.shapeAttributes.slice(0, first.shapeAttributes.length),
    );
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

test('restyled flakes keep the GAME_ART sizes, speeds and spin', () => {
    assert.deepEqual(snowFieldStyle.discSizesPx, [7, 9.5, 12.5]);
    assert.deepEqual(snowFieldStyle.iconSizePx, [20, 26]);
    assert.equal(snowFieldStyle.iconSpin, 0.6);
    assert.equal(snowFieldStyle.reducedMotionRate, 0.25);
    // 55 to 90 px/s at zoom 100 on a 1280 × 800 view (field scale 1).
    const [base, spread] = snowFieldStyle.discFallFactor;
    const slowest = snowFieldStyle.fallSpeed * base * 100;
    const fastest = snowFieldStyle.fallSpeed * (base + spread) * 100;
    assert.ok(slowest >= 55 && slowest <= 57, `slowest ${slowest}`);
    assert.ok(fastest >= 86 && fastest <= 90, `fastest ${fastest}`);
});

test('sizes the snow field to the view so flakes keep their pixel size', () => {
    const reference = resolveSnowFieldGeometry({
        halfHeight: 4,
        halfWidth: 6.4,
        pixelsPerUnit: 100,
    });
    assert.equal(reference.scale, 1);
    assert.deepEqual(reference.box, [14.3, 10, 10]);
    assert.equal(reference.unitsPerPixel, 0.01);
    assert.equal(reference.perspective, false);

    const close = resolveSnowFieldGeometry({
        halfHeight: 400 / 170,
        halfWidth: 640 / 170,
        pixelsPerUnit: 170,
    });
    // The fall speed scales with the field, so it stays about 70 px/s.
    const pixelsPerSecond = snowFieldStyle.fallSpeed * close.scale * 170;
    assert.ok(Math.abs(pixelsPerSecond - 70) < 0.5);
    assert.ok(Math.abs(close.unitsPerPixel - 1 / 170) < 1e-12);

    assert.equal(
        resolveSnowFieldGeometry({
            halfHeight: 0.5,
            halfWidth: 0.5,
            pixelsPerUnit: 800,
        }).scale,
        0.35,
    );
    const avatar = resolveSnowFieldGeometry(null);
    assert.equal(avatar.perspective, true);
    assert.equal(avatar.scale, 1);
});

test('seeds flakes deterministically and keeps the first flakes on growth', () => {
    const small = createSnowFlakeSeeds(10, 'weather-snow-discs');
    const large = createSnowFlakeSeeds(20, 'weather-snow-discs');
    const other = createSnowFlakeSeeds(10, 'weather-snow-icons');
    assert.equal(small.length, 40);
    assert.deepEqual(Array.from(small), Array.from(large.slice(0, 40)));
    assert.notDeepEqual(Array.from(small), Array.from(other));
    assert.ok(Array.from(large).every((value) => value >= 0 && value < 1));
    // Size classes spread across the flakes (50%, 35%, 15%).
    const sizes = createSnowFlakeSeeds(4000, 'weather-snow-discs');
    let smallCount = 0;
    let largeCount = 0;
    for (let index = 3; index < sizes.length; index += 4) {
        if (sizes[index] < 0.5) smallCount++;
        else if (sizes[index] >= 0.85) largeCount++;
    }
    assert.ok(Math.abs(smallCount / 4000 - 0.5) < 0.03);
    assert.ok(Math.abs(largeCount / 4000 - 0.15) < 0.03);
});

test('rebases the snow clock so flakes never jump when speeds change', () => {
    let motion = createSnowFieldMotion(10);
    motion = advanceSnowFieldMotion(motion, 10, {
        rate: 1,
        velocityX: 0.2,
        velocityZ: 0,
    });
    assert.equal(resolveSnowFieldMotionSeconds(motion, 14), 4);
    const before = resolveSnowFieldDrift(
        motion,
        resolveSnowFieldMotionSeconds(motion, 14),
    );
    // Reduced motion and a wind change at t = 14: position is continuous.
    const slowed = advanceSnowFieldMotion(motion, 14, {
        rate: 0.25,
        velocityX: 0.5,
        velocityZ: -0.1,
    });
    assert.equal(resolveSnowFieldMotionSeconds(slowed, 14), 4);
    const after = resolveSnowFieldDrift(
        slowed,
        resolveSnowFieldMotionSeconds(slowed, 14),
    );
    assert.ok(Math.abs(before.x - after.x) < 1e-12);
    assert.ok(Math.abs(before.z - after.z) < 1e-12);
    // Then the clock runs at 25%.
    assert.equal(resolveSnowFieldMotionSeconds(slowed, 18), 5);
    const later = resolveSnowFieldDrift(slowed, 5);
    assert.ok(Math.abs(later.x - (0.8 + 0.5)) < 1e-12);
    assert.ok(Math.abs(later.z - -0.1) < 1e-12);
    // A clock that went back never runs backwards.
    assert.equal(resolveSnowFieldMotionSeconds(slowed, 2), 4);
});

test('sparkles twinkle only on full cover and never under reduced motion', () => {
    assert.equal(resolveSnowSparkleCount(14, 1, false), 14);
    assert.equal(resolveSnowSparkleCount(10, 1, false), 10);
    assert.equal(resolveSnowSparkleCount(7, 1, false), 7);
    assert.equal(resolveSnowSparkleCount(14, 0.3, false), 0);
    assert.equal(resolveSnowSparkleCount(14, 0.65, false), 7);
    assert.equal(resolveSnowSparkleCount(14, 1, true), 0);
    assert.equal(resolveSnowSparkleCount(14, Number.NaN, false), 0);
});

test('places sparkles on open terrain tops only, spread over the garden', () => {
    const heights: Record<string, number> = {
        Block_Grass: 0.4,
        Block_Water: 0.3,
        Raised_Bed: 0.6,
    };
    const blockHeight = (name: string) => heights[name] ?? 0;
    const stacks = [
        { blocks: [{ name: 'Block_Grass' }], position: { x: 1, y: 0, z: 0 } },
        {
            blocks: [{ name: 'Block_Grass' }, { name: 'Block_Grass' }],
            position: { x: 0, y: 0, z: 0 },
        },
        { blocks: [{ name: 'Block_Water' }], position: { x: 2, y: 0, z: 0 } },
        {
            blocks: [{ name: 'Block_Grass' }, { name: 'Raised_Bed' }],
            position: { x: 3, y: 0, z: 0 },
        },
        { blocks: [], position: { x: 4, y: 0, z: 0 } },
    ];
    assert.deepEqual(resolveSnowSparkleSpots(stacks, blockHeight), [
        { x: 0, y: 0.8, z: 0 },
        { x: 1, y: 0.4, z: 0 },
    ]);

    const many = Array.from({ length: 200 }, (_, index) => ({
        blocks: [{ name: 'Block_Grass' }],
        position: { x: index % 20, y: 0, z: Math.floor(index / 20) },
    }));
    const spread = resolveSnowSparkleSpots(many, blockHeight, 64);
    assert.equal(spread.length, 64);
    assert.ok(spread.some((spot) => spot.x <= 1));
    assert.ok(spread.some((spot) => spot.x >= 18));
});
