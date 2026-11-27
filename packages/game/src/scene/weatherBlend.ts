export type EnvironmentWeather = {
    temperature?: number | null;
    isStale?: boolean;
    source?: string;
    cloudy?: number;
    foggy?: number;
    rainy?: number;
    snowAccumulation?: number;
    snowy?: number;
    thundery?: number;
    windDirection?: string | null;
    windSpeed?: number;
    /**
     * Damped storm amount, 0 to 1, that follows the discrete `thundery`
     * flag while a blend runs (GAME_ART.md "Weather > Blends": the storm
     * tint follows a damped storm amount, the bolt itself stops at once).
     * Only blended weather carries it; read it with `resolveWeatherStorm`,
     * which falls back to the thunder flag once the blend has converged.
     */
    storm?: number;
};

export type WeatherBlendState = {
    isBlending: boolean;
    weather: EnvironmentWeather | undefined;
};

export const weatherBlendEpsilon = 0.0005;

function clamp01(value: number) {
    return Math.min(1, Math.max(0, value));
}

/** The storm amount a weather state blends toward: its thunder flag. */
export function getWeatherStormTarget(
    weather: EnvironmentWeather | null | undefined,
) {
    const thundery = weather?.thundery ?? 0;
    return Number.isFinite(thundery) ? clamp01(thundery) : 0;
}

/**
 * Damped storm amount of blended weather, 0 to 1. During a blend it eases
 * like the other amounts; at rest it equals the thunder flag.
 */
export function resolveWeatherStorm(
    weather: EnvironmentWeather | null | undefined,
) {
    const storm = weather?.storm;
    return typeof storm === 'number' && Number.isFinite(storm)
        ? clamp01(storm)
        : getWeatherStormTarget(weather);
}

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
        isWithinBlendEpsilon(
            current.snowAccumulation,
            target.snowAccumulation,
        ) &&
        isWithinBlendEpsilon(
            resolveWeatherStorm(current),
            resolveWeatherStorm(target),
        )
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
        storm: dampNumber(
            resolveWeatherStorm(state.weather),
            getWeatherStormTarget(target),
            smoothing,
            delta,
        ),
        // Keep direction and thunder discrete to preserve deterministic storm
        // timing and prevent jitter around cardinal boundaries. The storm
        // tint follows the damped `storm` amount instead.
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
