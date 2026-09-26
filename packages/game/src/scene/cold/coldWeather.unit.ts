import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Object3D } from 'three';
import { BreathSourceRegistry } from './BreathSources';
import { breathCaps, getBreathCycle, resolveColdWeather } from './coldWeather';

test('warm, missing, invalid and stale temperatures never imply cold from the season', () => {
    for (const weather of [
        undefined,
        {},
        { temperature: null },
        { temperature: 12 },
        { temperature: NaN },
        { temperature: Infinity },
        { temperature: -4, isStale: true },
        { temperature: -4, source: 'fallback' },
        { temperature: -4, rainy: NaN },
    ]) {
        assert.deepEqual(resolveColdWeather(weather, 'high'), {
            frost: 0,
            breath: 0,
        });
    }
});
test('freezing dry weather adds frost, precipitation replaces it, and breath has a separate threshold', () => {
    assert.deepEqual(resolveColdWeather({ temperature: -4 }, 'high'), {
        frost: 1,
        breath: 1,
    });
    assert.equal(resolveColdWeather({ temperature: 0 }, 'high').frost, 0);
    assert.equal(resolveColdWeather({ temperature: 4 }, 'high').breath, 1 / 7);
    for (const precipitation of [
        { rainy: 0.2 },
        { rainy: 1 },
        { snowy: 1 },
        { snowAccumulation: 3 },
    ]) {
        assert.deepEqual(
            resolveColdWeather({ temperature: -4, ...precipitation }, 'high'),
            { frost: 0, breath: 1 },
        );
    }
    assert.equal(
        resolveColdWeather({ temperature: -4, snowAccumulation: 1.5 }, 'high')
            .frost,
        0.5,
    );
});
test('quality and weather disablement provide an explicit zero-cost fallback', () => {
    for (const tier of ['low', 'auto-constrained'] as const) {
        assert.deepEqual(resolveColdWeather({ temperature: -10 }, tier), {
            frost: 0,
            breath: 0,
        });
        assert.equal(breathCaps[tier], 0);
    }
    assert.deepEqual(resolveColdWeather({ temperature: -10 }, 'high', false), {
        frost: 0,
        breath: 0,
    });
    assert.equal(Math.max(...Object.values(breathCaps)), 8);
});
test('breath is seeded, bounded and repeats at a frozen scene time', () => {
    const samples = Array.from({ length: 1000 }, (_, i) =>
        getBreathCycle('Sheep:7', i / 10),
    );
    assert.deepEqual(
        samples,
        Array.from({ length: 1000 }, (_, i) =>
            getBreathCycle('Sheep:7', i / 10),
        ),
    );
    assert.notDeepEqual(samples[0], getBreathCycle('Goat:9', 0));
    assert.ok(samples.filter((s) => s.opacity > 0).length < 300);
    for (const sample of samples) {
        assert.ok(sample.opacity >= 0 && sample.opacity <= 0.22);
        assert.ok(sample.size >= 0.08 && sample.size <= 0.31);
    }
});
test('scene-owned sources sort stably and release listeners and actors', () => {
    const registry = new BreathSourceRegistry();
    let changes = 0;
    const unsubscribe = registry.subscribe(() => changes++);
    const releaseB = registry.register('b', new Object3D());
    const releaseA = registry.register('a', new Object3D());
    assert.deepEqual(
        registry.getSnapshot().map((s) => s.id),
        ['a', 'b'],
    );
    releaseA();
    releaseB();
    assert.equal(registry.getSnapshot().length, 0);
    assert.equal(changes, 4);
    unsubscribe();
    registry.register('c', new Object3D());
    assert.equal(changes, 4);
});
