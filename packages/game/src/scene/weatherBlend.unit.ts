import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    advanceWeatherBlend,
    hasWeatherBlendConverged,
    resolveWeatherBlendTarget,
    type WeatherBlendState,
} from './weatherBlend';

describe('weather blending', () => {
    it('keeps blending when a small frame step is still far from the target', () => {
        const state: WeatherBlendState = {
            isBlending: true,
            weather: { rainy: 0.98 },
        };

        const next = advanceWeatherBlend(state, { rainy: 1 }, 1.2, 1 / 60);

        assert.equal(next.isBlending, true);
        assert.notEqual(next, state);
        assert.equal(
            hasWeatherBlendConverged(next.weather ?? {}, { rainy: 1 }),
            false,
        );
    });

    it('snaps exactly to the target and releases the blend after convergence', () => {
        const target = {
            cloudy: 0,
            rainy: 0,
            snowy: 0,
            windDirection: 'NE',
        };
        let state: WeatherBlendState = {
            isBlending: true,
            weather: {
                cloudy: 1,
                rainy: 1,
                snowy: 1,
                windDirection: 'N',
            },
        };

        for (let frame = 0; frame < 1_000 && state.isBlending; frame += 1) {
            state = advanceWeatherBlend(state, target, 1.2, 1 / 30);
        }

        assert.deepEqual(state, {
            isBlending: false,
            weather: target,
        });
        assert.equal(state.weather?.rainy, 0);
        assert.equal(state.weather?.snowy, 0);
        assert.equal(advanceWeatherBlend(state, target, 1.2, 1 / 30), state);
    });

    it('does not start a continuous blend for discrete-only changes', () => {
        const target = {
            rainy: 0.5,
            thundery: 1,
            windDirection: 'S',
        };
        const state: WeatherBlendState = {
            isBlending: false,
            weather: {
                rainy: 0.5,
                thundery: 0,
                windDirection: 'N',
            },
        };

        assert.deepEqual(resolveWeatherBlendTarget(state, target, true), {
            isBlending: false,
            weather: target,
        });
    });

    it('snaps and stays idle when blending is disabled', () => {
        const target = { snowy: 0.8 };
        const state: WeatherBlendState = {
            isBlending: true,
            weather: { snowy: 0.2 },
        };

        assert.deepEqual(resolveWeatherBlendTarget(state, target, false), {
            isBlending: false,
            weather: target,
        });
    });
});
