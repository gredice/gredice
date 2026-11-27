import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    advanceWeatherBlend,
    getWeatherStormTarget,
    hasWeatherBlendConverged,
    resolveWeatherBlendTarget,
    resolveWeatherStorm,
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

    it('does not start a continuous blend for a wind direction change', () => {
        const target = {
            rainy: 0.5,
            thundery: 1,
            windDirection: 'S',
        };
        const state: WeatherBlendState = {
            isBlending: false,
            weather: {
                rainy: 0.5,
                thundery: 1,
                windDirection: 'N',
            },
        };

        assert.deepEqual(resolveWeatherBlendTarget(state, target, true), {
            isBlending: false,
            weather: target,
        });
    });

    it('damps the storm amount while thunder itself switches at once', () => {
        const clear = { cloudy: 1, rainy: 1, thundery: 0 };
        const storm = { cloudy: 1, rainy: 1, thundery: 1 };
        let state = resolveWeatherBlendTarget(
            { isBlending: false, weather: clear },
            storm,
            true,
        );

        assert.equal(state.isBlending, true);
        state = advanceWeatherBlend(state, storm, 1.2, 1 / 60);
        assert.equal(state.weather?.thundery, 1);
        const firstStorm = resolveWeatherStorm(state.weather);
        assert.ok(firstStorm > 0 && firstStorm < 0.05);

        let frames = 1;
        while (state.isBlending && frames < 1_000) {
            const before = resolveWeatherStorm(state.weather);
            state = advanceWeatherBlend(state, storm, 1.2, 1 / 60);
            assert.ok(resolveWeatherStorm(state.weather) >= before);
            frames += 1;
        }

        // Converges, snaps to the target and releases the render lease.
        assert.deepEqual(state, { isBlending: false, weather: storm });
        assert.equal(resolveWeatherStorm(state.weather), 1);
        assert.ok(frames > 30, `storm blended over ${frames} frames`);
    });

    it('fades the storm amount out after thunder stops', () => {
        const storm = { cloudy: 1, thundery: 1 };
        const after = { cloudy: 1, thundery: 0 };
        let state = resolveWeatherBlendTarget(
            { isBlending: false, weather: storm },
            after,
            true,
        );
        state = advanceWeatherBlend(state, after, 1.2, 0.5);

        assert.equal(state.weather?.thundery, 0);
        const fading = resolveWeatherStorm(state.weather);
        assert.ok(fading > 0.5 && fading < 1, `storm ${fading}`);
    });

    it('reads the storm amount from thunder when no blend carries it', () => {
        assert.equal(resolveWeatherStorm(undefined), 0);
        assert.equal(resolveWeatherStorm({ thundery: 1 }), 1);
        assert.equal(resolveWeatherStorm({ thundery: 3 }), 1);
        assert.equal(resolveWeatherStorm({ thundery: 1, storm: 0.25 }), 0.25);
        assert.equal(getWeatherStormTarget({ thundery: Number.NaN }), 0);
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
