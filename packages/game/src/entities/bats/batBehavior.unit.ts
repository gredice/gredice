import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    BatPopulationRegistry,
    batPopulationCaps,
    createBatRandom,
    hashBatSeed,
    isBatActive,
    isBatNight,
    planBatPopulation,
    resolveBatLifecyclePhase,
    shouldBatGlide,
} from './batBehavior';

const calmWeather = {
    foggy: 0.1,
    rainy: 0,
    snowy: 0,
    thundery: 0,
    windSpeed: 2,
};

describe('bat environment activity', () => {
    it('is active only across the configured dusk and night window', () => {
        assert.equal(isBatNight(0.27), true);
        assert.equal(isBatNight(0.271), false);
        assert.equal(isBatNight(0.729), false);
        assert.equal(isBatNight(0.73), true);
        assert.equal(isBatActive(0.82, calmWeather), true);
        assert.equal(isBatActive(0.5, calmWeather), false);
    });

    it('stays hidden in unsuitable precipitation, fog, storms, or wind', () => {
        assert.equal(isBatActive(0.82, undefined), false);
        assert.equal(isBatActive(0.82, { ...calmWeather, rainy: 0.13 }), false);
        assert.equal(isBatActive(0.82, { ...calmWeather, snowy: 0.09 }), false);
        assert.equal(
            isBatActive(0.82, { ...calmWeather, thundery: 0.09 }),
            false,
        );
        assert.equal(isBatActive(0.82, { ...calmWeather, foggy: 0.69 }), false);
        assert.equal(
            isBatActive(0.82, { ...calmWeather, windSpeed: 7.01 }),
            false,
        );
    });

    it('returns to cover before becoming hidden when activity ends', () => {
        assert.equal(
            resolveBatLifecyclePhase({
                active: false,
                phase: 'foraging',
                reachedTarget: false,
            }),
            'returning',
        );
        assert.equal(
            resolveBatLifecyclePhase({
                active: false,
                phase: 'returning',
                reachedTarget: true,
            }),
            'hidden',
        );
        assert.equal(
            resolveBatLifecyclePhase({
                active: true,
                phase: 'hidden',
                reachedTarget: false,
            }),
            'emerging',
        );
    });
});

describe('bat deterministic population planning', () => {
    it('repeats seeded spawn and glide decisions exactly', () => {
        const seed = hashBatSeed('garden-17', '2026-08-23', 2);
        const first = createBatRandom(seed);
        const second = createBatRandom(seed);
        assert.deepEqual(
            Array.from({ length: 12 }, () => first()),
            Array.from({ length: 12 }, () => second()),
        );

        const glideFirst = createBatRandom(seed);
        const glideSecond = createBatRandom(seed);
        assert.deepEqual(
            Array.from({ length: 14 }, (_, index) =>
                shouldBatGlide(glideFirst, index),
            ),
            Array.from({ length: 14 }, (_, index) =>
                shouldBatGlide(glideSecond, index),
            ),
        );
        assert.equal(
            shouldBatGlide(() => 0, 1),
            false,
        );
        assert.equal(
            shouldBatGlide(() => 0, 2),
            true,
        );
    });

    it('enforces scene, group, group-count, and shared global caps', () => {
        const plan = planBatPopulation({
            availableSlots: 99,
            habitatSeeds: [11, 22, 33, 44],
        });
        assert.ok(plan.length <= batPopulationCaps.groupsPerScene);
        assert.ok(
            plan.every((group) => group.count <= batPopulationCaps.group),
        );
        assert.ok(
            plan.reduce((total, group) => total + group.count, 0) <=
                batPopulationCaps.scene,
        );

        const registry = new BatPopulationRegistry();
        assert.equal(registry.claim('scene-a', 3), 3);
        assert.equal(registry.claim('scene-a', 1), 3);
        assert.equal(registry.claim('scene-b', 3), 3);
        assert.equal(registry.claim('scene-c', 3), 0);
        assert.equal(registry.total(), batPopulationCaps.global);
        registry.release('scene-a');
        assert.equal(registry.claim('scene-c', 3), 3);
        assert.equal(registry.total(), batPopulationCaps.global);
    });
});
