export type BeeWeather = {
    cloudy?: number | null;
    foggy?: number | null;
    rainy?: number | null;
    snowy?: number | null;
    thundery?: number | null;
    windSpeed?: number | null;
};

const BEE_DAY_START = 0.28;
const BEE_DAY_END = 0.74;
const MAX_BEE_CLOUD_COVER = 0.42;
const MAX_BEE_WIND_SPEED = 1.2;
const MAX_BEE_BAD_WEATHER = 0.05;

export function isBeeDaytime(timeOfDay: number) {
    return timeOfDay >= BEE_DAY_START && timeOfDay <= BEE_DAY_END;
}

export function isBeeWeatherSuitable(weather: BeeWeather | null | undefined) {
    if (!weather) {
        return false;
    }

    return (
        (weather.cloudy ?? 0) <= MAX_BEE_CLOUD_COVER &&
        (weather.foggy ?? 0) <= MAX_BEE_BAD_WEATHER &&
        (weather.rainy ?? 0) <= MAX_BEE_BAD_WEATHER &&
        (weather.snowy ?? 0) <= MAX_BEE_BAD_WEATHER &&
        (weather.thundery ?? 0) <= MAX_BEE_BAD_WEATHER &&
        (weather.windSpeed ?? 0) <= MAX_BEE_WIND_SPEED
    );
}

export function isBeeActive(
    timeOfDay: number,
    weather: BeeWeather | null | undefined,
) {
    return isBeeDaytime(timeOfDay) && isBeeWeatherSuitable(weather);
}

export function getBeeDwellSeconds(random: () => number) {
    return 2.4 + random() * 3.6;
}

export function getBeeCount(flowerTargetCount: number) {
    if (flowerTargetCount <= 0) {
        return 0;
    }

    return Math.min(4, Math.max(1, Math.ceil(flowerTargetCount / 6)));
}
