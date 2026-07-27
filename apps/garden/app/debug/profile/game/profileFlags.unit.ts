import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    highTargetOperationVisualHighlightTarget,
    resolveGameProfileAdaptiveHigh,
    resolveGameProfileBlockGeometryMerging,
    resolveGameProfileFlags,
    resolveGameProfileOperationVisuals,
    resolveGameProfileStaticSceneCache,
    resolveGameProfileStaticSceneCacheOcclusionFixture,
    resolveGameProfileWeatherSurface,
} from './profileFlags.ts';

describe('resolveGameProfileAdaptiveHigh', () => {
    it('keeps adaptive High opt-in', () => {
        assert.equal(resolveGameProfileAdaptiveHigh(undefined), false);
        assert.equal(resolveGameProfileAdaptiveHigh('0'), false);
        assert.equal(resolveGameProfileAdaptiveHigh('unexpected'), false);
        assert.equal(resolveGameProfileAdaptiveHigh('1'), true);
    });
});

describe('resolveGameProfileBlockGeometryMerging', () => {
    it('preserves the existing profiler default', () => {
        assert.equal(resolveGameProfileBlockGeometryMerging(undefined), false);
        assert.equal(
            resolveGameProfileBlockGeometryMerging('unexpected'),
            false,
        );
    });

    it('supports explicit enabled and disabled profile comparisons', () => {
        assert.equal(resolveGameProfileBlockGeometryMerging('1'), true);
        assert.equal(resolveGameProfileBlockGeometryMerging('0'), false);
    });
});

describe('resolveGameProfileOperationVisuals', () => {
    it('keeps the high-target workload behind an explicit opt-in', () => {
        assert.equal(resolveGameProfileOperationVisuals(undefined), false);
        assert.equal(resolveGameProfileOperationVisuals('0'), false);
        assert.equal(resolveGameProfileOperationVisuals('unexpected'), false);
        assert.equal(resolveGameProfileOperationVisuals('1'), true);
    });

    it('exposes the deterministic transient highlight target', () => {
        assert.deepEqual(highTargetOperationVisualHighlightTarget, {
            fieldId: 201,
            positionIndex: 0,
            raisedBedId: 2,
        });
    });
});

describe('resolveGameProfileFlags', () => {
    it('defaults production-profile weather surfaces to the integrated path', () => {
        assert.deepEqual(
            resolveGameProfileFlags(undefined, undefined, undefined, undefined),
            {
                enableAdaptiveHighQualityFlag: false,
                enableBlockGeometryMergingFlag: false,
                enableDebugHudFlag: true,
                enableIntegratedWeatherSurfacesFlag: true,
                enableRainWetOverlayFlag: true,
                enableStaticOpaqueSceneCacheFlag: true,
            },
        );
        assert.deepEqual(
            resolveGameProfileFlags('0', '1', 'integrated', 'cache'),
            {
                enableAdaptiveHighQualityFlag: true,
                enableBlockGeometryMergingFlag: false,
                enableDebugHudFlag: true,
                enableIntegratedWeatherSurfacesFlag: true,
                enableRainWetOverlayFlag: true,
                enableStaticOpaqueSceneCacheFlag: true,
            },
        );
    });

    it('allows explicit legacy weather-surface and scene-cache comparisons', () => {
        assert.deepEqual(
            resolveGameProfileFlags('1', '0', 'legacy', 'legacy'),
            {
                enableAdaptiveHighQualityFlag: false,
                enableBlockGeometryMergingFlag: true,
                enableDebugHudFlag: true,
                enableIntegratedWeatherSurfacesFlag: false,
                enableRainWetOverlayFlag: true,
                enableStaticOpaqueSceneCacheFlag: false,
            },
        );
    });
});

describe('resolveGameProfileStaticSceneCache', () => {
    it('accepts only the exact legacy override', () => {
        assert.equal(resolveGameProfileStaticSceneCache('legacy'), 'legacy');
        assert.equal(resolveGameProfileStaticSceneCache('cache'), 'cache');
        assert.equal(resolveGameProfileStaticSceneCache(undefined), 'cache');
        assert.equal(resolveGameProfileStaticSceneCache('unexpected'), 'cache');
    });
});

describe('resolveGameProfileStaticSceneCacheOcclusionFixture', () => {
    it('keeps the depth fixture behind an exact profiler opt-in', () => {
        assert.equal(
            resolveGameProfileStaticSceneCacheOcclusionFixture(undefined),
            false,
        );
        assert.equal(
            resolveGameProfileStaticSceneCacheOcclusionFixture('0'),
            false,
        );
        assert.equal(
            resolveGameProfileStaticSceneCacheOcclusionFixture('unexpected'),
            false,
        );
        assert.equal(
            resolveGameProfileStaticSceneCacheOcclusionFixture('1'),
            true,
        );
    });
});

describe('resolveGameProfileWeatherSurface', () => {
    it('accepts only the exact legacy override', () => {
        assert.equal(resolveGameProfileWeatherSurface('legacy'), 'legacy');
        assert.equal(
            resolveGameProfileWeatherSurface('integrated'),
            'integrated',
        );
        assert.equal(resolveGameProfileWeatherSurface(undefined), 'integrated');
        assert.equal(
            resolveGameProfileWeatherSurface('unexpected'),
            'integrated',
        );
    });
});
