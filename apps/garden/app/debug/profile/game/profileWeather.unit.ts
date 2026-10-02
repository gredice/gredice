import assert from 'node:assert/strict';
import test from 'node:test';
import {
    gameProfileSnowIntegratedWeather,
    gameProfileSnowSparseWeather,
    readGameProfileWeatherTransitionRequest,
    resolveGameProfileWeatherTransition,
} from './profileWeather.ts';

test('snow surface transition requests remain particle-free and deterministic', () => {
    assert.equal(
        readGameProfileWeatherTransitionRequest({
            request: 'snow-sparse-to-integrated',
        }),
        'snow-sparse-to-integrated',
    );
    assert.equal(
        readGameProfileWeatherTransitionRequest({
            request: 'snow-integrated-to-sparse',
        }),
        'snow-integrated-to-sparse',
    );
    assert.equal(
        resolveGameProfileWeatherTransition('snow-sparse-to-integrated'),
        gameProfileSnowIntegratedWeather,
    );
    assert.equal(
        resolveGameProfileWeatherTransition('snow-integrated-to-sparse'),
        gameProfileSnowSparseWeather,
    );
    assert.equal(gameProfileSnowSparseWeather.snowy, 0);
    assert.equal(gameProfileSnowIntegratedWeather.snowy, 0);
    assert.equal(gameProfileSnowSparseWeather.snowAccumulation, 0.75);
    assert.equal(gameProfileSnowIntegratedWeather.snowAccumulation, 24);
});

test('weather transition parser rejects unknown requests', () => {
    assert.equal(
        readGameProfileWeatherTransitionRequest({
            request: 'snow-unknown',
        }),
        undefined,
    );
});

test('cache clearance weather requests exercise rain and fresh frost without snowfall', () => {
    for (const request of [
        'clear-to-rain',
        'clear-to-frost',
        'frost-to-clear',
    ]) {
        assert.equal(
            readGameProfileWeatherTransitionRequest({ request }),
            request,
        );
    }
    const rain = resolveGameProfileWeatherTransition('clear-to-rain');
    assert.equal(rain.rainy, 1);
    const frost = resolveGameProfileWeatherTransition('clear-to-frost');
    assert.equal('temperature' in frost && frost.temperature, -4);
    assert.equal('source' in frost && frost.source, 'profile');
    assert.equal('isStale' in frost && frost.isStale, false);
    assert.equal(frost.snowAccumulation, 0);
    assert.equal(frost.snowy, 0);
    const clear = resolveGameProfileWeatherTransition('frost-to-clear');
    assert.equal('temperature' in clear && clear.temperature, 12);
});
