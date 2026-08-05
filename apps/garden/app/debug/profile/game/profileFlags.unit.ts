import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    highTargetOperationVisualHighlightTarget,
    resolveGameProfileAdaptiveHigh,
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
        assert.deepEqual(resolveGameProfileFlags(undefined), {
            enableDebugHudFlag: true,
            enableIntegratedWeatherSurfacesFlag: true,
        });
        assert.deepEqual(resolveGameProfileFlags('integrated'), {
            enableDebugHudFlag: true,
            enableIntegratedWeatherSurfacesFlag: true,
        });
    });

    it('allows explicit legacy weather-surface comparisons', () => {
        assert.deepEqual(resolveGameProfileFlags('legacy'), {
            enableDebugHudFlag: true,
            enableIntegratedWeatherSurfacesFlag: false,
        });
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
