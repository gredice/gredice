/**
 * Shared, framework-agnostic helpers for combining historical and forecast
 * weather data into a single time series suitable for charting in both the
 * in-game weather HUD and the administration app.
 */

export type WeatherSeriesSource = 'history' | 'forecast';

/** A single weather observation persisted in the `weather_history` table. */
export interface WeatherHistoryPoint {
    recordedAt: string | Date;
    symbol?: number | null;
    temperature?: number | null;
    rain?: number | null;
    windDirection?: string | null;
    windSpeed?: number | null;
    rainy?: number | null;
    snowy?: number | null;
    cloudy?: number | null;
    foggy?: number | null;
    thundery?: number | null;
}

/** A single hourly forecast entry as returned by the weather forecast API. */
export interface WeatherForecastEntry {
    time: number;
    temperature?: number | null;
    symbol?: number | null;
    windDirection?: string | null;
    windStrength?: number | null;
    rain?: number | null;
}

/** A forecast day (as returned by `GET /api/data/weather`). */
export interface WeatherForecastDay {
    date: string;
    symbol?: number | null;
    windDirection?: string | null;
    windStrength?: number | null;
    rain?: number | null;
    entries?: WeatherForecastEntry[];
}

/** A normalized point on the unified weather time series. */
export interface WeatherSeriesPoint {
    /** Unix timestamp in milliseconds. */
    timestamp: number;
    temperature: number | null;
    rain: number;
    windSpeed: number;
    windDirection: string | null;
    symbol: number | null;
    source: WeatherSeriesSource;
}

export type WeatherMetricKey = 'temperature' | 'rain' | 'wind';

export interface WeatherMetricDefinition {
    key: WeatherMetricKey;
    /** Croatian label used in the UI. */
    label: string;
    unit: string;
    /** Recharts-friendly data key on {@link WeatherSeriesPoint}. */
    dataKey: 'temperature' | 'rain' | 'windSpeed';
    color: string;
}

export const weatherMetrics: WeatherMetricDefinition[] = [
    {
        key: 'temperature',
        label: 'Temperatura',
        unit: '°C',
        dataKey: 'temperature',
        color: '#ef4444',
    },
    {
        key: 'rain',
        label: 'Padaline',
        unit: 'mm',
        dataKey: 'rain',
        color: '#3b82f6',
    },
    {
        key: 'wind',
        label: 'Vjetar',
        unit: 'm/s',
        dataKey: 'windSpeed',
        color: '#10b981',
    },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Default visible range for the weather charts: the last 7 days of history and
 * the next 3 days of forecast.
 */
export function getDefaultWeatherRange(now: Date = new Date()): {
    from: Date;
    to: Date;
} {
    return {
        from: new Date(now.getTime() - 7 * DAY_MS),
        to: new Date(now.getTime() + 3 * DAY_MS),
    };
}

/** Convert a compass direction (e.g. `NW`) to degrees clockwise from north. */
export function windDirectionToDegrees(
    direction: string | null | undefined,
): number | null {
    if (!direction) return null;
    const map: Record<string, number> = {
        N: 0,
        NNE: 22.5,
        NE: 45,
        ENE: 67.5,
        E: 90,
        ESE: 112.5,
        SE: 135,
        SSE: 157.5,
        S: 180,
        SSW: 202.5,
        SW: 225,
        WSW: 247.5,
        W: 270,
        WNW: 292.5,
        NW: 315,
        NNW: 337.5,
    };
    const normalized = direction.trim().toUpperCase();
    return normalized in map ? map[normalized] : null;
}

function toTimestamp(value: string | Date): number {
    return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/** Map raw history rows to normalized series points. */
export function historyToSeriesPoints(
    history: WeatherHistoryPoint[] | null | undefined,
): WeatherSeriesPoint[] {
    if (!history) return [];
    return history
        .map((point) => ({
            timestamp: toTimestamp(point.recordedAt),
            temperature: point.temperature ?? null,
            rain: point.rain ?? 0,
            windSpeed: point.windSpeed ?? 0,
            windDirection: point.windDirection ?? null,
            symbol: point.symbol ?? null,
            source: 'history' as const,
        }))
        .filter((point) => Number.isFinite(point.timestamp));
}

/** Flatten forecast days into normalized hourly series points. */
export function forecastToSeriesPoints(
    forecast: WeatherForecastDay[] | null | undefined,
): WeatherSeriesPoint[] {
    if (!forecast) return [];
    const points: WeatherSeriesPoint[] = [];
    for (const day of forecast) {
        for (const entry of day.entries ?? []) {
            const hour = entry.time.toString().padStart(2, '0');
            const timestamp = new Date(`${day.date}T${hour}:00:00`).getTime();
            if (!Number.isFinite(timestamp)) continue;
            points.push({
                timestamp,
                temperature: entry.temperature ?? null,
                rain: entry.rain ?? 0,
                windSpeed: entry.windStrength ?? 0,
                windDirection: entry.windDirection ?? null,
                symbol: entry.symbol ?? day.symbol ?? null,
                source: 'forecast',
            });
        }
    }
    return points;
}

/**
 * Combine history and forecast into a single sorted series, restricted to the
 * provided range. Historical observations win over forecast for any past
 * timestamp; forecast fills the future.
 */
export function buildWeatherSeries(
    history: WeatherHistoryPoint[] | null | undefined,
    forecast: WeatherForecastDay[] | null | undefined,
    range?: { from: Date | number; to: Date | number },
    now: Date = new Date(),
): WeatherSeriesPoint[] {
    const nowTs = now.getTime();
    const historyPoints = historyToSeriesPoints(history);
    const forecastPoints = forecastToSeriesPoints(forecast).filter(
        (point) => point.timestamp >= nowTs,
    );

    const byHour = new Map<number, WeatherSeriesPoint>();
    // Forecast first so that overlapping history observations overwrite them.
    for (const point of forecastPoints) {
        byHour.set(point.timestamp, point);
    }
    for (const point of historyPoints) {
        byHour.set(point.timestamp, point);
    }

    let points = Array.from(byHour.values());

    if (range) {
        const from = range.from instanceof Date ? range.from.getTime() : range.from;
        const to = range.to instanceof Date ? range.to.getTime() : range.to;
        points = points.filter(
            (point) => point.timestamp >= from && point.timestamp <= to,
        );
    }

    return points.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Compute the selectable bounds for the date-range picker: the earliest
 * available history timestamp and the latest available forecast timestamp.
 */
export function getWeatherDataBounds(
    historyFrom: string | Date | null | undefined,
    forecast: WeatherForecastDay[] | null | undefined,
    now: Date = new Date(),
): { min: Date; max: Date } {
    const defaults = getDefaultWeatherRange(now);

    const min = historyFrom ? new Date(toTimestamp(historyFrom)) : defaults.from;

    const forecastPoints = forecastToSeriesPoints(forecast);
    const maxForecastTs = forecastPoints.reduce(
        (max, point) => Math.max(max, point.timestamp),
        Number.NEGATIVE_INFINITY,
    );
    const max =
        maxForecastTs > Number.NEGATIVE_INFINITY
            ? new Date(maxForecastTs)
            : defaults.to;

    return { min, max };
}

/** Clamp a requested range into the available data bounds. */
export function clampRangeToBounds(
    range: { from: Date; to: Date },
    bounds: { min: Date; max: Date },
): { from: Date; to: Date } {
    const from = new Date(
        Math.min(Math.max(range.from.getTime(), bounds.min.getTime()), bounds.max.getTime()),
    );
    const to = new Date(
        Math.max(Math.min(range.to.getTime(), bounds.max.getTime()), bounds.min.getTime()),
    );
    return { from, to };
}
