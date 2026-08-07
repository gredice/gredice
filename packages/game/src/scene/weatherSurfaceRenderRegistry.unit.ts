import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getWeatherSurfaceRenderRegistrySnapshot,
    registerWeatherSurfaceRenderEntry,
    resetWeatherSurfaceRenderRegistryForTests,
} from './weatherSurfaceRenderRegistry';

test('weather surface registry aggregates avoided and fallback work', () => {
    resetWeatherSurfaceRenderRegistryForTests();
    const releaseGrass = registerWeatherSurfaceRenderEntry('grass', {
        avoidedOverlaySubmissionCount: 9,
        avoidedOverlayTriangleCount: 1_440,
        fallbackOverlaySubmissionCount: 0,
        fallbackOverlayTriangleCount: 0,
        integratedInstanceCount: 175,
        integratedMaterialCount: 1,
        mode: 'integrated',
        pluginVariantKeys: ['weather-rain-snow-v1'],
    });
    const releaseProps = registerWeatherSurfaceRenderEntry('props', {
        avoidedOverlaySubmissionCount: 0,
        avoidedOverlayTriangleCount: 0,
        fallbackOverlaySubmissionCount: 4,
        fallbackOverlayTriangleCount: 320,
        integratedInstanceCount: 0,
        integratedMaterialCount: 0,
        mode: 'integrated',
        pluginVariantKeys: [],
    });

    assert.deepEqual(getWeatherSurfaceRenderRegistrySnapshot(), {
        avoidedOverlaySubmissionCount: 9,
        avoidedOverlayTriangleCount: 1_440,
        fallbackOverlaySubmissionCount: 4,
        fallbackOverlayTriangleCount: 320,
        integratedInstanceCount: 175,
        integratedMaterialCount: 1,
        mode: 'integrated',
        pluginVariantCount: 1,
    });

    releaseProps();
    releaseGrass();
});

test('weather surface registry deduplicates variants and ignores stale cleanup', () => {
    resetWeatherSurfaceRenderRegistryForTests();
    const snapshot = {
        avoidedOverlaySubmissionCount: 1,
        avoidedOverlayTriangleCount: 12,
        fallbackOverlaySubmissionCount: 0,
        fallbackOverlayTriangleCount: 0,
        integratedInstanceCount: 1,
        integratedMaterialCount: 1,
        mode: 'integrated' as const,
        pluginVariantKeys: ['weather-rain-snow-v1'],
    };
    const releaseFirst = registerWeatherSurfaceRenderEntry('terrain', snapshot);
    const releaseSecond = registerWeatherSurfaceRenderEntry(
        'terrain',
        snapshot,
    );
    registerWeatherSurfaceRenderEntry('snow', snapshot);

    releaseFirst();
    assert.deepEqual(getWeatherSurfaceRenderRegistrySnapshot(), {
        avoidedOverlaySubmissionCount: 2,
        avoidedOverlayTriangleCount: 24,
        fallbackOverlaySubmissionCount: 0,
        fallbackOverlayTriangleCount: 0,
        integratedInstanceCount: 2,
        integratedMaterialCount: 2,
        mode: 'integrated',
        pluginVariantCount: 1,
    });
    releaseSecond();
});
