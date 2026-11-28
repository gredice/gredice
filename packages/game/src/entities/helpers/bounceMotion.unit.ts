import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    type BouncePivot,
    type BouncePose,
    bounceMotions,
    bouncePoseTransform,
    fallConfig,
    hoverPopConfig,
    hoverPopScale,
    popTransform,
    riseConfig,
    settleConfig,
    springOvershoot,
    springSettleSeconds,
    springStepResponse,
    squashScale,
} from './bounceMotion';

const popSettleSeconds = 0.45;

test('squash and stretch keep the volume of the block', () => {
    for (const motion of Object.values(bounceMotions)) {
        for (const amount of [-motion.squash, motion.stretch]) {
            const { side, up } = squashScale(amount);
            // GAME_ART's first-order rule: within 2.5% at the deepest squash.
            assert.ok(Math.abs(side * side * up - 1) < 0.025);
        }
    }
    assert.deepEqual(squashScale(Number.NaN), { side: 1, up: 1 });
});

test('a harvest drops in like a placed block, without placement dust', () => {
    const { particles: harvestParticles, ...harvest } = bounceMotions.harvest;
    const { particles: dropParticles, ...drop } = bounceMotions.drop;
    assert.deepEqual(harvest, drop);
    assert.equal(harvestParticles, false);
    assert.equal(dropParticles, true);
});

test('the analytic spring matches its closed-form overshoot', () => {
    let peak = 0;
    for (let t = 0; t < 2; t += 0.0005)
        peak = Math.max(peak, springStepResponse(settleConfig, t));
    assert.ok(Math.abs(peak - 1 - springOvershoot(settleConfig)) < 0.002);
    assert.equal(springStepResponse(settleConfig, 0), 0);
    assert.equal(springStepResponse(settleConfig, -1), 0);
});

test('clamped rise and fall springs never overshoot', () => {
    for (const config of [riseConfig, fallConfig]) {
        assert.equal(springOvershoot(config), 0);
        for (let t = 0; t < 1; t += 0.01)
            assert.ok(springStepResponse(config, t) <= 1);
    }
});

test('a hop and a fall end on contact instead of creeping in', () => {
    for (const config of [riseConfig, fallConfig]) {
        // Underdamped, so the clamp stops the spring where it first arrives.
        assert.ok(springOvershoot({ ...config, clamp: false }) > 0);
        let arrived = 0;
        for (let t = 0.001; t < 1 && arrived === 0; t += 0.001)
            if (springStepResponse(config, t) >= 1) arrived = t;
        assert.ok(arrived > 0.04 && arrived < 0.1);
    }
});

test('a clamped fall never clamps the wobble that follows it', () => {
    // react-spring merges each config into the one the spring last ran with.
    const landing = { ...riseConfig, ...fallConfig, ...settleConfig };
    assert.equal(landing.clamp, false);
    assert.ok(springOvershoot(landing) > 0);
    const hover = { ...fallConfig, ...hoverPopConfig };
    assert.equal(hover.clamp, false);
});

test('the landing wobble settles within a pop', () => {
    assert.ok(springOvershoot(settleConfig) > 0);
    assert.ok(springSettleSeconds(settleConfig) < popSettleSeconds);
    // The squash stays visible for a few frames before it springs back.
    let recovered = 0;
    for (let t = 0.001; t < 1 && recovered === 0; t += 0.001)
        if (springStepResponse(settleConfig, t) >= 1) recovered = t;
    assert.ok(recovered > 0.06 && recovered < 0.12);
    // The rebound after the deepest squash is a gentle stretch, not a hop.
    const deepest = Math.max(
        ...Object.values(bounceMotions).map((motion) => motion.squash),
    );
    assert.ok(deepest * springOvershoot(settleConfig) < 0.05);
});

test('hover pops to 1.06-1.09, overshoots a little and settles in time', () => {
    assert.ok(hoverPopScale >= 1.06 && hoverPopScale <= 1.09);
    const step = hoverPopScale - 1;
    const peak = 1 + step * (1 + springOvershoot(hoverPopConfig));
    // The pop is visible as an overshoot but stays a gentle one.
    assert.ok(peak > hoverPopScale);
    assert.ok(peak <= 1.1);
    assert.ok(springSettleSeconds(hoverPopConfig) < popSettleSeconds);
    // Within 450 ms the scale reads as the hover size.
    const settled = 1 + step * springStepResponse(hoverPopConfig, 0.45);
    assert.ok(Math.abs(settled - hoverPopScale) < 0.003);
});

test('a bounce squashes toward the point the block stands on', () => {
    const pivot: BouncePivot = [2.5, 1, -3];
    const poses: BouncePose[] = [
        [0, -0.16],
        [0.16, 0.07],
        [0.14, 0.07],
        [0, 0],
    ];
    for (const pose of poses) {
        const t = bouncePoseTransform(pose, pivot);
        // The pivot maps to itself, lifted by the pose's height offset.
        assert.ok(
            Math.abs(t.positionX + t.scaleSide * pivot[0] - pivot[0]) < 1e-9,
        );
        assert.ok(
            Math.abs(
                t.positionY + t.scaleUp * pivot[1] - (pivot[1] + pose[0]),
            ) < 1e-9,
        );
        assert.ok(
            Math.abs(t.positionZ + t.scaleSide * pivot[2] - pivot[2]) < 1e-9,
        );
        assert.deepEqual(
            { side: t.scaleSide, up: t.scaleUp },
            squashScale(pose[1]),
        );
    }
    // At rest the group is the identity transform.
    const rest = bouncePoseTransform([0, 0], pivot);
    assert.equal(rest.scaleSide, 1);
    assert.equal(rest.scaleUp, 1);
    assert.ok(
        Math.abs(rest.positionX) +
            Math.abs(rest.positionY) +
            Math.abs(rest.positionZ) <
            1e-12,
    );
});

test('bounce transforms are linear, so springs on each value stay in step', () => {
    const pivot: BouncePivot = [-4, 0.5, 1.25];
    const from = bouncePoseTransform([0.16, 0.07], pivot);
    const to = bouncePoseTransform([0, -0.16], pivot);
    const keys: (keyof typeof from)[] = [
        'positionX',
        'positionY',
        'positionZ',
        'scaleSide',
        'scaleUp',
    ];
    for (const progress of [0.25, 0.5, 1.13]) {
        const expected = bouncePoseTransform(
            [0.16 + (0 - 0.16) * progress, 0.07 + (-0.16 - 0.07) * progress],
            pivot,
        );
        for (const key of keys) {
            const blended = from[key] + (to[key] - from[key]) * progress;
            assert.ok(Math.abs(blended - expected[key]) < 1e-9);
        }
    }
});

test('the hover pop grows about the base of the toy', () => {
    const pivot: BouncePivot = [-3.98, 0, -0.007];
    const pop = popTransform(hoverPopScale, pivot);
    assert.equal(pop.scale, hoverPopScale);
    const axes: ['positionX' | 'positionY' | 'positionZ', 0 | 1 | 2][] = [
        ['positionX', 0],
        ['positionY', 1],
        ['positionZ', 2],
    ];
    for (const [axis, index] of axes) {
        assert.ok(
            Math.abs(pop[axis] + pop.scale * pivot[index] - pivot[index]) <
                1e-9,
        );
    }
    const rest = popTransform(1, pivot);
    assert.equal(rest.scale, 1);
    assert.ok(
        Math.abs(rest.positionX) +
            Math.abs(rest.positionY) +
            Math.abs(rest.positionZ) <
            1e-12,
    );
    assert.equal(popTransform(Number.NaN, pivot).scale, 1);
});
