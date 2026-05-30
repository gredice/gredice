import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getCatActivityRange,
    getCatBehaviorWeights,
    getCatDwellSeconds,
    isCatHighSun,
    isCatNight,
    pickCatBehavior,
    shouldCatSeekCover,
} from './catBehavior';

test('keeps cats close to the pillow at night', () => {
    assert.equal(isCatNight(0.9), true);
    assert.equal(getCatActivityRange(0.9, null), 1.7);
    assert.equal(
        pickCatBehavior({
            availability: {
                cover: true,
                roam: true,
                'low-entity': true,
                'stalk-bird': true,
            },
            random: () => 0,
            timeOfDay: 0.9,
            weather: null,
        }),
        'pillow',
    );
});

test('sends cats to cover in rain and high sun', () => {
    assert.equal(shouldCatSeekCover(0.5, { rainy: 0.5 }), true);
    assert.equal(isCatHighSun(0.5, { cloudy: 0.1 }), true);
    assert.equal(
        pickCatBehavior({
            availability: { cover: true },
            random: () => 0.99,
            timeOfDay: 0.5,
            weather: { rainy: 0.4 },
        }),
        'cover',
    );
});

test('falls back to the pillow when shelter is unavailable', () => {
    assert.equal(
        pickCatBehavior({
            availability: { cover: false },
            random: () => 0,
            timeOfDay: 0.5,
            weather: { rainy: 0.6 },
        }),
        'pillow',
    );
});

test('prioritizes grounded birds during normal daytime behavior', () => {
    assert.equal(
        pickCatBehavior({
            availability: {
                'stalk-bird': true,
                cover: true,
                roam: true,
                'low-entity': true,
            },
            random: () => 0.1,
            timeOfDay: 0.35,
            weather: { cloudy: 0.5 },
        }),
        'stalk-bird',
    );
});

test('does not include unavailable optional behaviors', () => {
    const weights = getCatBehaviorWeights({
        cover: false,
        roam: false,
        'low-entity': false,
        'stalk-bird': false,
    });

    assert.deepEqual(
        weights.map((item) => item.behavior),
        ['pillow'],
    );
});

test('keeps night pillow naps longer than daytime roam windows', () => {
    const nightPillowDwell = getCatDwellSeconds({
        behavior: 'pillow',
        random: () => 0,
        timeOfDay: 0.9,
        weather: null,
    });
    const dayRoamDwell = getCatDwellSeconds({
        behavior: 'roam',
        random: () => 1,
        timeOfDay: 0.5,
        weather: { cloudy: 0.5 },
    });

    assert.ok(nightPillowDwell > dayRoamDwell);
});
