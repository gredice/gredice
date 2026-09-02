import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MathUtils } from 'three';
import {
    canIntegrateSnowSurface,
    resolveRainPuddleStrength,
    resolveRainSurfaceTarget,
    resolveSnowSurfaceIntegrationReadiness,
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

    it('keeps sparse snow on the legacy overlay until noise gaps close', () => {
        assert.equal(
            canIntegrateSnowSurface(0.025, {
                coverageMultiplier: 1.5,
                noiseInfluence: 0.15,
                overrideSnow: undefined,
            }),
            false,
        );
        assert.equal(
            canIntegrateSnowSurface(0.8, {
                coverageMultiplier: 0.9,
                noiseInfluence: 0.15,
                overrideSnow: undefined,
            }),
            true,
        );
        assert.equal(
            canIntegrateSnowSurface(0, {
                coverageMultiplier: 1,
                noiseInfluence: 0.15,
                overrideSnow: 0.3,
            }),
            true,
        );
    });

    it('uses a safe activation margin and a safe hysteresis exit', () => {
        assert.equal(
            resolveSnowSurfaceIntegrationReadiness({
                amount: 0.269,
                noiseInfluence: 0.15,
                wasReady: false,
            }),
            false,
        );
        assert.equal(
            resolveSnowSurfaceIntegrationReadiness({
                amount: 0.28,
                noiseInfluence: 0.15,
                wasReady: false,
            }),
            true,
        );
        assert.equal(
            resolveSnowSurfaceIntegrationReadiness({
                amount: 0.251,
                noiseInfluence: 0.15,
                wasReady: true,
            }),
            true,
        );
        assert.equal(
            resolveSnowSurfaceIntegrationReadiness({
                amount: 0.249,
                noiseInfluence: 0.15,
                wasReady: true,
            }),
            false,
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
            snowIntegrationReadyCount: 0,
            snowIntegrationTrackedCount: 0,
            snowIntegrationTransitionCount: 0,
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
            snowIntegrationReadyCount: 0,
            snowIntegrationTrackedCount: 0,
            snowIntegrationTransitionCount: 0,
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

    it('reports weather targets as settling before the first animated step', () => {
        const registry = new WeatherSurfaceUniformRegistry();
        const rain = registry.getRainEntry({
            drySpeed: 1.8,
            intensityMultiplier: 1,
            wetSpeed: 5,
        });
        const snow = registry.getSnowEntry({
            coverageMultiplier: 1,
            overrideSnow: undefined,
        });
        registry.retain(rain);
        registry.retain(snow);

        registry.advance({ rainAmount: 0.8, snowCoverage: 0.6 }, 0);

        assert.equal(rain.uniform.value, 0);
        assert.equal(snow.uniform.value, 0);
        assert.deepEqual(registry.getActivitySnapshot(), {
            rainActive: false,
            rainDrying: false,
            rainSettling: true,
            snowActive: false,
            snowMelting: false,
            snowSettling: true,
        });
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
            snowIntegrationReadyCount: 0,
            snowIntegrationTrackedCount: 0,
            snowIntegrationTransitionCount: 0,
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
                snowIntegrationReadyCount: 0,
                snowIntegrationTrackedCount: 0,
                snowIntegrationTransitionCount: 0,
            },
            {
                rainConsumerCount: 0,
                rainDistinctUniformCount: 0,
                snowConsumerCount: 0,
                snowDistinctUniformCount: 0,
                snowIntegrationReadyCount: 0,
                snowIntegrationTrackedCount: 0,
                snowIntegrationTransitionCount: 0,
            },
        ]);
    });

    it('reacts to damped snow readiness once and holds through hysteresis', () => {
        const registry = new WeatherSurfaceUniformRegistry();
        const entry = registry.getSnowEntry({
            coverageMultiplier: 1,
            overrideSnow: undefined,
        });
        registry.retain(entry);
        let notificationCount = 0;
        const unsubscribe = registry.subscribeSnowIntegrationReadiness(
            entry,
            0.15,
            () => {
                notificationCount += 1;
            },
        );

        registry.advance({ rainAmount: 0, snowCoverage: 1 }, 0.01);
        assert.equal(
            registry.getSnowIntegrationReady(entry, 0.15),
            false,
            'a high target must not integrate before the rendered uniform catches up',
        );

        registry.advance({ rainAmount: 0, snowCoverage: 0.28 }, 10);
        assert.equal(registry.getSnowIntegrationReady(entry, 0.15), true);
        assert.equal(notificationCount, 1);

        registry.advance({ rainAmount: 0, snowCoverage: 0.26 }, 10);
        assert.equal(registry.getSnowIntegrationReady(entry, 0.15), true);
        assert.equal(notificationCount, 1);

        registry.advance({ rainAmount: 0, snowCoverage: 0.24 }, 10);
        assert.equal(registry.getSnowIntegrationReady(entry, 0.15), false);
        assert.equal(notificationCount, 2);
        assert.deepEqual(registry.getStats(), {
            rainConsumerCount: 0,
            rainDistinctUniformCount: 0,
            snowConsumerCount: 1,
            snowDistinctUniformCount: 1,
            snowIntegrationReadyCount: 0,
            snowIntegrationTrackedCount: 1,
            snowIntegrationTransitionCount: 2,
        });

        unsubscribe();
        assert.equal(registry.getStats().snowIntegrationTrackedCount, 0);
    });

    it('notifies rain dry-down activity when rendered wetness clears', () => {
        const registry = new WeatherSurfaceUniformRegistry();
        const entry = registry.getRainEntry({
            drySpeed: 1.8,
            intensityMultiplier: 1,
            wetSpeed: 5,
        });
        registry.retain(entry);
        let notificationCount = 0;
        const unsubscribe = registry.subscribeRainSurfaceActivity(
            entry,
            0.01,
            () => {
                notificationCount += 1;
            },
        );

        registry.advance({ rainAmount: 1, snowCoverage: 0 }, 1);
        assert.equal(registry.getRainSurfaceActive(entry, 0.01), true);
        registry.advance({ rainAmount: 0, snowCoverage: 0 }, 0.1);
        assert.equal(
            registry.getRainSurfaceActive(entry, 0.01),
            true,
            'the overlay remains active while its damped uniform is wet',
        );
        registry.advance({ rainAmount: 0, snowCoverage: 0 }, 10);
        assert.equal(registry.getRainSurfaceActive(entry, 0.01), false);
        assert.equal(notificationCount, 2);

        unsubscribe();
    });

    it('reports retained rain as drying until its rendered wetness is inactive', () => {
        const registry = new WeatherSurfaceUniformRegistry();
        const entry = registry.getRainEntry({
            drySpeed: 1.8,
            intensityMultiplier: 1,
            wetSpeed: 5,
        });
        registry.retain(entry);
        let notificationCount = 0;
        registry.subscribeActivity(() => {
            notificationCount += 1;
        });

        registry.advance({ rainAmount: 1, snowCoverage: 0 }, 10);
        assert.deepEqual(registry.getActivitySnapshot(), {
            rainActive: true,
            rainDrying: false,
            rainSettling: false,
            snowActive: false,
            snowMelting: false,
            snowSettling: false,
        });

        registry.advance({ rainAmount: 0, snowCoverage: 0 }, 0.1);
        const dryingSnapshot = registry.getActivitySnapshot();
        assert.deepEqual(dryingSnapshot, {
            rainActive: true,
            rainDrying: true,
            rainSettling: true,
            snowActive: false,
            snowMelting: false,
            snowSettling: false,
        });
        assert.equal(notificationCount, 2);

        registry.advance({ rainAmount: 0, snowCoverage: 0 }, 0.1);
        assert.equal(
            registry.getActivitySnapshot(),
            dryingSnapshot,
            'unchanged aggregate activity keeps a stable snapshot',
        );
        assert.equal(notificationCount, 2);

        registry.advance({ rainAmount: 0, snowCoverage: 0 }, 10);
        assert.deepEqual(registry.getActivitySnapshot(), {
            rainActive: false,
            rainDrying: false,
            rainSettling: false,
            snowActive: false,
            snowMelting: false,
            snowSettling: false,
        });
        assert.equal(notificationCount, 3);
    });

    it('reports retained snow as melting until its rendered coverage is inactive', () => {
        const registry = new WeatherSurfaceUniformRegistry();
        const entry = registry.getSnowEntry({
            coverageMultiplier: 1,
            overrideSnow: undefined,
        });
        registry.retain(entry);

        registry.advance({ rainAmount: 0, snowCoverage: 1 }, 10);
        assert.deepEqual(registry.getActivitySnapshot(), {
            rainActive: false,
            rainDrying: false,
            rainSettling: false,
            snowActive: true,
            snowMelting: false,
            snowSettling: false,
        });

        registry.advance({ rainAmount: 0, snowCoverage: 0 }, 0.1);
        assert.deepEqual(registry.getActivitySnapshot(), {
            rainActive: false,
            rainDrying: false,
            rainSettling: false,
            snowActive: true,
            snowMelting: true,
            snowSettling: true,
        });

        registry.advance({ rainAmount: 0, snowCoverage: 0 }, 10);
        assert.deepEqual(registry.getActivitySnapshot(), {
            rainActive: false,
            rainDrying: false,
            rainSettling: false,
            snowActive: false,
            snowMelting: false,
            snowSettling: false,
        });
    });

    it('does not classify a retained snow override as game-weather melting', () => {
        const registry = new WeatherSurfaceUniformRegistry();
        const entry = registry.getSnowEntry({
            coverageMultiplier: 1,
            overrideSnow: 0.4,
        });
        registry.retain(entry);

        registry.advance({ rainAmount: 0, snowCoverage: 0 }, 10);

        assert.deepEqual(registry.getActivitySnapshot(), {
            rainActive: false,
            rainDrying: false,
            rainSettling: false,
            snowActive: true,
            snowMelting: false,
            snowSettling: false,
        });
    });
});
