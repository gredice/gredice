import type { GameSceneProps } from '@gredice/game';

export type GameProfileWeatherTransitionRequest =
    | 'clear-to-cloudy'
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

export const gameProfileSnowSparseWeather = {
    ...gameProfileClearWeather,
    snowAccumulation: 0.75,
    windSpeed: 1.3,
} satisfies NonNullable<GameSceneProps['weather']>;

export const gameProfileSnowIntegratedWeather = {
    ...gameProfileSnowSparseWeather,
    snowAccumulation: 24,
} satisfies NonNullable<GameSceneProps['weather']>;

export function readGameProfileWeatherTransitionRequest(value: unknown) {
    if (typeof value !== 'object' || value === null) {
        return undefined;
    }

    const request = Reflect.get(value, 'request');
    return request === 'clear-to-cloudy' ||
        request === 'cloudy-to-clear' ||
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
    if (request === 'snow-sparse-to-integrated') {
        return gameProfileSnowIntegratedWeather;
    }
    if (request === 'snow-integrated-to-sparse') {
        return gameProfileSnowSparseWeather;
    }
    return gameProfileClearWeather;
}
