import { TZDate } from '@date-fns/tz';

const FORECAST_TIME_ZONE = 'Europe/Zagreb';

export type ForecastEntry = {
    time: number;
    temperature: number;
    symbol: number;
    windDirection: string | null;
    windStrength: number;
    rain: number;
};

export type ForecastDay = {
    date: string;
    entries: ForecastEntry[];
};

export type WeatherNowResponse = {
    symbol: number | null;
    temperature: number | null;
    measuredTemperature: number | null;
    rain: number;
    windDirection: string | null;
    windSpeed: number;
    snowAccumulation: number;
    rainy: number;
    snowy: number;
    cloudy: number;
    foggy: number;
    thundery: number;
    source: 'forecast' | 'fallback';
    isStale: boolean;
};

export const fallbackWeatherNow: WeatherNowResponse = {
    symbol: null,
    temperature: null,
    measuredTemperature: null,
    rain: 0,
    windDirection: null,
    windSpeed: 0,
    snowAccumulation: 0,
    rainy: 0,
    snowy: 0,
    cloudy: 0.2,
    foggy: 0,
    thundery: 0,
    source: 'fallback',
    isStale: true,
};

export function findClosestForecastEntry(
    forecast: ForecastDay[],
    nowMs: number,
) {
    let closestEntry: ForecastEntry | null = null;
    let minDiff = Number.POSITIVE_INFINITY;

    for (const day of forecast) {
        for (const entry of day.entries) {
            const [year, month, dayOfMonth] = day.date.split('-').map(Number);
            const entryDateTime = new TZDate(
                year,
                month - 1,
                dayOfMonth,
                entry.time,
                0,
                0,
                0,
                FORECAST_TIME_ZONE,
            );
            const diff = Math.abs(entryDateTime.getTime() - nowMs);
            if (diff < minDiff) {
                minDiff = diff;
                closestEntry = entry;
            }
        }
    }

    return closestEntry;
}

export function pickFarmSnowAccumulation(
    farms: Array<{ id: number | string; snowAccumulation: number }>,
    farmId?: string,
): number {
    return pickWeatherFarm(farms, farmId)?.snowAccumulation ?? 0;
}

export function pickWeatherFarm<T extends { id: number | string }>(
    farms: T[],
    farmId?: string,
): T | undefined {
    if (farmId) {
        const farm = farms.find(
            (currentFarm) => String(currentFarm.id) === farmId,
        );
        if (farm) return farm;
    }
    return farms[0];
}
