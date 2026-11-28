import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveSkyBodyWeatherVisibility } from './skyBodyVisibility';

describe('sun and moon under weather', () => {
    it('shows the disc under a clear or partly cloudy sky', () => {
        assert.equal(
            resolveSkyBodyWeatherVisibility({ cloudy: 0, foggy: 0 }),
            1,
        );
        assert.equal(
            resolveSkyBodyWeatherVisibility({ cloudy: 0.4, foggy: 0 }),
            1,
        );
    });

    it('hides it under overcast, gone at cloudy 0.85, with no ghost floor', () => {
        const half = resolveSkyBodyWeatherVisibility({ cloudy: 0.7, foggy: 0 });
        assert.ok(half > 0.4 && half < 0.6);
        assert.equal(
            resolveSkyBodyWeatherVisibility({ cloudy: 0.85, foggy: 0 }),
            0,
        );
        assert.equal(
            resolveSkyBodyWeatherVisibility({ cloudy: 1, foggy: 0 }),
            0,
        );
    });

    it('hides it in fog from 0.3 to 0.8 and in falling snow', () => {
        assert.equal(
            resolveSkyBodyWeatherVisibility({ cloudy: 0, foggy: 0.3 }),
            1,
        );
        assert.equal(
            resolveSkyBodyWeatherVisibility({ cloudy: 0, foggy: 0.8 }),
            0,
        );
        assert.equal(
            resolveSkyBodyWeatherVisibility({
                cloudy: 0.2,
                foggy: 0,
                snowy: 0.7,
            }),
            0,
        );
    });
});
