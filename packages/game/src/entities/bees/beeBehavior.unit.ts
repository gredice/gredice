import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getBeeCount,
    getBeeDwellSeconds,
    isBeeActive,
    isBeeDaytime,
    isBeeWeatherSuitable,
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

test('scales bee count by available flower targets', () => {
    assert.equal(getBeeCount(0), 0);
    assert.equal(getBeeCount(1), 1);
    assert.equal(getBeeCount(6), 1);
    assert.equal(getBeeCount(7), 2);
    assert.equal(getBeeCount(50), 4);
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
