import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    butterflyPopulationLimits,
    butterflyWingVariants,
    canSpawnButterfly,
    createButterflySpawnDescriptor,
    createSeededButterflyRandom,
    getButterflyAvatarAvoidanceOffset,
    getButterflyLifecycleDecision,
    isButterflyActive,
} from './butterflyBehavior';

const clearWeather = {
    cloudy: 0,
    foggy: 0,
    rainy: 0,
    snowy: 0,
    thundery: 0,
    windSpeed: 0,
};

describe('butterfly behavior', () => {
    it('does not use Math.random in spawn or render-time butterfly code', () => {
        for (const path of [
            new URL('./Butterflies.tsx', import.meta.url).href,
            new URL('./butterflyBehavior.ts', import.meta.url).href,
        ]) {
            const source = readFileSync(fileURLToPath(path), 'utf8');
            assert.equal(source.includes('Math.random'), false);
        }
    });

    it('provides at least seven clearly distinct authored wing variants', () => {
        assert.ok(butterflyWingVariants.length >= 7);
        assert.equal(
            new Set(butterflyWingVariants.map((variant) => variant.id)).size,
            butterflyWingVariants.length,
        );
        assert.equal(
            new Set(
                butterflyWingVariants.map(
                    (variant) => `${variant.primary}:${variant.secondary}`,
                ),
            ).size,
            butterflyWingVariants.length,
        );
    });

    it('replays the seeded random stream exactly', () => {
        const first = createSeededButterflyRandom(42);
        const second = createSeededButterflyRandom(42);
        assert.deepEqual(
            Array.from({ length: 8 }, () => first()),
            Array.from({ length: 8 }, () => second()),
        );
    });

    it('chooses a spawn variant once and keeps the descriptor stable', () => {
        const input = {
            bornAt: 10,
            gardenId: 4,
            habitatId: 'habitat-a',
            spawnSequence: 3,
            targetCount: 5,
        };
        const first = createButterflySpawnDescriptor(input);
        const replay = createButterflySpawnDescriptor(input);

        assert.deepEqual(first, replay);
        assert.ok(
            butterflyWingVariants.some(
                (variant) => variant.id === first.variantId,
            ),
        );
        assert.ok(first.expiresAt > first.bornAt);
    });

    it('uses different deterministic spawn identities across a sequence', () => {
        const variants = Array.from({ length: 24 }, (_, spawnSequence) =>
            createButterflySpawnDescriptor({
                bornAt: 0,
                gardenId: 1,
                habitatId: 'meadow',
                spawnSequence,
                targetCount: 3,
            }),
        );
        assert.equal(new Set(variants.map((spawn) => spawn.id)).size, 24);
        assert.ok(new Set(variants.map((spawn) => spawn.variantId)).size >= 7);
        assert.ok(new Set(variants.map((spawn) => spawn.flapRate)).size > 12);
        assert.ok(
            new Set(variants.map((spawn) => spawn.flapAmplitude)).size > 12,
        );
    });

    it('requires suitable daylight and mild weather', () => {
        assert.equal(isButterflyActive(0.5, clearWeather), true);
        assert.equal(isButterflyActive(0.2, clearWeather), false);
        assert.equal(
            isButterflyActive(0.5, { ...clearWeather, rainy: 0.2 }),
            false,
        );
        assert.equal(
            isButterflyActive(0.5, { ...clearWeather, windSpeed: 2 }),
            false,
        );
        assert.equal(
            isButterflyActive(0.5, { ...clearWeather, temperature: 7 }),
            false,
        );
        assert.equal(
            isButterflyActive(0.5, { ...clearWeather, temperature: 24 }),
            true,
        );
    });

    it('enforces global, habitat, and cooldown caps independently', () => {
        const twoInHabitat = [{ habitatId: 'a' }, { habitatId: 'a' }];
        assert.equal(
            canSpawnButterfly({
                activeSpawns: twoInHabitat,
                habitatId: 'a',
                lastSpawnAt: null,
                now: 100,
            }),
            false,
        );
        assert.equal(
            canSpawnButterfly({
                activeSpawns: Array.from(
                    { length: butterflyPopulationLimits.global },
                    (_, index) => ({ habitatId: `h-${index}` }),
                ),
                habitatId: 'new',
                lastSpawnAt: null,
                now: 100,
            }),
            false,
        );
        assert.equal(
            canSpawnButterfly({
                activeSpawns: [],
                habitatId: 'a',
                lastSpawnAt: 90,
                now: 100,
            }),
            false,
        );
        assert.equal(
            canSpawnButterfly({
                activeSpawns: [],
                habitatId: 'a',
                lastSpawnAt: 80,
                now: 100,
            }),
            true,
        );
    });

    it('departs and then despawns after lifetime or lost habitat', () => {
        assert.equal(
            getButterflyLifecycleDecision({
                expiresAt: 20,
                habitatAvailable: true,
                now: 19,
                unsuitableSince: null,
            }),
            'active',
        );
        assert.equal(
            getButterflyLifecycleDecision({
                expiresAt: 20,
                habitatAvailable: true,
                now: 21,
                unsuitableSince: null,
            }),
            'depart',
        );
        assert.equal(
            getButterflyLifecycleDecision({
                expiresAt: 20,
                habitatAvailable: true,
                now: 24,
                unsuitableSince: null,
            }),
            'despawn',
        );
        assert.equal(
            getButterflyLifecycleDecision({
                expiresAt: 200,
                habitatAvailable: false,
                now: 30,
                unsuitableSince: null,
            }),
            'depart',
        );
    });

    it('gently pushes flight away from a nearby avatar', () => {
        const nearby = getButterflyAvatarAvoidanceOffset({
            avatarPosition: { x: 0, y: 0, z: 0 },
            butterflyPosition: { x: 0.25, y: 0.6, z: 0 },
        });
        const distant = getButterflyAvatarAvoidanceOffset({
            avatarPosition: { x: 0, y: 0, z: 0 },
            butterflyPosition: { x: 3, y: 0.6, z: 0 },
        });

        assert.ok(nearby.x > 0);
        assert.ok(nearby.y > 0);
        assert.deepEqual(distant, { x: 0, y: 0, z: 0 });
    });
});
