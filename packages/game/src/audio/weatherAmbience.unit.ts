import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveWeatherAmbience } from './weatherAmbienceState';

test('rain and time boundaries are continuous and the total mix is bounded', () => {
    for (const time of [
        0, 0.13, 0.15, 0.17, 0.28, 0.3, 0.32, 0.78, 0.8, 0.82, 1,
    ]) {
        for (let rain = 0; rain <= 1; rain += 0.01) {
            const layers = resolveWeatherAmbience(time, { rainy: rain });
            const nearby = resolveWeatherAmbience(time + 0.000001, {
                rainy: rain + 0.000001,
            });
            assert(
                layers.reduce((total, layer) => total + layer.gain, 0) <= 0.9,
            );
            layers.forEach((layer, index) => {
                assert(layer.gain >= 0 && layer.gain <= 1);
                assert(Math.abs(layer.gain - nearby[index].gain) < 0.0001);
            });
        }
    }
    assert.deepEqual(
        resolveWeatherAmbience(0, undefined),
        resolveWeatherAmbience(1, undefined),
    );
});

test('storms retain day/night ambience while crossfading rain layers', () => {
    const day = resolveWeatherAmbience(0.5, { rainy: 1 });
    assert(day.find((layer) => layer.name === 'Day Rain 01')?.gain);
    assert.equal(
        day.find((layer) => layer.name === 'Rain Heavy 01')?.gain,
        0.55,
    );
    const night = resolveWeatherAmbience(0.9, { rainy: 0.5 });
    assert(night.find((layer) => layer.name === 'Night 01')?.gain);
    assert(night.find((layer) => layer.name === 'Mod Rain Light 01')?.gain);
    assert(night.find((layer) => layer.name === 'Mod Rain Medium 01')?.gain);
});

test('snowfall and accumulation muffle the bed without removing it or adding rain', () => {
    const clear = resolveWeatherAmbience(0.5, undefined);
    for (const weather of [{ snowy: 1 }, { snowAccumulation: 30 }]) {
        const snow = resolveWeatherAmbience(0.5, weather);
        assert(snow[1].gain > 0 && snow[1].gain < clear[1].gain);
        assert.equal(
            snow.slice(3).reduce((sum, layer) => sum + layer.gain, 0),
            0,
        );
    }
});

test('invalid and out-of-range weather cannot produce invalid gains', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -100, 100]) {
        const layers = resolveWeatherAmbience(value, {
            rainy: value,
            snowy: value,
            snowAccumulation: value,
        });
        assert(
            layers.every(
                ({ gain }) => Number.isFinite(gain) && gain >= 0 && gain <= 1,
            ),
        );
    }
});
