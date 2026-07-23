import {
    type GameSceneProps,
    isOperationVisualRewardDebugProfile,
    operationVisualRewardDebugProfile,
    operationVisualRewardDebugScenarios,
} from '@gredice/game';
import { ProfileGameScene } from './ProfileGameScene';
import {
    gameProfileClearWeather,
    gameProfileCloudyWeather,
} from './profileWeather';

type GameProfileSearchParams = Promise<
    Record<string, string | string[] | undefined>
>;

type GameProfileMode =
    | 'baseline'
    | 'cloudy'
    | 'details'
    | 'rain'
    | 'snow'
    | 'night'
    | 'storm'
    | 'autumn'
    | 'windy';

type GameProfileMockGardenProfile = NonNullable<
    GameSceneProps['mockGardenProfile']
>;

const debugGameFlags = {
    enableDebugHudFlag: true,
    enableRainWetOverlayFlag: true,
} satisfies NonNullable<GameSceneProps['flags']>;

function firstValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
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
        value === operationVisualRewardDebugProfile ||
        value === 'plant-heavy'
    ) {
        return value;
    }

    return 'default';
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
    const mockGardenProfile = resolveMockGardenProfile(
        firstValue(params.profile),
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
            data-game-profile-controls={enableControls ? '1' : '0'}
            data-game-profile-details={renderDetails ? '1' : '0'}
            data-game-profile-debug-hud={showDebugHud ? '1' : '0'}
            data-game-profile-hud={showHud ? '1' : '0'}
            data-game-profile-garden-profile={mockGardenProfile}
            data-game-profile-quality={quality ?? 'auto'}
        >
            <ProfileGameScene
                key={mode}
                className="h-full w-full"
                dayNightCycleDisabled={false}
                flags={debugGameFlags}
                freezeTime={freezeTime}
                debugHud={showDebugHud}
                hideHud={!showHud}
                initialQualitySetting={quality}
                mockGarden
                mockGardenProfile={mockGardenProfile}
                noControls={!enableControls}
                noSound
                renderDetails={renderDetails}
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
