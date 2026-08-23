import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getFarmAnimalActivityRange,
    getFarmAnimalBehaviorWeights,
    getFarmAnimalDwellSeconds,
    isFarmAnimalAdverseWeather,
    isFarmAnimalNight,
    pickFarmAnimalBehavior,
} from './farmAnimalBehavior';

const clearWeather = {
    cloudy: 0,
    foggy: 0,
    rainy: 0,
    snowy: 0,
    thundery: 0,
    windSpeed: 0,
};

test('returns every farm animal home at night', () => {
    assert.equal(isFarmAnimalNight(0.5), false);
    assert.equal(isFarmAnimalNight(0.85), true);

    for (const species of ['Chicken', 'Goat', 'Piglet'] as const) {
        assert.equal(
            pickFarmAnimalBehavior({
                species,
                availability: {
                    roam: true,
                    forage: true,
                    'dust-bathe': true,
                    root: true,
                    wallow: true,
                    browse: true,
                    chew: true,
                    'play-hop': true,
                    cover: true,
                },
                random: () => 0.99,
                timeOfDay: 0.85,
                weather: clearWeather,
            }),
            'home',
        );
    }
});

test('returns each species home in weather that is adverse for it', () => {
    assert.equal(isFarmAnimalAdverseWeather('Chicken', { rainy: 0.3 }), true);
    assert.equal(isFarmAnimalAdverseWeather('Piglet', { rainy: 0.3 }), false);
    assert.equal(isFarmAnimalAdverseWeather('Goat', { rainy: 0.3 }), false);
    assert.equal(isFarmAnimalAdverseWeather('Goat', { snowy: 0.2 }), true);
    assert.equal(isFarmAnimalAdverseWeather('Piglet', { thundery: 0.2 }), true);

    assert.equal(
        pickFarmAnimalBehavior({
            species: 'Chicken',
            availability: { cover: true, forage: true, roam: true },
            random: () => 0.5,
            timeOfDay: 0.5,
            weather: { rainy: 0.3 },
        }),
        'home',
    );
    assert.equal(
        pickFarmAnimalBehavior({
            species: 'Piglet',
            availability: { cover: true, root: true, wallow: true },
            random: () => 0.5,
            timeOfDay: 0.5,
            weather: { thundery: 0.2 },
        }),
        'home',
    );
});

test('uses only species-specific daytime behaviors', () => {
    const chickenWeights = getFarmAnimalBehaviorWeights({
        species: 'Chicken',
        availability: {},
    });
    const pigletWeights = getFarmAnimalBehaviorWeights({
        species: 'Piglet',
        availability: {},
    });
    const goatWeights = getFarmAnimalBehaviorWeights({
        species: 'Goat',
        availability: {},
    });

    assert.deepEqual(
        chickenWeights.map(({ behavior }) => behavior),
        ['home', 'roam', 'forage', 'dust-bathe', 'cover'],
    );
    assert.deepEqual(
        goatWeights.map(({ behavior }) => behavior),
        ['home', 'roam', 'browse', 'chew', 'play-hop', 'cover'],
    );
    assert.deepEqual(
        pigletWeights.map(({ behavior }) => behavior),
        ['home', 'roam', 'root', 'wallow', 'cover'],
    );
});

test('picks species-specific activities from the same deterministic roll', () => {
    const commonArguments = {
        availability: {},
        random: () => 0.72,
        timeOfDay: 0.5,
        weather: clearWeather,
    };

    assert.equal(
        pickFarmAnimalBehavior({
            ...commonArguments,
            species: 'Goat',
        }),
        'chew',
    );
    assert.equal(
        pickFarmAnimalBehavior({
            ...commonArguments,
            species: 'Chicken',
        }),
        'dust-bathe',
    );
    assert.equal(
        pickFarmAnimalBehavior({
            ...commonArguments,
            species: 'Piglet',
        }),
        'wallow',
    );
});

test('filters unavailable targets and always keeps home available', () => {
    assert.deepEqual(
        getFarmAnimalBehaviorWeights({
            species: 'Chicken',
            availability: {
                roam: false,
                forage: false,
                'dust-bathe': false,
                cover: false,
            },
        }).map(({ behavior }) => behavior),
        ['home'],
    );
    assert.equal(
        pickFarmAnimalBehavior({
            species: 'Piglet',
            availability: {
                roam: false,
                root: false,
                wallow: false,
                cover: false,
            },
            random: () => 0.99,
            timeOfDay: 0.5,
            weather: clearWeather,
        }),
        'home',
    );
});

test('follows the avatar only in safe daytime conditions', () => {
    assert.equal(
        pickFarmAnimalBehavior({
            species: 'Piglet',
            availability: { 'follow-avatar': true },
            followingAvatar: true,
            random: () => 0,
            timeOfDay: 0.5,
            weather: clearWeather,
        }),
        'follow-avatar',
    );
    assert.equal(
        pickFarmAnimalBehavior({
            species: 'Piglet',
            availability: { 'follow-avatar': true },
            followingAvatar: true,
            random: () => 0,
            timeOfDay: 0.5,
            weather: { thundery: 0.2 },
        }),
        'home',
    );
});

test('shrinks activity range around home at night and in adverse weather', () => {
    assert.equal(
        getFarmAnimalActivityRange({
            species: 'Goat',
            timeOfDay: 0.5,
            weather: clearWeather,
        }),
        7.5,
    );
    assert.equal(
        getFarmAnimalActivityRange({
            species: 'Chicken',
            timeOfDay: 0.5,
            weather: clearWeather,
        }),
        5.5,
    );
    assert.equal(
        getFarmAnimalActivityRange({
            species: 'Chicken',
            timeOfDay: 0.5,
            weather: { rainy: 0.3 },
        }),
        1.1,
    );
    assert.equal(
        getFarmAnimalActivityRange({
            species: 'Piglet',
            timeOfDay: 0.9,
            weather: clearWeather,
        }),
        1.4,
    );
});

test('uses short active dwells and longer home rests', () => {
    assert.equal(
        getFarmAnimalDwellSeconds({
            species: 'Goat',
            behavior: 'browse',
            random: () => 0,
            timeOfDay: 0.5,
            weather: clearWeather,
        }),
        5,
    );
    assert.equal(
        getFarmAnimalDwellSeconds({
            species: 'Chicken',
            behavior: 'forage',
            random: () => 0,
            timeOfDay: 0.5,
            weather: clearWeather,
        }),
        4,
    );
    assert.equal(
        getFarmAnimalDwellSeconds({
            species: 'Chicken',
            behavior: 'forage',
            random: () => 1,
            timeOfDay: 0.5,
            weather: clearWeather,
        }),
        8,
    );
    assert.equal(
        getFarmAnimalDwellSeconds({
            species: 'Piglet',
            behavior: 'wallow',
            random: () => 0,
            timeOfDay: 0.5,
            weather: clearWeather,
        }),
        7,
    );
    assert.equal(
        getFarmAnimalDwellSeconds({
            species: 'Piglet',
            behavior: 'home',
            random: () => 0,
            timeOfDay: 0.9,
            weather: clearWeather,
        }),
        26,
    );
    assert.equal(
        getFarmAnimalDwellSeconds({
            species: 'Piglet',
            behavior: 'follow-avatar',
            random: () => 1,
            timeOfDay: 0.5,
            weather: clearWeather,
        }),
        1,
    );
});
