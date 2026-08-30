import type { GameSceneProps } from '@gredice/game';

export type GameProfileStaticSceneCacheMode = 'cache' | 'legacy';
export type GameProfileWeatherSurfaceMode = 'integrated' | 'legacy';

export const highTargetOperationVisualHighlightTarget = {
    fieldId: 201,
    positionIndex: 0,
    raisedBedId: 2,
} as const;

export function resolveGameProfileAdaptiveHigh(value: string | undefined) {
    return value === '1';
}

export function resolveGameProfileGardenAvatar(value: string | undefined) {
    return value === '1';
}

export function resolveGameProfileGardenBuilding(
    value: string | undefined,
    fixtureEnabled = false,
) {
    return fixtureEnabled && value === '1';
}

export function resolveGameProfileGardenBuildingFixtureGate(
    value: string | undefined,
) {
    return value === 'true';
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
    weatherSurface: string | undefined,
    gardenAvatar?: string,
    gardenBuilding?: string,
    gardenBuildingFixtureEnabled = false,
    debugTelemetry = true,
) {
    const weatherSurfaceMode = resolveGameProfileWeatherSurface(weatherSurface);

    return {
        enableDebugHudFlag: debugTelemetry,
        enableGardenAvatarFlag: resolveGameProfileGardenAvatar(gardenAvatar),
        enableGardenBuildingSystemFlag: resolveGameProfileGardenBuilding(
            gardenBuilding,
            gardenBuildingFixtureEnabled,
        ),
        enableIntegratedWeatherSurfacesFlag:
            weatherSurfaceMode === 'integrated',
    } satisfies NonNullable<GameSceneProps['flags']>;
}
