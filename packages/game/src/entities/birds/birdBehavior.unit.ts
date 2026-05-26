import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getBirdActivityRange,
    getBirdBehaviorWeights,
    getBirdDwellSeconds,
    isBirdNight,
    pickBirdBehavior,
} from './birdBehavior';

test('uses a wider bird activity range during the day', () => {
    assert.equal(isBirdNight(0.5), false);
    assert.equal(getBirdActivityRange(0.5), 10);
    assert.equal(getBirdActivityRange(0.9), 3);
});

test('biases bird behavior toward home at night', () => {
    const dayWeights = getBirdBehaviorWeights(0.5, {
        air: true,
        circle: true,
        tree: true,
        entity: true,
        ground: true,
    });
    const nightWeights = getBirdBehaviorWeights(0.9, {
        air: true,
        circle: true,
        tree: true,
        entity: true,
        ground: true,
    });

    const dayHome = dayWeights.find((item) => item.behavior === 'home');
    const nightHome = nightWeights.find((item) => item.behavior === 'home');

    assert.ok(dayHome);
    assert.ok(nightHome);
    assert.ok(nightHome.weight > dayHome.weight * 3);
});

test('does not pick unavailable non-home behaviors', () => {
    const behavior = pickBirdBehavior(
        0.5,
        {
            air: false,
            circle: false,
            tree: false,
            entity: false,
            ground: false,
        },
        () => 0.99,
    );

    assert.equal(behavior, 'home');
});

test('does not include circling when tall blocks are unavailable', () => {
    const weights = getBirdBehaviorWeights(0.5, {
        air: true,
        circle: false,
        tree: true,
        entity: true,
        ground: true,
    });

    assert.equal(
        weights.some((item) => item.behavior === 'circle'),
        false,
    );
});

test('keeps birds at home longer at night', () => {
    const dayDwell = getBirdDwellSeconds('home', 0.5, () => 0);
    const nightDwell = getBirdDwellSeconds('home', 0.9, () => 0);

    assert.ok(nightDwell > dayDwell);
});

test('keeps daytime behavior windows between ten and thirty seconds', () => {
    const behaviors = [
        'home',
        'air',
        'circle',
        'tree',
        'entity',
        'ground',
    ] as const;

    for (const behavior of behaviors) {
        assert.equal(
            getBirdDwellSeconds(behavior, 0.5, () => 0),
            10,
        );
        assert.equal(
            getBirdDwellSeconds(behavior, 0.5, () => 1),
            30,
        );
    }
});
