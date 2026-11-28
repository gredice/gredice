import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createGameProfileWeatherWitness,
    gameProfileFogWeather,
    gameProfileLightRainWeather,
    gameProfilePartlyCloudyWeather,
    gameProfileSnowIntegratedWeather,
    gameProfileSnowSparseWeather,
    readGameProfileWeatherTransitionRequest,
    resolveGameProfileCameraZoom,
    resolveGameProfileHiddenWeather,
    resolveGameProfileLightning,
    resolveGameProfileReducedMotion,
    resolveGameProfileWeatherDebug,
    resolveGameProfileWeatherTransition,
} from './profileWeather.ts';

test('committed input receipts preserve zero values and fresh cold input', () => {
    assert.deepEqual(createGameProfileWeatherWitness(undefined), {
        cloudy: 0,
        foggy: 0,
        rainy: 0,
        snowy: 0,
        snowAccumulation: 0,
        temperature: null,
        source: null,
        isStale: null,
    });
    const cold = createGameProfileWeatherWitness(
        resolveGameProfileWeatherTransition('clear-to-frost'),
    );
    assert.equal(cold.temperature, -4);
    assert.equal(cold.source, 'profile');
    assert.equal(cold.isStale, false);
    const malformedMetadata = {
        ...gameProfileSnowSparseWeather,
        source: 7,
        isStale: 'fresh',
    };
    const malformed = createGameProfileWeatherWitness(malformedMetadata);
    assert.equal(malformed.source, null);
    assert.equal(malformed.isStale, null);
});

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

test('weather restyle modes match the target presets', () => {
    assert.equal(gameProfilePartlyCloudyWeather.cloudy, 0.4);
    assert.equal(gameProfilePartlyCloudyWeather.windSpeed, 1);
    assert.equal(gameProfilePartlyCloudyWeather.rainy, 0);
    assert.equal(gameProfileLightRainWeather.cloudy, 0.85);
    assert.equal(gameProfileLightRainWeather.rainy, 0.6);
    assert.equal(gameProfileFogWeather.foggy, 1);
    assert.equal(gameProfileFogWeather.rainy, 0);
    assert.equal(gameProfileFogWeather.snowy, 0);
});

test('camera zoom accepts positive pixels per unit only', () => {
    assert.equal(resolveGameProfileCameraZoom('170'), 170);
    assert.equal(resolveGameProfileCameraZoom('75.5'), 75.5);
    assert.equal(resolveGameProfileCameraZoom(undefined), undefined);
    assert.equal(resolveGameProfileCameraZoom('0'), undefined);
    assert.equal(resolveGameProfileCameraZoom('far'), undefined);
});

test('weather debug switches parse strictly', () => {
    assert.equal(resolveGameProfileReducedMotion('1'), true);
    assert.equal(resolveGameProfileReducedMotion('0'), false);
    assert.equal(resolveGameProfileReducedMotion(undefined), undefined);
    assert.deepEqual(resolveGameProfileHiddenWeather('rain'), ['rain']);
    assert.deepEqual(resolveGameProfileHiddenWeather('sky, lightning,x'), [
        'lightning',
        'sky',
    ]);
    assert.deepEqual(resolveGameProfileHiddenWeather(undefined), []);
    assert.deepEqual(resolveGameProfileLightning('at:1.5'), {
        mode: 'at',
        seconds: 1.5,
    });
    assert.deepEqual(resolveGameProfileLightning('off'), { mode: 'off' });
    assert.equal(resolveGameProfileLightning('at:soon'), undefined);
    assert.equal(resolveGameProfileLightning(undefined), undefined);
});

test('weather debug options are omitted when no switch is set', () => {
    assert.equal(resolveGameProfileWeatherDebug({}), undefined);
    assert.deepEqual(
        resolveGameProfileWeatherDebug({
            hideWeather: 'rain',
            lightning: 'at:2',
            reducedMotion: '1',
            weatherInspect: '1',
        }),
        {
            reducedMotion: true,
            hide: ['rain'],
            lightning: { mode: 'at', seconds: 2 },
            inspect: true,
        },
    );
});
