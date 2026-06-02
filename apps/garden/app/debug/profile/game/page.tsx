import { GameScene, type GameSceneProps } from '@gredice/game';

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

const clearWeather = {
    cloudy: 0,
    rainy: 0,
    snowy: 0,
    foggy: 0,
    windSpeed: 0,
    windDirection: 0,
    snowAccumulation: 0,
} satisfies NonNullable<GameSceneProps['weather']>;

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

function resolveQuality(value: string | undefined): GameSceneProps['quality'] {
    if (value === 'low' || value === 'medium' || value === 'high') {
        return value;
    }

    return undefined;
}

function resolveMockGardenProfile(
    value: string | undefined,
): GameProfileMockGardenProfile {
    if (value === 'dense' || value === 'plant-heavy') {
        return value;
    }

    return 'default';
}

function resolveWeather(
    mode: GameProfileMode,
): NonNullable<GameSceneProps['weather']> {
    if (mode === 'cloudy') {
        return {
            ...clearWeather,
            cloudy: 0.85,
            foggy: 0.06,
            windSpeed: 0.35,
            windDirection: 80,
        };
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
            ...clearWeather,
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
            ...clearWeather,
            cloudy: 0.35,
            foggy: 0.08,
            windSpeed: 0.7,
            windDirection: 270,
        };
    }

    if (mode === 'windy') {
        return {
            ...clearWeather,
            cloudy: 0.45,
            foggy: 0.04,
            windSpeed: 2.4,
            windDirection: 235,
        };
    }

    return clearWeather;
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

export default async function GameProfilePage({
    searchParams,
}: {
    searchParams: GameProfileSearchParams;
}) {
    const params = await searchParams;
    const mode = resolveMode(firstValue(params.mode));
    const renderDetails =
        mode === 'details' || firstValue(params.details) === '1';
    const showHud = firstValue(params.hud) === '1';
    const enableControls = firstValue(params.controls) !== '0';
    const mockGardenProfile = resolveMockGardenProfile(
        firstValue(params.profile),
    );
    const quality = resolveQuality(firstValue(params.quality));
    const weather = resolveWeather(mode);
    const freezeTime = resolveFreezeTime(mode);

    return (
        <main
            className="h-screen w-screen overflow-hidden bg-[#e7e2cc]"
            data-game-profile-mode={mode}
            data-game-profile-controls={enableControls ? '1' : '0'}
            data-game-profile-garden-profile={mockGardenProfile}
            data-game-profile-quality={quality ?? 'auto'}
        >
            <GameScene
                className="h-full w-full"
                dayNightCycleDisabled={false}
                deferDetails={!renderDetails}
                flags={debugGameFlags}
                freezeTime={freezeTime}
                hideHud={!showHud}
                mockGarden
                mockGardenProfile={mockGardenProfile}
                noControls={!enableControls}
                noSound
                quality={quality}
                weather={weather}
                winterMode={mode === 'snow' ? 'winter' : 'summer'}
            />
        </main>
    );
}
