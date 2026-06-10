import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createBeeWanderOffset,
    getBeeCount,
    getBeeDwellSeconds,
    getBeeHabitatGroups,
    getBeeSpawnHabitatGroups,
    getBeeWanderHoverSeconds,
    isBeeActive,
    isBeeDaytime,
    isBeeWeatherSuitable,
    shouldBeeWanderNext,
} from './beeBehavior';

const clearWeather = {
    cloudy: 0,
    foggy: 0,
    rainy: 0,
    snowy: 0,
    thundery: 0,
    windSpeed: 0,
};

test('keeps bees active during clear daytime weather', () => {
    assert.equal(isBeeDaytime(0.5), true);
    assert.equal(isBeeWeatherSuitable(clearWeather), true);
    assert.equal(isBeeActive(0.5, clearWeather), true);
});

test('allows sunny light-cloud conditions with low wind', () => {
    assert.equal(
        isBeeActive(0.5, {
            ...clearWeather,
            cloudy: 0.4,
            windSpeed: 1,
        }),
        true,
    );
});

test('keeps bees away at night and twilight edges', () => {
    assert.equal(isBeeActive(0.2, clearWeather), false);
    assert.equal(isBeeActive(0.8, clearWeather), false);
});

test('keeps bees away in heavy clouds, precipitation, fog, thunder, or wind', () => {
    assert.equal(isBeeActive(0.5, { ...clearWeather, cloudy: 0.6 }), false);
    assert.equal(isBeeActive(0.5, { ...clearWeather, rainy: 0.33 }), false);
    assert.equal(isBeeActive(0.5, { ...clearWeather, snowy: 0.33 }), false);
    assert.equal(isBeeActive(0.5, { ...clearWeather, foggy: 0.33 }), false);
    assert.equal(isBeeActive(0.5, { ...clearWeather, thundery: 1 }), false);
    assert.equal(isBeeActive(0.5, { ...clearWeather, windSpeed: 2 }), false);
});

test('scales bee count by ten-block flower habitats', () => {
    const closeFlowerTargets = [
        { id: 'a', position: { x: 0, z: 0 } },
        { id: 'b', position: { x: 0.5, z: 0.25 } },
        { id: 'c', position: { x: 8, z: 1 } },
    ];
    const distantFlowerTargets = [
        ...closeFlowerTargets,
        { id: 'd', position: { x: 10.1, z: 0 } },
        { id: 'e', position: { x: 21, z: 0 } },
    ];

    assert.equal(getBeeCount([]), 0);
    assert.equal(getBeeCount(closeFlowerTargets), 1);
    assert.equal(getBeeCount(distantFlowerTargets), 3);
});

test('groups nearby flowers into one bee habitat', () => {
    const groups = getBeeHabitatGroups([
        { id: 'a', position: { x: 0, z: 0 } },
        { id: 'b', position: { x: 9.9, z: 0 } },
        { id: 'c', position: { x: 10.1, z: 0 } },
    ]);

    assert.deepEqual(
        groups.map((group) => group.map((target) => target.id)),
        [['a', 'b'], ['c']],
    );
});

test('requires flower entity spawn targets before creating bee habitats', () => {
    const groups = getBeeSpawnHabitatGroups({
        spawnTargets: [],
        additionalTargets: [
            { id: 'raised-bed-flower', position: { x: 0, z: 0 } },
            { id: 'cactus-flower', position: { x: 1, z: 1 } },
        ],
    });

    assert.equal(groups.length, 0);
});

test('adds nearby non-spawn flowers to flower entity habitats', () => {
    const tulipTargets = [
        { id: 'tulip-a', position: { x: 0, z: 0 } },
        { id: 'tulip-b', position: { x: 0.3, z: 0.2 } },
    ];
    const groups = getBeeSpawnHabitatGroups({
        spawnTargets: tulipTargets,
        additionalTargets: [
            { id: 'raised-bed-flower', position: { x: 2, z: 2 } },
            { id: 'far-grass-flower', position: { x: 12, z: 0 } },
        ],
    });

    assert.deepEqual(
        groups.map((group) => group.map((target) => target.id)),
        [['tulip-a', 'tulip-b', 'raised-bed-flower']],
    );
});

test('uses short flower dwell windows', () => {
    assert.equal(
        getBeeDwellSeconds(() => 0),
        2.4,
    );
    assert.equal(
        getBeeDwellSeconds(() => 1),
        6,
    );
});

test('always wanders next when habitat has no other flowers', () => {
    assert.equal(
        shouldBeeWanderNext({
            otherFlowerCount: 0,
            currentlyWandering: false,
            random: () => 0.99,
        }),
        true,
    );
});

test('inserts wander between flower visits sometimes', () => {
    assert.equal(
        shouldBeeWanderNext({
            otherFlowerCount: 3,
            currentlyWandering: false,
            random: () => 0.1,
        }),
        true,
    );
    assert.equal(
        shouldBeeWanderNext({
            otherFlowerCount: 3,
            currentlyWandering: false,
            random: () => 0.9,
        }),
        false,
    );
});

test('chains wander hops less often than starting them', () => {
    assert.equal(
        shouldBeeWanderNext({
            otherFlowerCount: 2,
            currentlyWandering: true,
            random: () => 0.34,
        }),
        true,
    );
    assert.equal(
        shouldBeeWanderNext({
            otherFlowerCount: 2,
            currentlyWandering: true,
            random: () => 0.36,
        }),
        false,
    );
});

test('uses brief mid-air hover windows for wandering', () => {
    const minHover = getBeeWanderHoverSeconds(() => 0);
    const maxHover = getBeeWanderHoverSeconds(() => 1);
    assert.ok(minHover >= 0.19 && minHover <= 0.21);
    assert.ok(maxHover >= 0.59 && maxHover <= 0.61);
    assert.ok(minHover < maxHover);
});

test('wander offsets stay within a small habitat radius', () => {
    const minOffset = createBeeWanderOffset(() => 0);
    const maxOffset = createBeeWanderOffset(() => 0.999);
    assert.ok(Math.hypot(minOffset.dx, minOffset.dz) <= 1.61);
    assert.ok(Math.hypot(maxOffset.dx, maxOffset.dz) <= 5.41);
    assert.ok(minOffset.dy >= 0.5 && minOffset.dy <= 1.4);
    assert.ok(maxOffset.dy >= 0.5 && maxOffset.dy <= 1.4);
});
