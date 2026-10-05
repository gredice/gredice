import assert from 'node:assert/strict';
import test from 'node:test';
import { gardenTeaTableMugAnchors } from '@gredice/js/gardenTeaTable';
import {
    createSteamParticle,
    resolveSteamStrength,
    sampleSteamParticle,
    steamEmitterCaps,
    steamParticlesPerEmitter,
} from './steamMotion';

test('steam omits constrained tiers and caps the whole scene at 48 particles', () => {
    assert.equal(steamEmitterCaps.low, 0);
    assert.equal(steamEmitterCaps['auto-constrained'], 0);
    for (const cap of Object.values(steamEmitterCaps))
        assert(cap * steamParticlesPerEmitter <= 48);
});

test('weather and accessibility gates keep the static prop available', () => {
    const base = { enabled: true, reducedMotion: false, rain: 0, snow: 0 };
    assert.equal(resolveSteamStrength(base), 1);
    assert.equal(resolveSteamStrength({ ...base, rain: 1 }), 0.6);
    for (const override of [
        { enabled: false },
        { reducedMotion: true },
        { rain: 1.5 },
        { snow: 0.01 },
        { rain: Number.NaN },
    ]) {
        assert.equal(resolveSteamStrength({ ...base, ...override }), 0);
    }
});

test('frozen steam is repeatable and does not depend on intervening frames', () => {
    const particle = createSteamParticle('mug:left:17', 2);
    const first = sampleSteamParticle(particle, 12, 0.035, 3, 90);
    sampleSteamParticle(particle, 99, 0.035, 3, 90);
    assert.deepEqual(
        sampleSteamParticle(
            createSteamParticle('mug:left:17', 2),
            12,
            0.035,
            3,
            90,
        ),
        first,
    );
    assert.notDeepEqual(
        sampleSteamParticle(
            createSteamParticle('mug:right:17', 2),
            12,
            0.035,
            3,
            90,
        ),
        first,
    );
});

test('every puff stays above its authored rim and inside the tea-table footprint', () => {
    for (const anchor of gardenTeaTableMugAnchors) {
        for (let index = 0; index < steamParticlesPerEmitter; index++) {
            const particle = createSteamParticle(anchor.id, index);
            for (let step = 0; step <= 160; step++) {
                for (const wind of [0, 1, 3, 100, Number.NaN]) {
                    const sample = sampleSteamParticle(
                        particle,
                        step / 10,
                        anchor.radius,
                        wind,
                        step * 17,
                    );
                    assert(sample.y - sample.size / 2 >= 0.012 - 1e-9);
                    assert(sample.y + sample.size / 2 < 0.33);
                    assert(
                        Math.abs(anchor.position[0] + sample.x) +
                            sample.size / 2 <
                            0.4,
                    );
                    assert(
                        Math.abs(anchor.position[2] + sample.z) +
                            sample.size / 2 <
                            0.4,
                    );
                    assert(sample.opacity >= 0 && sample.opacity <= 0.3);
                }
            }
        }
    }
});
