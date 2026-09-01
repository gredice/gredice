import {
    faunaHeavyMockGardenProfile,
    type GameSceneProps,
    isOperationVisualRewardDebugProfile,
    operationVisualRewardDebugProfile,
    operationVisualRewardDebugScenarios,
} from '@gredice/game';
import { ProfileGameScene } from './ProfileGameScene';
import {
    highTargetOperationVisualHighlightTarget,
    resolveGameProfileAdaptiveHigh,
    resolveGameProfileFlags,
    resolveGameProfileGardenAvatar,
    resolveGameProfileGardenBuilding,
    resolveGameProfileGardenBuildingFixture,
    resolveGameProfileGardenBuildingFixtureGate,
    resolveGameProfileOperationVisuals,
    resolveGameProfileStaticSceneCache,
    resolveGameProfileStaticSceneCacheOcclusionFixture,
    resolveGameProfileWeatherSurface,
} from './profileFlags';
import {
    gameProfileClearWeather,
    gameProfileCloudyWeather,
    gameProfileSnowSparseWeather,
} from './profileWeather';

export const instant = false;

type GameProfileSearchParams = Promise<
    Record<string, string | string[] | undefined>
>;

type GameProfileMode =
    | 'baseline'
    | 'cloudy'
    | 'details'
    | 'rain'
    | 'snow'
    | 'snow-onset'
    | 'night'
    | 'storm'
    | 'autumn'
    | 'windy';

type GameProfileMockGardenProfile = NonNullable<
    GameSceneProps['mockGardenProfile']
>;

function resolveAvatarProfileView(value: string | undefined) {
    return value === 'third-person' ? value : null;
}

function firstValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

function resolvePositiveInteger(value: string | undefined) {
    if (!value) {
        return null;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function resolveNonNegativeNumber(value: string | undefined) {
    if (!value) {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function resolveMode(value: string | undefined): GameProfileMode {
    if (value === 'autum') {
        return 'autumn';
    }

    if (
        value === 'baseline' ||
        value === 'cloudy' ||
        value === 'details' ||
        value === 'rain' ||
        value === 'snow' ||
        value === 'snow-onset' ||
        value === 'night' ||
        value === 'storm' ||
        value === 'autumn' ||
        value === 'windy'
    ) {
        return value;
    }

    return 'baseline';
}

function resolveQuality(
    value: string | undefined,
): GameSceneProps['initialQualitySetting'] {
    if (
        value === 'auto' ||
        value === 'low' ||
        value === 'medium' ||
        value === 'high'
    ) {
        return value;
    }

    return undefined;
}

function resolveMockGardenProfile(
    value: string | undefined,
): GameProfileMockGardenProfile {
    if (
        value === 'dense' ||
        value === faunaHeavyMockGardenProfile ||
        value === 'high-target' ||
        value === operationVisualRewardDebugProfile ||
        value === 'plant-heavy'
    ) {
        return value;
    }

    return 'default';
}

function resolveGardenBuildingAvatarSpawnPoint(
    fixture: ReturnType<typeof resolveGameProfileGardenBuildingFixture>,
) {
    if (fixture === 'house') {
        // Starts inside the south side of the representative profile house.
        return { x: 0, z: 1.25 };
    }
    if (fixture === 'worst-case') {
        // Starts outside a solid south wall so repeated forward steps exercise
        // the furnished 100-cell collision buckets without entering cutaway.
        return { x: 0, z: -1.85 };
    }
    return undefined;
}

function resolveWeather(
    mode: GameProfileMode,
): NonNullable<GameSceneProps['weather']> {
    if (mode === 'cloudy') {
        return gameProfileCloudyWeather;
    }

    if (mode === 'rain') {
        return {
            cloudy: 0.85,
            rainy: 1,
            snowy: 0,
            foggy: 0.12,
            windSpeed: 0.6,
            windDirection: 90,
            snowAccumulation: 0,
        };
    }

    if (mode === 'snow') {
        return {
            cloudy: 0.75,
            rainy: 0,
            snowy: 0.7,
            foggy: 0.2,
            windSpeed: 0.45,
            windDirection: 45,
            snowAccumulation: 24,
        };
    }

    if (mode === 'snow-onset') {
        // High quality starts rendering snow at 0.02 coverage (0.6 cm).
        // Keep this fixture just above that edge so sparse coverage and
        // skirt continuity remain easy to compare without snow particles.
        // A particle-free breeze keeps bees out of the deterministic
        // high-target actor count.
        return gameProfileSnowSparseWeather;
    }

    if (mode === 'night') {
        return {
            ...gameProfileClearWeather,
            cloudy: 0.1,
            windSpeed: 0.2,
            windDirection: 45,
        };
    }

    if (mode === 'storm') {
        return {
            cloudy: 1,
            rainy: 1,
            snowy: 0,
            foggy: 0.35,
            thundery: 1,
            windSpeed: 3,
            windDirection: 135,
            snowAccumulation: 0,
        };
    }

    if (mode === 'autumn') {
        return {
            ...gameProfileClearWeather,
            cloudy: 0.35,
            foggy: 0.08,
            windSpeed: 0.7,
            windDirection: 270,
        };
    }

    if (mode === 'windy') {
        return {
            ...gameProfileClearWeather,
            cloudy: 0.45,
            foggy: 0.04,
            windSpeed: 2.4,
            windDirection: 235,
        };
    }

    return gameProfileClearWeather;
}

function resolveFreezeTime(mode: GameProfileMode) {
    if (mode === 'night') {
        return new Date(2024, 5, 21, 22, 30, 0);
    }

    if (mode === 'storm') {
        return new Date(2024, 5, 21, 18, 30, 0);
    }

    if (mode === 'autumn') {
        return new Date(2024, 8, 22, 16, 30, 0);
    }

    return new Date(2024, 5, 21, 12, 0, 0);
}

function OperationRewardDebugOverlay() {
    return (
        <aside
            className="pointer-events-auto absolute inset-x-4 bottom-4 max-h-[36vh] overflow-auto rounded-lg border border-neutral-800 bg-neutral-950/90 p-4 text-white shadow-2xl backdrop-blur"
            data-operation-reward-debug-panel="1"
        >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                <span className="shrink-0 text-base font-semibold">
                    Operation reward matrix
                </span>
                <span className="max-w-3xl text-xs text-neutral-400">
                    Each operation is resolved from attributes.visualReward and
                    rendered as before/after beds.
                </span>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-3 xl:grid-cols-5">
                {operationVisualRewardDebugScenarios.map((scenario) => (
                    <div
                        key={scenario.kind}
                        className="rounded-md border border-neutral-800 bg-neutral-900/80 p-3"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold">
                                {scenario.title}
                            </span>
                            <code className="rounded bg-neutral-950 px-1.5 py-0.5 font-mono text-[11px] text-neutral-400">
                                {scenario.kind} #{scenario.operationId}
                            </code>
                        </div>
                        <div className="mt-2 grid gap-2">
                            {[scenario.before, scenario.after].map((state) => (
                                <div
                                    key={`${scenario.kind}-${state.label}`}
                                    className="rounded border border-neutral-800 bg-neutral-950/70 p-2"
                                >
                                    <span className="block text-[11px] font-semibold uppercase text-neutral-500">
                                        {state.label} bed {state.raisedBedId}
                                    </span>
                                    <span className="mt-1 block text-xs text-neutral-300">
                                        {state.state}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </aside>
    );
}

export default async function GameProfilePage({
    searchParams,
}: {
    searchParams: GameProfileSearchParams;
}) {
    const params = await searchParams;
    const mode = resolveMode(firstValue(params.mode));
    const renderDetails = firstValue(params.details) !== '0';
    const showLegend = firstValue(params.legend) !== '0';
    const showHud = firstValue(params.hud) === '1';
    const showDebugHud = firstValue(params.debugHud) === '1';
    const enableControls = firstValue(params.controls) === '1';
    const cameraProfile = firstValue(params.cameraProfile) === '1';
    const gardenSwitchProfile = firstValue(params.gardenSwitch) === '1';
    const lifecycleProfile = firstValue(params.lifecycle) === '1';
    const mockGardenProfile = resolveMockGardenProfile(
        firstValue(params.profile),
    );
    const closeupRaisedBedId = resolvePositiveInteger(
        firstValue(params.closeupRaisedBedId),
    );
    const fixedTimeSeconds = resolveNonNegativeNumber(
        firstValue(params.fixedTimeSeconds),
    );
    const outlineProfile = firstValue(params.outline) === '1';
    const placementProfile = firstValue(params.placement) === '1';
    const operationVisuals =
        mockGardenProfile === 'high-target' &&
        resolveGameProfileOperationVisuals(firstValue(params.operationVisuals));
    const gardenAvatar = resolveGameProfileGardenAvatar(
        firstValue(params.avatar),
    );
    const avatarProfileView = resolveAvatarProfileView(
        firstValue(params.avatarProfile),
    );
    const gardenBuildingFixtureEnabled =
        resolveGameProfileGardenBuildingFixtureGate(
            process.env.GREDICE_GARDEN_BUILDING_PROFILE_FIXTURE_ENABLED,
        );
    const gardenBuilding = resolveGameProfileGardenBuilding(
        firstValue(params.building),
        gardenBuildingFixtureEnabled,
    );
    const gardenBuildingFixture = resolveGameProfileGardenBuildingFixture(
        firstValue(params.buildingFixture),
        gardenBuildingFixtureEnabled,
    );
    const gardenStructureProfileFixture =
        gardenBuilding && gardenBuildingFixture
            ? (
                  await import('@gredice/game/garden-building-profile-fixture')
              ).createGardenStructureProfileFixtureDescriptor(
                  gardenBuildingFixture,
              )
            : undefined;
    const debugGameFlags = resolveGameProfileFlags(
        firstValue(params.weatherSurface),
        firstValue(params.avatar),
        firstValue(params.building),
        gardenBuildingFixtureEnabled,
        mockGardenProfile !== 'fauna-heavy',
    );
    const staticSceneCacheMode = resolveGameProfileStaticSceneCache(
        firstValue(params.staticSceneCache),
    );
    const staticSceneCacheOcclusionFixture =
        staticSceneCacheMode === 'cache' &&
        resolveGameProfileStaticSceneCacheOcclusionFixture(
            firstValue(params.staticSceneCacheOcclusionFixture),
        );
    const weatherSurfaceMode = resolveGameProfileWeatherSurface(
        firstValue(params.weatherSurface),
    );
    const adaptiveHigh = resolveGameProfileAdaptiveHigh(
        firstValue(params.adaptiveHigh),
    );
    const isOperationRewardDebug =
        isOperationVisualRewardDebugProfile(mockGardenProfile);
    const quality = resolveQuality(firstValue(params.quality));
    const weather = resolveWeather(mode);
    const freezeTime = resolveFreezeTime(mode);

    return (
        <main
            className="relative h-screen w-screen overflow-hidden bg-[#e7e2cc]"
            data-game-profile-mode={mode}
            data-game-profile-comparison-contract-version={
                process.env.NEXT_PUBLIC_GAME_PROFILE_COMPARISON_CONTRACT_VERSION
            }
            data-game-profile-controls={enableControls ? '1' : '0'}
            data-game-profile-details={renderDetails ? '1' : '0'}
            data-game-profile-fixed-time-seconds={fixedTimeSeconds ?? undefined}
            data-game-profile-debug-hud={showDebugHud ? '1' : '0'}
            data-game-profile-hud={showHud ? '1' : '0'}
            data-game-profile-garden-profile={mockGardenProfile}
            data-game-profile-garden-switch={gardenSwitchProfile ? '1' : '0'}
            data-game-profile-lifecycle={lifecycleProfile ? '1' : '0'}
            data-game-profile-quality={quality ?? 'auto'}
            data-game-profile-adaptive-high={adaptiveHigh ? '1' : '0'}
            data-game-profile-avatar={gardenAvatar ? '1' : '0'}
            data-game-profile-avatar-view={avatarProfileView ?? undefined}
            data-game-profile-building={gardenBuilding ? '1' : '0'}
            data-game-profile-building-fixture={
                gardenBuilding ? gardenBuildingFixture : undefined
            }
            data-game-profile-closeup-raised-bed-id={
                closeupRaisedBedId ?? undefined
            }
            data-game-profile-outline={outlineProfile ? '1' : '0'}
            data-game-profile-placement={placementProfile ? '1' : '0'}
            data-game-profile-operation-visuals={operationVisuals ? '1' : '0'}
            data-game-profile-static-scene-cache={staticSceneCacheMode}
            data-game-profile-static-scene-cache-occlusion-fixture={
                staticSceneCacheOcclusionFixture ? '1' : '0'
            }
            data-game-profile-source-commit={
                process.env.NEXT_PUBLIC_GAME_PROFILE_SOURCE_COMMIT
            }
            data-game-profile-source-dirty={
                process.env.NEXT_PUBLIC_GAME_PROFILE_SOURCE_DIRTY
            }
            data-game-profile-weather-surface={weatherSurfaceMode}
            data-game-profile-operation-visual-highlight-raised-bed-id={
                operationVisuals
                    ? highTargetOperationVisualHighlightTarget.raisedBedId
                    : undefined
            }
            data-game-profile-operation-visual-highlight-field-id={
                operationVisuals
                    ? highTargetOperationVisualHighlightTarget.fieldId
                    : undefined
            }
            data-game-profile-operation-visual-highlight-position-index={
                operationVisuals
                    ? highTargetOperationVisualHighlightTarget.positionIndex
                    : undefined
            }
        >
            <ProfileGameScene
                adaptiveHighQuality={adaptiveHigh}
                key={mode}
                className="h-full w-full"
                dayNightCycleDisabled={false}
                flags={debugGameFlags}
                fixedTimeSeconds={fixedTimeSeconds ?? undefined}
                freezeTime={freezeTime}
                debugHud={showDebugHud}
                gardenSwitchEnabled={gardenSwitchProfile}
                hideHud={!showHud}
                initialQualitySetting={quality}
                enableGameProfileController={
                    adaptiveHigh ||
                    cameraProfile ||
                    gardenSwitchProfile ||
                    lifecycleProfile ||
                    mockGardenProfile === 'fauna-heavy' ||
                    gardenBuilding ||
                    closeupRaisedBedId !== null ||
                    outlineProfile ||
                    placementProfile ||
                    operationVisuals
                }
                enableStaticOpaqueSceneCacheOcclusionFixture={
                    staticSceneCacheOcclusionFixture
                }
                gardenStructureDebugFixture={
                    gardenBuilding &&
                    gardenStructureProfileFixture === undefined
                }
                gardenStructureProfileFixture={gardenStructureProfileFixture}
                gardenAvatarInitialSpawnPoint={
                    gardenAvatar && gardenBuilding
                        ? resolveGardenBuildingAvatarSpawnPoint(
                              gardenBuildingFixture,
                          )
                        : undefined
                }
                gardenAvatarActivationRequest={avatarProfileView ? 1 : 0}
                mockGarden
                mockGardenProfile={mockGardenProfile}
                noControls={!enableControls}
                noSound
                renderDetails={renderDetails}
                staticOpaqueSceneCache={staticSceneCacheMode === 'cache'}
                weather={weather}
                winterMode={mode === 'snow' ? 'winter' : 'summer'}
                zoom={isOperationRewardDebug ? 'far' : 'normal'}
            />
            {isOperationRewardDebug && showLegend ? (
                <OperationRewardDebugOverlay />
            ) : null}
        </main>
    );
}
