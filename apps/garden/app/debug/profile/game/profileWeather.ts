import type {
    GameSceneProps,
    WeatherDebugOptions,
    WeatherHiddenLayer,
    WeatherLightningDebug,
} from '@gredice/game';

export type GameProfileWeatherTransitionRequest =
    | 'clear-to-cloudy'
    | 'clear-to-rain'
    | 'clear-to-frost'
    | 'frost-to-clear'
    | 'cloudy-to-clear'
    | 'rain-to-clear'
    | 'snow-integrated-to-sparse'
    | 'snow-sparse-to-integrated';

export const gameProfileWeatherTransitionEventName =
    'gredice:game-profile-weather-transition';

export const gameProfileClearWeather = {
    cloudy: 0,
    rainy: 0,
    snowy: 0,
    foggy: 0,
    windSpeed: 0,
    windDirection: 0,
    snowAccumulation: 0,
} satisfies NonNullable<GameSceneProps['weather']>;

export const gameProfileCloudyWeather = {
    ...gameProfileClearWeather,
    cloudy: 0.85,
    foggy: 0.06,
    windSpeed: 0.35,
    windDirection: 80,
} satisfies NonNullable<GameSceneProps['weather']>;

/** Partly cloudy: three clouds in free sky and moving cloud shadows. */
export const gameProfilePartlyCloudyWeather = {
    ...gameProfileClearWeather,
    cloudy: 0.4,
    windSpeed: 1,
    windDirection: 80,
} satisfies NonNullable<GameSceneProps['weather']>;

/** Light rain: the target's rain preset (heavy rain is `mode=rain`). */
export const gameProfileLightRainWeather = {
    ...gameProfileClearWeather,
    cloudy: 0.85,
    rainy: 0.6,
    foggy: 0.08,
    windSpeed: 1,
    windDirection: 90,
} satisfies NonNullable<GameSceneProps['weather']>;

/** Fog at any hour (`mode=mist` forces 08:00 for the morning mist). */
export const gameProfileFogWeather = {
    ...gameProfileClearWeather,
    cloudy: 0.2,
    foggy: 1,
    windSpeed: 0.5,
    windDirection: 80,
} satisfies NonNullable<GameSceneProps['weather']>;

export const gameProfileSnowSparseWeather = {
    ...gameProfileClearWeather,
    snowAccumulation: 0.75,
    windSpeed: 1.3,
} satisfies NonNullable<GameSceneProps['weather']>;

export const gameProfileSnowIntegratedWeather = {
    ...gameProfileSnowSparseWeather,
    snowAccumulation: 24,
} satisfies NonNullable<GameSceneProps['weather']>;

/** Exact inputs committed to GameScene, separate from effect-policy diagnostics. */
export function createGameProfileWeatherWitness(
    weather: GameSceneProps['weather'],
) {
    return {
        cloudy: weather?.cloudy ?? 0,
        foggy: weather?.foggy ?? 0,
        rainy: weather?.rainy ?? 0,
        snowy: weather?.snowy ?? 0,
        snowAccumulation: weather?.snowAccumulation ?? 0,
        temperature: weather?.temperature ?? null,
        source:
            weather && 'source' in weather && typeof weather.source === 'string'
                ? weather.source
                : null,
        isStale:
            weather &&
            'isStale' in weather &&
            typeof weather.isStale === 'boolean'
                ? weather.isStale
                : null,
    };
}

export function readGameProfileWeatherTransitionRequest(value: unknown) {
    if (typeof value !== 'object' || value === null) {
        return undefined;
    }

    const request = Reflect.get(value, 'request');
    return request === 'clear-to-cloudy' ||
        request === 'cloudy-to-clear' ||
        request === 'clear-to-rain' ||
        request === 'clear-to-frost' ||
        request === 'frost-to-clear' ||
        request === 'rain-to-clear' ||
        request === 'snow-integrated-to-sparse' ||
        request === 'snow-sparse-to-integrated'
        ? request
        : undefined;
}

export function resolveGameProfileWeatherTransition(
    request: GameProfileWeatherTransitionRequest,
) {
    if (request === 'clear-to-cloudy') {
        return gameProfileCloudyWeather;
    }
    if (request === 'clear-to-rain') {
        return {
            ...gameProfileClearWeather,
            rainy: 1,
            source: 'profile',
            isStale: false,
        };
    }
    if (request === 'clear-to-frost') {
        return {
            ...gameProfileClearWeather,
            temperature: -4,
            source: 'profile',
            isStale: false,
        };
    }
    if (request === 'frost-to-clear') {
        return {
            ...gameProfileClearWeather,
            temperature: 12,
            source: 'profile',
            isStale: false,
        };
    }
    if (request === 'snow-sparse-to-integrated') {
        return gameProfileSnowIntegratedWeather;
    }
    if (request === 'snow-integrated-to-sparse') {
        return gameProfileSnowSparseWeather;
    }
    return gameProfileClearWeather;
}

/** `zoom=<pixels per world unit>`: a positive camera zoom, else none. */
export function resolveGameProfileCameraZoom(value: string | undefined) {
    if (!value) {
        return undefined;
    }
    const zoom = Number(value);
    return Number.isFinite(zoom) && zoom > 0 ? zoom : undefined;
}

/** `reducedMotion=1` forces reduced motion on, `=0` off; unset follows the OS. */
export function resolveGameProfileReducedMotion(value: string | undefined) {
    if (value === '1' || value === 'true') return true;
    if (value === '0' || value === 'false') return false;
    return undefined;
}

const hiddenWeatherLayers: readonly WeatherHiddenLayer[] = [
    'rain',
    'snow',
    'lightning',
    'sky',
];

/** `hideWeather=rain|snow|lightning|sky`, several separated by commas. */
export function resolveGameProfileHiddenWeather(
    value: string | undefined,
): WeatherHiddenLayer[] {
    const names = (value ?? '').split(',').map((name) => name.trim());
    return hiddenWeatherLayers.filter((layer) => names.includes(layer));
}

/** `lightning=off` (or `0`) stops strikes; `lightning=at:1.5` strikes at 1.5 s. */
export function resolveGameProfileLightning(
    value: string | undefined,
): WeatherLightningDebug | undefined {
    if (value === 'off' || value === '0') {
        return { mode: 'off' };
    }
    const match = /^at:(\d+(?:\.\d+)?)$/.exec(value ?? '');
    if (!match?.[1]) {
        return undefined;
    }
    const seconds = Number(match[1]);
    return Number.isFinite(seconds) ? { mode: 'at', seconds } : undefined;
}

/** Weather debug switches for `GameScene`, or none when no switch is set. */
export function resolveGameProfileWeatherDebug({
    hideWeather,
    lightning,
    reducedMotion,
    weatherInspect,
}: {
    hideWeather?: string;
    lightning?: string;
    reducedMotion?: string;
    weatherInspect?: string;
}): WeatherDebugOptions | undefined {
    const options: WeatherDebugOptions = {};
    const reduced = resolveGameProfileReducedMotion(reducedMotion);
    if (reduced !== undefined) options.reducedMotion = reduced;
    const hide = resolveGameProfileHiddenWeather(hideWeather);
    if (hide.length > 0) options.hide = hide;
    const strike = resolveGameProfileLightning(lightning);
    if (strike) options.lightning = strike;
    if (weatherInspect === '1') options.inspect = true;
    return Object.keys(options).length > 0 ? options : undefined;
}
