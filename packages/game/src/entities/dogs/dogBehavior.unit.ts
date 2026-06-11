import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getCatActivityRange,
    getCatBehaviorWeights,
    getCatDwellSeconds,
} from '../cats/catBehavior';
import {
    getDogActivityRange,
    getDogBehaviorWeights,
    getDogDwellSeconds,
    isDogHighSun,
    isDogNight,
    pickDogBehavior,
    shouldDogSeekCover,
} from './dogBehavior';

test('lets dogs roam farther than cats during the day and night', () => {
    assert.equal(isDogNight(0.9), true);
    assert.ok(getDogActivityRange(0.5, null) > getCatActivityRange(0.5, null));
    assert.ok(getDogActivityRange(0.9, null) > getCatActivityRange(0.9, null));
});

test('keeps doghouse sleep optional at night', () => {
    assert.equal(
        pickDogBehavior({
            availability: {
                cover: true,
                roam: true,
                'low-entity': true,
                'chase-bird': true,
            },
            random: () => 0,
            timeOfDay: 0.9,
            weather: null,
        }),
        'doghouse',
    );
    assert.equal(
        pickDogBehavior({
            availability: {
                cover: true,
                roam: true,
                'low-entity': true,
                'chase-bird': true,
            },
            random: () => 0.99,
            timeOfDay: 0.9,
            weather: null,
        }),
        'roam',
    );
});

test('sends dogs to cover in heavier rain and high sun', () => {
    assert.equal(shouldDogSeekCover(0.5, { rainy: 0.5 }), true);
    assert.equal(isDogHighSun(0.5, { cloudy: 0.1 }), true);
    assert.equal(
        pickDogBehavior({
            availability: { cover: true },
            random: () => 0.99,
            timeOfDay: 0.5,
            weather: { rainy: 0.4 },
        }),
        'cover',
    );
});

test('falls back to the doghouse when shelter is unavailable', () => {
    assert.equal(
        pickDogBehavior({
            availability: { cover: false },
            random: () => 0,
            timeOfDay: 0.5,
            weather: { rainy: 0.6 },
        }),
        'doghouse',
    );
});

test('prioritizes grounded birds during normal daytime behavior', () => {
    assert.equal(
        pickDogBehavior({
            availability: {
                'chase-bird': true,
                cover: true,
                roam: true,
                'low-entity': true,
            },
            random: () => 0.1,
            timeOfDay: 0.35,
            weather: { cloudy: 0.5 },
        }),
        'chase-bird',
    );
});

test('keeps doghouse returns rarer than cat pillow returns', () => {
    const dogWeights = getDogBehaviorWeights({
        cover: true,
        roam: true,
        'low-entity': true,
        'chase-bird': true,
    });
    const catWeights = getCatBehaviorWeights({
        cover: true,
        roam: true,
        'low-entity': true,
        'stalk-bird': true,
    });
    const dogWeightByBehavior = new Map(
        dogWeights.map((item) => [item.behavior, item.dayWeight]),
    );
    const catWeightByBehavior = new Map(
        catWeights.map((item) => [item.behavior, item.dayWeight]),
    );

    assert.ok(
        (dogWeightByBehavior.get('doghouse') ?? 0) <
            (catWeightByBehavior.get('pillow') ?? 0),
    );
    assert.ok(
        (dogWeightByBehavior.get('roam') ?? 0) >
            (catWeightByBehavior.get('roam') ?? 0),
    );
});

test('keeps doghouse naps shorter than cat pillow naps', () => {
    const dogNightDoghouseDwell = getDogDwellSeconds({
        behavior: 'doghouse',
        random: () => 1,
        timeOfDay: 0.9,
        weather: null,
    });
    const catNightPillowDwell = getCatDwellSeconds({
        behavior: 'pillow',
        random: () => 0,
        timeOfDay: 0.9,
        weather: null,
    });

    assert.ok(dogNightDoghouseDwell <= catNightPillowDwell);
});
