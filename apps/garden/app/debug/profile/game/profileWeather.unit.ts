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
