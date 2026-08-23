export type EnvironmentWeather = {
    cloudy?: number;
    foggy?: number;
    rainy?: number;
    snowAccumulation?: number;
    snowy?: number;
    thundery?: number;
    windDirection?: string | null;
    windSpeed?: number;
};

export type WeatherBlendState = {
    isBlending: boolean;
    weather: EnvironmentWeather | undefined;
};

export const weatherBlendEpsilon = 0.0005;

function dampNumber(
    current: number,
    target: number,
    smoothing: number,
    delta: number,
) {
    if (!Number.isFinite(current)) {
        return target;
    }

    const amount = 1 - Math.exp(-Math.max(0.0001, smoothing) * delta);
    return current + (target - current) * amount;
}

function isWithinBlendEpsilon(
    current: number | null | undefined,
    target: number | null | undefined,
) {
    return Math.abs((current ?? 0) - (target ?? 0)) <= weatherBlendEpsilon;
}

export function hasWeatherBlendConverged(
    current: EnvironmentWeather,
    target: EnvironmentWeather,
) {
    return (
        isWithinBlendEpsilon(current.cloudy, target.cloudy) &&
        isWithinBlendEpsilon(current.foggy, target.foggy) &&
        isWithinBlendEpsilon(current.rainy, target.rainy) &&
        isWithinBlendEpsilon(current.snowy, target.snowy) &&
        isWithinBlendEpsilon(current.windSpeed, target.windSpeed) &&
        isWithinBlendEpsilon(current.snowAccumulation, target.snowAccumulation)
    );
}

export function resolveWeatherBlendTarget(
    state: WeatherBlendState,
    target: EnvironmentWeather | undefined,
    enabled: boolean,
): WeatherBlendState {
    if (!enabled || !target || !state.weather) {
        if (state.weather === target && !state.isBlending) {
            return state;
        }

        return {
            isBlending: false,
            weather: target,
        };
    }

    if (hasWeatherBlendConverged(state.weather, target)) {
        if (state.weather === target && !state.isBlending) {
            return state;
        }

        return {
            isBlending: false,
            weather: target,
        };
    }

    if (state.isBlending) {
        return state;
    }

    return {
        isBlending: true,
        weather: state.weather,
    };
}

export function advanceWeatherBlend(
    state: WeatherBlendState,
    target: EnvironmentWeather | undefined,
    transitionSeconds: number,
    delta: number,
): WeatherBlendState {
    if (!state.isBlending || !state.weather || !target) {
        return state;
    }

    const smoothing = 1 / Math.max(0.0001, transitionSeconds);
    const nextWeather = {
        ...target,
        cloudy: dampNumber(
            state.weather.cloudy ?? 0,
            target.cloudy ?? 0,
            smoothing,
            delta,
        ),
        foggy: dampNumber(
            state.weather.foggy ?? 0,
            target.foggy ?? 0,
            smoothing,
            delta,
        ),
        rainy: dampNumber(
            state.weather.rainy ?? 0,
            target.rainy ?? 0,
            smoothing,
            delta,
        ),
        snowy: dampNumber(
            state.weather.snowy ?? 0,
            target.snowy ?? 0,
            smoothing,
            delta,
        ),
        windSpeed: dampNumber(
            state.weather.windSpeed ?? 0,
            target.windSpeed ?? 0,
            smoothing,
            delta,
        ),
        snowAccumulation: dampNumber(
            state.weather.snowAccumulation ?? 0,
            target.snowAccumulation ?? 0,
            smoothing,
            delta,
        ),
        // Keep direction and thunder discrete to preserve deterministic storm
        // timing and prevent jitter around cardinal boundaries.
        windDirection: target.windDirection,
        thundery: target.thundery,
    };

    if (hasWeatherBlendConverged(nextWeather, target)) {
        return {
            isBlending: false,
            weather: target,
        };
    }

    return {
        isBlending: true,
        weather: nextWeather,
    };
}
