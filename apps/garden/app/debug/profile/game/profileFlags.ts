import type { GameSceneProps } from '@gredice/game';

export type GameProfileStaticSceneCacheMode = 'cache' | 'legacy';
export type GameProfileWeatherSurfaceMode = 'integrated' | 'legacy';

export const highTargetOperationVisualHighlightTarget = {
    fieldId: 201,
    positionIndex: 0,
    raisedBedId: 2,
} as const;

export function resolveGameProfileBlockGeometryMerging(
    value: string | undefined,
) {
    return value === '1';
}

export function resolveGameProfileAdaptiveHigh(value: string | undefined) {
    return value === '1';
}

export function resolveGameProfileOperationVisuals(value: string | undefined) {
    return value === '1';
}

export function resolveGameProfileStaticSceneCache(
    value: string | undefined,
): GameProfileStaticSceneCacheMode {
    return value === 'legacy' ? 'legacy' : 'cache';
}

export function resolveGameProfileStaticSceneCacheOcclusionFixture(
    value: string | undefined,
) {
    return value === '1';
}

export function resolveGameProfileWeatherSurface(
    value: string | undefined,
): GameProfileWeatherSurfaceMode {
    return value === 'legacy' ? 'legacy' : 'integrated';
}

export function resolveGameProfileFlags(
    blockGeometryMerging: string | undefined,
    adaptiveHigh: string | undefined,
    weatherSurface: string | undefined,
    staticSceneCache: string | undefined,
) {
    const weatherSurfaceMode = resolveGameProfileWeatherSurface(weatherSurface);
    const staticSceneCacheMode =
        resolveGameProfileStaticSceneCache(staticSceneCache);

    return {
        enableAdaptiveHighQualityFlag:
            resolveGameProfileAdaptiveHigh(adaptiveHigh),
        enableBlockGeometryMergingFlag:
            resolveGameProfileBlockGeometryMerging(blockGeometryMerging),
        enableDebugHudFlag: true,
        enableIntegratedWeatherSurfacesFlag:
            weatherSurfaceMode === 'integrated',
        enableRainWetOverlayFlag: true,
        enableStaticOpaqueSceneCacheFlag: staticSceneCacheMode === 'cache',
    } satisfies NonNullable<GameSceneProps['flags']>;
}
