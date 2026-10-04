import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    composeWeatherLayers,
    type WeatherDefinition,
} from './weatherComposition';
import { weatherDefinitions } from './weatherDefinitions';

test('all 42 provider codes have complete, unclipped day and night artwork', () => {
    assert.deepEqual(
        Object.keys(weatherDefinitions).map(Number),
        Array.from({ length: 42 }, (_, index) => index + 1),
    );
    for (const definition of Object.values(weatherDefinitions)) {
        for (const period of ['day', 'night'] satisfies ('day' | 'night')[]) {
            const layers = composeWeatherLayers(definition, period);
            assert.ok(layers.length > 0, `${definition.name} ${period}`);
            assert.equal(
                new Set(layers.map(({ id }) => id)).size,
                layers.length,
            );
            for (const layer of layers) {
                assert.ok(
                    layer.x >= 0 &&
                        layer.y >= 0 &&
                        layer.width > 0 &&
                        layer.height > 0,
                    `${definition.name}: ${layer.id}`,
                );
                assert.ok(
                    layer.x + layer.width <= 64 && layer.y + layer.height <= 64,
                    `${definition.name}: ${layer.id} escapes the viewBox`,
                );
            }
        }
    }
});

test('day and night preserve weather effects while changing celestial artwork', () => {
    for (const definition of Object.values(weatherDefinitions)) {
        const day = composeWeatherLayers(definition, 'day');
        const night = composeWeatherLayers(definition, 'night');
        assert.ok(!day.some(({ part }) => part === 'moon'));
        assert.ok(!night.some(({ part }) => part === 'sun'));
        assert.deepEqual(
            day.map(({ part }) => (part === 'sun' ? 'moon' : part)),
            night.map(({ part }) => part),
        );
    }
});

test('sleet codes always display both rain and snow with increasing intensity', () => {
    for (const family of [
        [
            weatherDefinitions[19],
            weatherDefinitions[20],
            weatherDefinitions[21],
        ],
        [
            weatherDefinitions[33],
            weatherDefinitions[34],
            weatherDefinitions[35],
        ],
    ]) {
        const counts = family.map((definition) => {
            const effects = composeWeatherLayers(definition, 'day').filter(
                ({ part }) => part === 'raindrop' || part === 'snowflake',
            );
            assert.ok(effects.some(({ part }) => part === 'raindrop'));
            assert.ok(effects.some(({ part }) => part === 'snowflake'));
            return effects.length;
        });
        assert.ok(counts[0] < counts[1] && counts[1] < counts[2]);
    }
});

test('snow with thunder and precipitation with fog retain both signals', () => {
    const combinations: [WeatherDefinition, string[]][] = [
        [weatherDefinitions[25], ['snowflake', 'lightning']],
        [weatherDefinitions[39], ['raindrop', 'fog']],
        [weatherDefinitions[40], ['snowflake', 'fog']],
        [weatherDefinitions[41], ['snowflake', 'fog']],
        [weatherDefinitions[42], ['raindrop', 'fog']],
    ];
    for (const [definition, expected] of combinations) {
        const parts = composeWeatherLayers(definition, 'day').map(
            ({ part }) => part,
        );
        for (const part of expected)
            assert.ok(
                parts.some((value) => value === part),
                `${definition.name} needs ${part}`,
            );
    }
});
