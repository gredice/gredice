import { GameScene, type GameSceneProps } from '@gredice/game';

type GameProfileSearchParams = Promise<
    Record<string, string | string[] | undefined>
>;

type GameProfileMode = 'baseline' | 'details' | 'rain' | 'snow';

function firstValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

function resolveMode(value: string | undefined): GameProfileMode {
    if (
        value === 'baseline' ||
        value === 'details' ||
        value === 'rain' ||
        value === 'snow'
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

function resolveWeather(
    mode: GameProfileMode,
): GameSceneProps['weather'] | undefined {
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

    return undefined;
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
    const quality = resolveQuality(firstValue(params.quality));
    const weather = resolveWeather(mode);

    return (
        <main
            className="h-screen w-screen overflow-hidden bg-neutral-950"
            data-game-profile-mode={mode}
            data-game-profile-quality={quality ?? 'auto'}
        >
            <GameScene
                className="h-full w-full"
                deferDetails={!renderDetails}
                hideHud={!showHud}
                mockGarden
                noControls={!enableControls}
                noSound
                noWeather={!weather}
                quality={quality}
                weather={weather}
                winterMode={mode === 'snow' ? 'winter' : 'summer'}
            />
        </main>
    );
}
