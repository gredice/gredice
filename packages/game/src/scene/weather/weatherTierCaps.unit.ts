import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    defaultGameQualityCustomProfile,
    type GameQualityProfile,
    gameQualityProfiles,
    resolveGameQualityProfile,
} from '../gameQuality';
import {
    resolveRainDropCount,
    resolveSnowFlakeCounts,
    resolveViewAreaScale,
    resolveWeatherTier,
    resolveWeatherTierCaps,
} from './weatherTierCaps';

describe('weather tier caps', () => {
    it('follows the GAME_ART quality tier table', () => {
        const high = resolveWeatherTierCaps(gameQualityProfiles.high);
        const medium = resolveWeatherTierCaps(gameQualityProfiles.medium);
        const low = resolveWeatherTierCaps(gameQualityProfiles.low);

        assert.deepEqual(
            [high, medium, low].map((caps) => [
                caps.bandClouds,
                caps.cloudShadows,
                caps.splashRings,
                caps.swooshes,
                caps.sparkles,
            ]),
            [
                [10, 6, 29, 4, 14],
                [7, 4, 14, 2, 10],
                [4, 0, 0, 1, 7],
            ],
        );
        assert.deepEqual(
            [high, medium, low].map((caps) => [
                caps.puddles,
                caps.mistRimRolls,
                caps.mistSkyRolls,
                caps.windLeaves,
            ]),
            [
                [24, 12, 4, 14],
                [12, 8, 2, 10],
                [6, 4, 0, 0],
            ],
        );
    });

    it('reuses the profile rain and snow multipliers', () => {
        const medium = resolveWeatherTierCaps(gameQualityProfiles.medium);
        assert.equal(medium.rainMultiplier, 0.7);
        assert.equal(medium.snowMultiplier, 0.6);
        const constrained = resolveWeatherTierCaps(
            resolveGameQualityProfile('auto', undefined, {
                coarsePointer: true,
                dpr: 3,
                memoryGb: 2,
                narrowViewport: true,
            }),
        );
        assert.equal(constrained.tier, 'low');
        assert.equal(constrained.rainMultiplier, 0.5);
        assert.equal(constrained.snowMultiplier, 0.45);
    });

    it('maps custom profiles onto the nearest tier without new fields', () => {
        const custom = (
            overrides: Partial<GameQualityProfile>,
        ): GameQualityProfile => ({
            ...defaultGameQualityCustomProfile,
            tier: 'custom',
            ...overrides,
        });
        assert.equal(resolveWeatherTier(custom({})), 'medium');
        assert.equal(
            resolveWeatherTier(custom({ rainParticleMultiplier: 1 })),
            'high',
        );
        assert.equal(resolveWeatherTier(custom({ shadows: false })), 'low');
        assert.deepEqual(Object.keys(defaultGameQualityCustomProfile).sort(), [
            'cloudShadowMode',
            'dpr',
            'groundDecorationDensity',
            'rainParticleMultiplier',
            'shadowMapSize',
            'shadows',
            'snowOverlayMinCoverage',
            'snowParticleMultiplier',
        ]);
    });

    it('counts heavy rain at 840 / 588 / 294 drops on a 1280 × 800 view', () => {
        const area = resolveViewAreaScale(1280, 800);
        assert.equal(area, 1);
        assert.deepEqual(
            (['high', 'medium', 'low'] as const).map((tier) =>
                resolveRainDropCount(
                    resolveWeatherTierCaps(gameQualityProfiles[tier]),
                    1,
                    area,
                ),
            ),
            [840, 588, 294],
        );
        const high = resolveWeatherTierCaps(gameQualityProfiles.high);
        // Rain (0.6) is about half of heavy rain, continuous, no steps.
        assert.equal(resolveRainDropCount(high, 0.6, area), 432);
        assert.equal(resolveRainDropCount(high, 0.03, area), 0);
        assert.ok(
            resolveRainDropCount(high, 0.5, area) <
                resolveRainDropCount(high, 0.51, area),
        );
        // A phone view gets proportionally fewer; a huge one stops at the cap.
        assert.equal(
            resolveRainDropCount(high, 1, resolveViewAreaScale(390, 844)),
            270,
        );
        assert.equal(
            resolveRainDropCount(high, 1, resolveViewAreaScale(3840, 2160)),
            1400,
        );
    });

    it('counts snow at about 415 flakes at snowy 0.8, 12% icon flakes', () => {
        const high = resolveWeatherTierCaps(gameQualityProfiles.high);
        const counts = resolveSnowFlakeCounts(high, 0.8, 1);
        assert.deepEqual(counts, { discs: 366, iconFlakes: 50, total: 416 });
        assert.equal(
            resolveSnowFlakeCounts(
                resolveWeatherTierCaps(gameQualityProfiles.medium),
                0.8,
                1,
            ).total,
            250,
        );
        assert.equal(
            resolveSnowFlakeCounts(
                resolveWeatherTierCaps(gameQualityProfiles.low),
                0.8,
                1,
            ).total,
            125,
        );
        assert.deepEqual(resolveSnowFlakeCounts(high, 0.02, 1), {
            discs: 0,
            iconFlakes: 0,
            total: 0,
        });
    });
});
