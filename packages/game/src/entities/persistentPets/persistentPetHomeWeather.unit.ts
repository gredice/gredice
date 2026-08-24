import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { persistentPetHomeSpecs } from './persistentPetHomes';
import { getPersistentPetHomeSurfaceWeather } from './persistentPetHomeWeather';

describe('persistent pet home weather', () => {
    it('enables rain and snow on solid surfaces for all five homes', () => {
        const homeNames = Object.keys(persistentPetHomeSpecs);

        assert.equal(homeNames.length, 5);
        for (const homeName of homeNames) {
            const weather = getPersistentPetHomeSurfaceWeather(
                `${homeName}_Walls`,
            );

            assert.ok(weather.rain.darkness > 0, homeName);
            assert.ok(weather.rain.glossiness > 0, homeName);
            assert.ok(weather.snow.coverageMultiplier > 0, homeName);
            assert.ok(weather.snow.maxThickness > 0, homeName);
        }
    });

    it('gives exposed roofs heavier snow than other solid surfaces', () => {
        const wall = getPersistentPetHomeSurfaceWeather('RabbitHutch_Walls');
        const roof = getPersistentPetHomeSurfaceWeather('RabbitHutch_Roof');

        assert.ok(roof.snow.coverageMultiplier > wall.snow.coverageMultiplier);
        assert.ok(roof.snow.maxThickness > wall.snow.maxThickness);
        assert.deepEqual(roof.rain, wall.rain);
    });
});
