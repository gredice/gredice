import { TZDate } from '@date-fns/tz';
import { parseStringPromise } from 'xml2js';

const DHMZ_BJELOVAR_FORECAST_URL = 'https://meteo.hr/7d_graf_i_simboli.xml';
const FORECAST_TIME_ZONE = 'Europe/Zagreb';
const MAX_SOURCE_AGE_MS = 36 * 60 * 60 * 1000;
const EXPIRED_FORECAST_GRACE_MS = 3 * 60 * 60 * 1000;

interface WeatherEntry {
    time: number;
    temperature: number;
    symbol: number;
    windDirection: string | null;
    windStrength: number;
    rain: number;
}

interface DayForecast {
    date: string;
    minTemp: number;
    maxTemp: number;
    symbol: number;
    windDirection: string | null;
    windStrength: number;
    rain: number;
    entries: WeatherEntry[];
}

interface CityData {
    $: {
        ime?: string;
        code?: string;
    };
    dan: Array<{
        $: {
            datum: string;
            sat: string;
        };
        t_2m: string[];
        simbol: string[];
        vjetar: string[];
        oborina: string[];
    }>;
}

type XmlTextElement =
    | string
    | {
          _: string;
          $?: Record<string, string>;
      };

interface ForecastXmlRoot {
    izmjena?: XmlTextElement[];
    grad?: CityData[];
}

interface ParsedXmlData {
    sedamdana?: ForecastXmlRoot;
    sedmodnevna_aliec?: ForecastXmlRoot;
}

function textValue(value: string[] | undefined): string | null {
    const firstValue = value?.[0]?.trim();
    return firstValue ? firstValue : null;
}

function parseFiniteNumber(value: string | null): number | null {
    if (!value) return null;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function parseForecastDate(value: string | undefined): string | null {
    if (!value) return null;
    const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\.$/.exec(value.trim());
    if (!match) return null;

    const day = match[1];
    const month = match[2];
    const year = match[3];
    if (!day || !month || !year) return null;

    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function forecastEntryDate(date: string, hour: number): Date | null {
    const [year, month, day] = date.split('-').map(Number);
    if (!year || !month || !day || !Number.isFinite(hour)) return null;

    return new TZDate(year, month - 1, day, hour, 0, 0, 0, FORECAST_TIME_ZONE);
}

function parseIssuedAt(value: XmlTextElement[] | undefined): Date | null {
    const firstValue = value?.[0];
    const text =
        typeof firstValue === 'string' ? firstValue : (firstValue?._ ?? null);
    if (!text) return null;

    const match =
        /(\d{1,2})\.(\d{1,2})\.(\d{4})\.\s+u\s+(\d{1,2})(?::(\d{2}))?/.exec(
            text,
        );
    if (!match) return null;

    const day = match[1];
    const month = match[2];
    const year = match[3];
    const hour = match[4];
    const minute = match[5] ?? '0';
    if (!day || !month || !year || !hour) return null;

    return new TZDate(
        Number.parseInt(year, 10),
        Number.parseInt(month, 10) - 1,
        Number.parseInt(day, 10),
        Number.parseInt(hour, 10),
        Number.parseInt(minute, 10),
        0,
        0,
        FORECAST_TIME_ZONE,
    );
}

function parseWind(value: string | null): {
    windDirection: string | null;
    windStrength: number;
} {
    if (!value) {
        return { windDirection: null, windStrength: 0 };
    }

    const match = /^([A-Z]+)(\d+)$/.exec(value.trim().toUpperCase());
    if (!match) {
        return { windDirection: null, windStrength: 0 };
    }

    const direction = match[1];
    const strength = Number.parseInt(match[2] ?? '0', 10);
    if (!direction || direction === 'C') {
        return { windDirection: null, windStrength: 0 };
    }

    return {
        windDirection: direction,
        windStrength: Number.isFinite(strength) ? Math.min(strength, 3) : 0,
    };
}

function normalizeCityName(value: string | undefined): string {
    return (value ?? '').trim().replaceAll('_', ' ').toLocaleUpperCase('hr-HR');
}

function isBjelovarForecast(city: CityData): boolean {
    const name = normalizeCityName(city.$.ime);
    const code = normalizeCityName(city.$.code);
    return name === 'BJELOVAR' || code === 'BJELOVAR' || code === '14253';
}

function parseWeatherEntry(entry: CityData['dan'][number]): {
    date: string;
    point: WeatherEntry;
} | null {
    const date = parseForecastDate(entry.$.datum);
    const time = Number.parseInt(entry.$.sat, 10);
    const temperature = parseFiniteNumber(textValue(entry.t_2m));
    const symbolText = textValue(entry.simbol)?.replace(/n$/i, '') ?? null;
    const symbol = symbolText ? Number.parseInt(symbolText, 10) : Number.NaN;
    const rain = parseFiniteNumber(textValue(entry.oborina)) ?? 0;
    const { windDirection, windStrength } = parseWind(textValue(entry.vjetar));

    if (
        !date ||
        !Number.isInteger(time) ||
        time < 0 ||
        time > 23 ||
        temperature == null ||
        !Number.isInteger(symbol)
    ) {
        return null;
    }

    return {
        date,
        point: {
            time,
            temperature,
            symbol,
            windDirection,
            windStrength,
            rain,
        },
    };
}

function getForecastRoot(data: ParsedXmlData): ForecastXmlRoot | null {
    return data.sedamdana ?? data.sedmodnevna_aliec ?? null;
}

function validateForecastFreshness(
    forecast: DayForecast[],
    issuedAt: Date | null,
    now: Date,
) {
    const nowTime = now.getTime();

    if (issuedAt && nowTime - issuedAt.getTime() > MAX_SOURCE_AGE_MS) {
        throw new Error(
            `DHMZ forecast feed is stale; last update was ${issuedAt.toISOString()}`,
        );
    }

    const latestEntryTime = forecast.reduce((latest, day) => {
        const dayLatest = day.entries.reduce((entryLatest, entry) => {
            const entryDate = forecastEntryDate(day.date, entry.time);
            return entryDate
                ? Math.max(entryLatest, entryDate.getTime())
                : entryLatest;
        }, Number.NEGATIVE_INFINITY);
        return Math.max(latest, dayLatest);
    }, Number.NEGATIVE_INFINITY);

    if (
        latestEntryTime === Number.NEGATIVE_INFINITY ||
        latestEntryTime < nowTime - EXPIRED_FORECAST_GRACE_MS
    ) {
        throw new Error('DHMZ forecast feed does not contain current data');
    }
}

export async function parseBjelovarForecastXml(
    xml: string,
    now: Date = new Date(),
): Promise<DayForecast[]> {
    const data: ParsedXmlData = await parseStringPromise(xml);
    const root = getForecastRoot(data);
    const bjelovarForecast = root?.grad?.find(isBjelovarForecast);

    if (!root || !bjelovarForecast) {
        console.warn('Bjelovar forecast not found.');
        throw new Error('Bjelovar forecast not found.');
    }

    const forecastByDate = new Map<string, DayForecast>();

    for (const sourceEntry of bjelovarForecast.dan ?? []) {
        const parsedEntry = parseWeatherEntry(sourceEntry);
        if (!parsedEntry) continue;

        const { date, point } = parsedEntry;
        const currentDay = forecastByDate.get(date);

        if (!currentDay) {
            forecastByDate.set(date, {
                date,
                minTemp: point.temperature,
                maxTemp: point.temperature,
                windDirection: point.windDirection,
                windStrength: point.windStrength,
                entries: [point],
                symbol: point.symbol,
                rain: point.rain,
            });
            continue;
        }

        currentDay.minTemp = Math.min(currentDay.minTemp, point.temperature);
        currentDay.maxTemp = Math.max(currentDay.maxTemp, point.temperature);
        currentDay.rain += point.rain;

        if (point.windStrength > currentDay.windStrength) {
            currentDay.windDirection = point.windDirection;
            currentDay.windStrength = point.windStrength;
        }
        currentDay.entries.push(point);
    }

    const forecast = Array.from(forecastByDate.values())
        .map((day) => ({
            ...day,
            entries: day.entries.sort((a, b) => a.time - b.time),
            rain: Math.round(day.rain * 10) / 10,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

    if (forecast.length === 0) {
        throw new Error('No usable Bjelovar forecast entries found.');
    }

    validateForecastFreshness(forecast, parseIssuedAt(root.izmjena), now);

    return forecast;
}

export async function getBjelovarForecast(): Promise<DayForecast[]> {
    try {
        console.info('Fetching forecast data for Bjelovar...', {
            url: DHMZ_BJELOVAR_FORECAST_URL,
        });
        const response = await fetch(DHMZ_BJELOVAR_FORECAST_URL);
        if (!response.ok) {
            throw new Error(
                `DHMZ forecast request failed with ${response.status}`,
            );
        }

        const xml = await response.text();
        return await parseBjelovarForecastXml(xml);
    } catch (error) {
        console.error('Error fetching or parsing weather data:', error);
        throw error;
    }
}
