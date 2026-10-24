import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createLeafStepCadence,
    type LeafStepSample,
    leafStepMinimumInterval,
} from './leafStepState';

function sample(distance: number, time: number): LeafStepSample {
    return { distance, time, x: distance, y: 0.4, z: 0, grounded: true };
}
function walk(speed = 2.15, fps = 60) {
    const cadence = createLeafStepCadence('garden:2024');
    const sounds = [];
    for (let frame = 0; frame < fps * 10; frame++) {
        const time = frame / fps;
        const step = cadence.update(sample(time * speed, time));
        if (step) sounds.push({ time, ...step });
    }
    return sounds;
}
test('walking, crouching and running have seeded sparse contacts and a bounded rate', () => {
    for (const speed of [0.55, 0.63, 2.15, 4.68]) {
        for (const fps of [20, 30, 60, 120]) {
            const sounds = walk(speed, fps);
            assert(sounds.length > 0 && sounds.length < 36);
            assert.deepEqual(walk(speed, fps), sounds);
            assert(new Set(sounds.map((step) => step.variant)).size > 1);
            sounds.forEach((step, index) => {
                assert(step.volume >= 0.16 && step.volume <= 0.23);
                if (index)
                    assert(
                        step.time - sounds[index - 1].time >=
                            leafStepMinimumInterval,
                    );
            });
        }
    }
    assert(walk(0.63).length < walk().length);
});
test('idle/camera frames, blocked movement and airborne movement never step', () => {
    for (const mode of ['idle', 'blocked', 'airborne', 'frozen']) {
        const cadence = createLeafStepCadence(mode);
        for (let frame = 0; frame < 300; frame++) {
            const value = sample(frame * 0.03, frame / 60);
            if (mode === 'idle' || mode === 'blocked') value.x = 0;
            if (mode === 'idle') value.distance = 0;
            if (mode === 'airborne') value.grounded = false;
            if (mode === 'frozen') value.time = 12;
            assert.equal(cadence.update(value), null, mode);
        }
    }
});
test('spawn, teleport, resume, clock rewind and reset discard contact backlog', () => {
    const cadence = createLeafStepCadence('reset');
    assert.equal(cadence.update(sample(100, 0)), null);
    assert.equal(cadence.update(sample(200, 0.016)), null);
    assert.equal(cadence.update(sample(200.1, 50)), null);
    assert.equal(cadence.update(sample(200.2, 0)), null);
    cadence.reset();
    assert.equal(cadence.update(sample(300, 10)), null);
    assert.equal(
        cadence.update({ ...sample(300.1, 10.02), grounded: false }),
        null,
    );
    assert.equal(cadence.update(sample(300.2, 10.04)), null);
});
