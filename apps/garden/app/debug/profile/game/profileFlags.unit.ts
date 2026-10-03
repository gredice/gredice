import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    highTargetOperationVisualHighlightTarget,
    resolveGameProfileAdaptiveHigh,
    resolveGameProfileControllerEnabled,
    resolveGameProfileFlags,
    resolveGameProfileGardenAvatar,
    resolveGameProfileOperationVisuals,
    resolveGameProfileStaticIdle,
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

describe('resolveGameProfileControllerEnabled', () => {
    it('preserves controller opt-ins when the cache witness is absent', () => {
        assert.equal(resolveGameProfileControllerEnabled(undefined), false);
        assert.equal(resolveGameProfileControllerEnabled(false), false);
        assert.equal(resolveGameProfileControllerEnabled(true), true);
        assert.equal(resolveGameProfileControllerEnabled(false, ''), false);
    });

    it('mounts canonical renderer receipts for every cache witness scene without another controller flag', () => {
        for (const mode of [
            'details',
            'cloudy',
            'rain',
            'snow',
            'snow-onset',
        ]) {
            assert.equal(
                resolveGameProfileControllerEnabled(false, mode),
                true,
            );
            assert.equal(
                resolveGameProfileControllerEnabled(undefined, mode),
                true,
            );
        }
    });
});

describe('resolveGameProfileGardenAvatar', () => {
    it('keeps the walkable avatar behind an explicit opt-in', () => {
        assert.equal(resolveGameProfileGardenAvatar(undefined), false);
        assert.equal(resolveGameProfileGardenAvatar('0'), false);
        assert.equal(resolveGameProfileGardenAvatar('unexpected'), false);
        assert.equal(resolveGameProfileGardenAvatar('1'), true);
    });
});

describe('resolveGameProfileFlags', () => {
    it('defaults production-profile weather surfaces to the integrated path', () => {
        assert.deepEqual(resolveGameProfileFlags(undefined), {
            enableDebugHudFlag: true,
            enableGardenAvatarFlag: false,
            enableIntegratedWeatherSurfacesFlag: true,
        });
        assert.deepEqual(resolveGameProfileFlags('integrated'), {
            enableDebugHudFlag: true,
            enableGardenAvatarFlag: false,
            enableIntegratedWeatherSurfacesFlag: true,
        });
    });

    it('allows explicit legacy weather-surface comparisons', () => {
        assert.deepEqual(resolveGameProfileFlags('legacy'), {
            enableDebugHudFlag: true,
            enableGardenAvatarFlag: false,
            enableIntegratedWeatherSurfacesFlag: false,
        });
    });

    it('spawns the walkable avatar when the profile asks for it', () => {
        assert.deepEqual(resolveGameProfileFlags(undefined, '1'), {
            enableDebugHudFlag: true,
            enableGardenAvatarFlag: true,
            enableIntegratedWeatherSurfacesFlag: true,
        });
    });

    it('can disable the Debug HUD feature flag for fauna profiles', () => {
        assert.deepEqual(resolveGameProfileFlags(undefined, undefined, false), {
            enableDebugHudFlag: false,
            enableGardenAvatarFlag: false,
            enableIntegratedWeatherSurfacesFlag: true,
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

describe('resolveGameProfileStaticIdle', () => {
    it('keeps the zero-work fixture behind an exact profiler opt-in', () => {
        assert.equal(resolveGameProfileStaticIdle(undefined), false);
        assert.equal(resolveGameProfileStaticIdle('0'), false);
        assert.equal(resolveGameProfileStaticIdle('unexpected'), false);
        assert.equal(resolveGameProfileStaticIdle('1'), true);
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
