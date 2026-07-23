import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MathUtils } from 'three';
import {
    resolveRainPuddleStrength,
    resolveRainSurfaceTarget,
    resolveSnowSurfaceTarget,
    WeatherSurfaceUniformRegistry,
    type WeatherSurfaceUniformStats,
} from './weatherSurfaceUniforms';

describe('weather surface targets', () => {
    it('preserves snow multiplier, clamp, and override behavior', () => {
        assert.equal(
            resolveSnowSurfaceTarget(0.4, {
                coverageMultiplier: 1.5,
                overrideSnow: undefined,
            }),
            0.6000000000000001,
        );
        assert.equal(
            resolveSnowSurfaceTarget(0.8, {
                coverageMultiplier: 2,
                overrideSnow: undefined,
            }),
            1,
        );
        assert.equal(
            resolveSnowSurfaceTarget(1, {
                coverageMultiplier: 0.5,
                overrideSnow: 0.3,
            }),
            0.15,
        );
        assert.equal(
            resolveSnowSurfaceTarget(-1, {
                coverageMultiplier: 1,
                overrideSnow: undefined,
            }),
            0,
        );
    });

    it('preserves rain multiplier, clamp, and puddle behavior', () => {
        assert.equal(
            resolveRainSurfaceTarget(0.4, { intensityMultiplier: 1.5 }),
            0.6000000000000001,
        );
        assert.equal(
            resolveRainSurfaceTarget(0.8, { intensityMultiplier: 2 }),
            1,
        );
        assert.equal(
            resolveRainSurfaceTarget(-1, { intensityMultiplier: 1 }),
            0,
        );
        assert.equal(resolveRainPuddleStrength(0.5), 0);
        assert.equal(
            resolveRainPuddleStrength(1),
            Math.max(0, 1 - 0.66) / 0.34,
        );
    });
});

describe('WeatherSurfaceUniformRegistry', () => {
    it('shares one snow update across consumers with identical dynamics', () => {
        const registry = new WeatherSurfaceUniformRegistry();
        const options = {
            coverageMultiplier: 1.5,
            overrideSnow: undefined,
        };
        const first = registry.getSnowEntry(options);
        const second = registry.getSnowEntry(options);

        assert.equal(first, second);
        const releaseFirst = registry.retain(first);
        const releaseSecond = registry.retain(second);
        assert.deepEqual(registry.getStats(), {
            rainConsumerCount: 0,
            rainDistinctUniformCount: 0,
            snowConsumerCount: 2,
            snowDistinctUniformCount: 1,
        });

        registry.advance({ rainAmount: 0, snowCoverage: 0.6 }, 1 / 30);

        assert.equal(
            first.uniform.value,
            MathUtils.damp(0, 0.8999999999999999, 6, 1 / 30),
        );

        releaseFirst();
        releaseSecond();
    });

    it('keeps distinct snow and rain dynamics in separate uniforms', () => {
        const registry = new WeatherSurfaceUniformRegistry();
        const snowDefault = registry.getSnowEntry({
            coverageMultiplier: 1,
            overrideSnow: undefined,
        });
        const snowOverride = registry.getSnowEntry({
            coverageMultiplier: 1,
            overrideSnow: 0.7,
        });
        const rainDefault = registry.getRainEntry({
            drySpeed: 1.8,
            intensityMultiplier: 1,
            wetSpeed: 5,
        });
        const rainSlow = registry.getRainEntry({
            drySpeed: 1.8,
            intensityMultiplier: 1,
            wetSpeed: 3,
        });

        registry.retain(snowDefault);
        registry.retain(snowOverride);
        registry.retain(rainDefault);
        registry.retain(rainSlow);

        assert.notEqual(snowDefault.uniform, snowOverride.uniform);
        assert.notEqual(rainDefault.uniform, rainSlow.uniform);
        assert.deepEqual(registry.getStats(), {
            rainConsumerCount: 2,
            rainDistinctUniformCount: 2,
            snowConsumerCount: 2,
            snowDistinctUniformCount: 2,
        });
    });

    it('uses wet speed while rising and dry speed while falling', () => {
        const registry = new WeatherSurfaceUniformRegistry();
        const entry = registry.getRainEntry({
            drySpeed: 1.8,
            intensityMultiplier: 1,
            wetSpeed: 5,
        });
        registry.retain(entry);

        registry.advance({ rainAmount: 1, snowCoverage: 0 }, 0.1);
        const wetValue = MathUtils.damp(0, 1, 5, 0.1);
        assert.equal(entry.uniform.value, wetValue);

        registry.advance({ rainAmount: 0, snowCoverage: 0 }, 0.1);
        assert.equal(
            entry.uniform.value,
            MathUtils.damp(wetValue, 0, 1.8, 0.1),
        );
        assert.equal(registry.rainPuddleStrengthUniform.value, 0);
    });

    it('skips inactive entries and resets them for a later mount', () => {
        const registry = new WeatherSurfaceUniformRegistry();
        const entry = registry.getSnowEntry({
            coverageMultiplier: 1,
            overrideSnow: undefined,
        });
        const release = registry.retain(entry);

        registry.advance({ rainAmount: 0, snowCoverage: 1 }, 0.1);
        assert.notEqual(entry.uniform.value, 0);

        release();
        const inactiveValue = entry.uniform.value;
        registry.advance({ rainAmount: 0, snowCoverage: 0 }, 0.1);
        assert.equal(entry.uniform.value, inactiveValue);
        assert.deepEqual(registry.getStats(), {
            rainConsumerCount: 0,
            rainDistinctUniformCount: 0,
            snowConsumerCount: 0,
            snowDistinctUniformCount: 0,
        });

        registry.retain(entry);
        assert.equal(entry.uniform.value, 0);
    });

    it('publishes consumer and distinct-uniform counts on retain and release', () => {
        const snapshots: WeatherSurfaceUniformStats[] = [];
        const registry = new WeatherSurfaceUniformRegistry((stats) => {
            snapshots.push(stats);
        });
        const entry = registry.getRainEntry({
            drySpeed: 1.8,
            intensityMultiplier: 1,
            wetSpeed: 5,
        });

        const release = registry.retain(entry);
        release();
        release();

        assert.deepEqual(snapshots, [
            {
                rainConsumerCount: 1,
                rainDistinctUniformCount: 1,
                snowConsumerCount: 0,
                snowDistinctUniformCount: 0,
            },
            {
                rainConsumerCount: 0,
                rainDistinctUniformCount: 0,
                snowConsumerCount: 0,
                snowDistinctUniformCount: 0,
            },
        ]);
    });
});
