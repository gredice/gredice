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

export function findClosestForecastEntry(forecast: ForecastDay[], nowMs: number) {
  let closestEntry: ForecastEntry | null = null;
  let minDiff = Number.POSITIVE_INFINITY;

  for (const day of forecast) {
    for (const entry of day.entries) {
      const entryDateTime = new Date(`${day.date}T${entry.time.toString().padStart(2, '0')}:00:00+01:00`);
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
  farms: Array<{ id: string; snowAccumulation: number }>,
  farmId?: string,
): number {
  if (farmId) {
    const farm = farms.find((currentFarm) => currentFarm.id === farmId);
    if (farm) return farm.snowAccumulation;
  }
  return farms[0]?.snowAccumulation ?? 0;
}
