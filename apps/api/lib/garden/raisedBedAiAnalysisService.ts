import { TZDate, tz } from '@date-fns/tz';
import {
    getEntitiesFormatted,
    getOperations,
    getWeatherHistory,
    grediceCached,
    grediceCacheKeys,
    type SelectWeatherHistory,
} from '@gredice/storage';
import { streamText } from 'ai';
import { validateHostedImageUrl } from '../http/safeUrls';
import { getBjelovarForecast } from '../weather/forecast';
import { findClosestForecastEntry } from '../weather/weatherNowContract';

const FORECAST_CACHE_TTL_SECONDS = 60 * 60;
const RAISED_BED_FIELDS_PER_BLOCK = 9;
const RAISED_BED_COLUMNS = 3;
const WEATHER_CONTEXT_TIME_ZONE = 'Europe/Zagreb';
const GREENHOUSE_SEEDLING_STATUSES = new Set([
    'pendingVerification',
    'sowed',
    'sprouted',
]);

const AI_MODEL = process.env.AI_GATEWAY_MODEL ?? 'openai/gpt-5.5';

export const AI_REQUEST_QUOTA_WINDOW_DAYS = 7;
export const AI_REQUEST_QUOTA_WINDOW_MS =
    AI_REQUEST_QUOTA_WINDOW_DAYS * 24 * 60 * 60 * 1000;
export const AI_REQUEST_WEEKLY_LIMIT_PER_ACTIVE_RAISED_BED = 5;
export const RAISED_BED_IMAGE_ANALYSIS_REQUEST_KIND =
    'raisedBedImageAnalysis' as const;

export type AiRequestKind = typeof RAISED_BED_IMAGE_ANALYSIS_REQUEST_KIND;

export const AI_REQUEST_QUOTAS = {
    [RAISED_BED_IMAGE_ANALYSIS_REQUEST_KIND]: {
        baseLimit: AI_REQUEST_WEEKLY_LIMIT_PER_ACTIVE_RAISED_BED,
        windowDays: AI_REQUEST_QUOTA_WINDOW_DAYS,
        windowMs: AI_REQUEST_QUOTA_WINDOW_MS,
    },
} as const satisfies Record<
    AiRequestKind,
    { baseLimit: number; windowDays: number; windowMs: number }
>;

export function getRaisedBedImageAnalysisWeeklyLimit(
    activeRaisedBedCount: number,
) {
    return (
        Math.max(0, activeRaisedBedCount) *
        AI_REQUEST_WEEKLY_LIMIT_PER_ACTIVE_RAISED_BED
    );
}

export function validateImageUrl(imageUrl: string): string | null {
    return validateHostedImageUrl(imageUrl);
}

export function validateImageUrls(imageUrls: string[]): string | null {
    for (const imageUrl of imageUrls) {
        const error = validateImageUrl(imageUrl);
        if (error) {
            return error;
        }
    }

    return null;
}

export function normalizeAnalysisReferenceDate(
    date: Date | string | null | undefined,
) {
    if (!date) {
        return null;
    }

    const dateValue = date instanceof Date ? date : new Date(date);
    return Number.isNaN(dateValue.getTime()) ? null : dateValue;
}

function daysSince(
    date: Date | string | null | undefined,
    referenceDate = new Date(),
) {
    if (!date) {
        return null;
    }

    const dateValue = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(dateValue.getTime())) {
        return null;
    }

    const oneDayMs = 1000 * 60 * 60 * 24;
    return Math.max(
        0,
        Math.floor((referenceDate.getTime() - dateValue.getTime()) / oneDayMs),
    );
}

type RaisedBedAnalysisTarget = {
    id: number;
    orientation?: 'vertical' | 'horizontal' | string | null;
    fields: Array<{
        id: number;
        positionIndex: number;
        plantSortId?: number | string | null;
        plantStatus?: string | null;
        plantSowDate?: Date | string | null;
        plantGrowthDate?: Date | string | null;
        plantReadyDate?: Date | string | null;
        plantHarvestedDate?: Date | string | null;
        plantDeadDate?: Date | string | null;
        plantRemovedDate?: Date | string | null;
        sowingLocation?: 'direct' | 'greenhouse' | string | null;
        toBeRemoved?: boolean | null;
        active?: boolean | null;
    }>;
};

type WeatherDayContext = {
    date: string;
    minTemperatureC: number;
    maxTemperatureC: number;
    rainMm: number;
    symbol: number;
    windDirection: string | null;
    windStrength: number;
};

type WeatherObservationContext = {
    recordedAt: string;
    minutesFromReference: number;
    temperatureC: number | null;
    rainMm: number;
    symbol: number | null;
    windDirection: string | null;
    windSpeed: number;
    rainy: number;
    snowy: number;
    cloudy: number;
    foggy: number;
    thundery: number;
};

type HistoricalWeatherContext = {
    date: string;
    timeZone: string;
    from: string;
    to: string;
    observationCount: number;
    closestObservation: WeatherObservationContext | null;
    dailySummary: {
        minTemperatureC: number | null;
        maxTemperatureC: number | null;
        totalRainMm: number;
        maxWindSpeed: number;
    } | null;
    observations: WeatherObservationContext[];
};

type WeatherContext = {
    location: string;
    referenceDate: string;
    historical: HistoricalWeatherContext | null;
    now: {
        temperatureC: number | null;
        rainMm: number;
        symbol: number | null;
        windDirection: string | null;
        windStrength: number;
    } | null;
    forecast: WeatherDayContext[];
};

function toPositionLabel(positionIndex: number) {
    return positionIndex + 1;
}

function isCurrentlyGreenhouseSeedling(field: {
    sowingLocation?: 'direct' | 'greenhouse' | string | null;
    plantStatus?: string | null;
    plantDeadDate?: Date | string | null;
    plantHarvestedDate?: Date | string | null;
    plantRemovedDate?: Date | string | null;
    active?: boolean | null;
}) {
    return Boolean(
        field.active !== false &&
            field.sowingLocation === 'greenhouse' &&
            GREENHOUSE_SEEDLING_STATUSES.has(field.plantStatus ?? '') &&
            !field.plantDeadDate &&
            !field.plantHarvestedDate &&
            !field.plantRemovedDate,
    );
}

function formatLocalDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

export function getWeatherHistoryDayRange(referenceDate: Date) {
    const localReferenceDate = tz(WEATHER_CONTEXT_TIME_ZONE)(referenceDate);
    const start = new TZDate(
        localReferenceDate.getFullYear(),
        localReferenceDate.getMonth(),
        localReferenceDate.getDate(),
        0,
        0,
        0,
        0,
        WEATHER_CONTEXT_TIME_ZONE,
    );
    const nextStart = new TZDate(
        localReferenceDate.getFullYear(),
        localReferenceDate.getMonth(),
        localReferenceDate.getDate() + 1,
        0,
        0,
        0,
        0,
        WEATHER_CONTEXT_TIME_ZONE,
    );

    return {
        date: formatLocalDateKey(localReferenceDate),
        from: new Date(start.getTime()),
        to: new Date(nextStart.getTime() - 1),
    };
}

function toWeatherObservationContext(
    row: SelectWeatherHistory,
    referenceDate: Date,
): WeatherObservationContext {
    return {
        recordedAt: row.recordedAt.toISOString(),
        minutesFromReference: Math.round(
            Math.abs(row.recordedAt.getTime() - referenceDate.getTime()) /
                (1000 * 60),
        ),
        temperatureC: row.temperature,
        rainMm: row.rain,
        symbol: row.symbol,
        windDirection: row.windDirection,
        windSpeed: row.windSpeed,
        rainy: row.rainy,
        snowy: row.snowy,
        cloudy: row.cloudy,
        foggy: row.foggy,
        thundery: row.thundery,
    };
}

function buildWeatherDailySummary(rows: SelectWeatherHistory[]) {
    if (rows.length === 0) {
        return null;
    }

    const temperatures = rows
        .map((row) => row.temperature)
        .filter((value): value is number => typeof value === 'number');

    return {
        minTemperatureC:
            temperatures.length > 0 ? Math.min(...temperatures) : null,
        maxTemperatureC:
            temperatures.length > 0 ? Math.max(...temperatures) : null,
        totalRainMm: rows.reduce((sum, row) => sum + row.rain, 0),
        maxWindSpeed: rows.reduce(
            (maxWindSpeed, row) => Math.max(maxWindSpeed, row.windSpeed),
            0,
        ),
    };
}

async function buildHistoricalWeatherContext(
    referenceDate: Date,
): Promise<HistoricalWeatherContext | null> {
    const range = getWeatherHistoryDayRange(referenceDate);
    const rows = await getWeatherHistory(range.from, range.to);
    if (rows.length === 0) {
        return {
            date: range.date,
            timeZone: WEATHER_CONTEXT_TIME_ZONE,
            from: range.from.toISOString(),
            to: range.to.toISOString(),
            observationCount: 0,
            closestObservation: null,
            dailySummary: null,
            observations: [],
        };
    }

    const closestRow = rows.reduce((closest, row) => {
        const closestDistance = Math.abs(
            closest.recordedAt.getTime() - referenceDate.getTime(),
        );
        const rowDistance = Math.abs(
            row.recordedAt.getTime() - referenceDate.getTime(),
        );

        return rowDistance < closestDistance ? row : closest;
    }, rows[0]);
    const observations = rows.map((row) =>
        toWeatherObservationContext(row, referenceDate),
    );

    return {
        date: range.date,
        timeZone: WEATHER_CONTEXT_TIME_ZONE,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        observationCount: rows.length,
        closestObservation: toWeatherObservationContext(
            closestRow,
            referenceDate,
        ),
        dailySummary: buildWeatherDailySummary(rows),
        observations,
    };
}

async function buildForecastContext() {
    const forecast = await grediceCached(
        grediceCacheKeys.forecastBjelovar,
        getBjelovarForecast,
        FORECAST_CACHE_TTL_SECONDS,
    );
    const closestEntry = forecast
        ? findClosestForecastEntry(forecast, Date.now())
        : null;

    return {
        now: closestEntry
            ? {
                  temperatureC: closestEntry.temperature,
                  rainMm: closestEntry.rain,
                  symbol: closestEntry.symbol,
                  windDirection: closestEntry.windDirection,
                  windStrength: closestEntry.windStrength,
              }
            : null,
        forecast: (forecast ?? []).slice(0, 5).map((day) => ({
            date: day.date,
            minTemperatureC: day.minTemp,
            maxTemperatureC: day.maxTemp,
            rainMm: day.rain,
            symbol: day.symbol,
            windDirection: day.windDirection,
            windStrength: day.windStrength,
        })),
    };
}

async function buildWeatherContext(
    referenceDate: Date,
): Promise<WeatherContext> {
    const [historyResult, forecastResult] = await Promise.allSettled([
        buildHistoricalWeatherContext(referenceDate),
        buildForecastContext(),
    ]);

    if (historyResult.status === 'rejected') {
        console.warn(
            'Failed to load historical weather context for AI analysis:',
            historyResult.reason,
        );
    }

    if (forecastResult.status === 'rejected') {
        console.warn(
            'Failed to load forecast weather context for AI analysis:',
            forecastResult.reason,
        );
    }

    return {
        location: 'Bjelovar, HR',
        referenceDate: referenceDate.toISOString(),
        historical:
            historyResult.status === 'fulfilled' ? historyResult.value : null,
        now:
            forecastResult.status === 'fulfilled'
                ? forecastResult.value.now
                : null,
        forecast:
            forecastResult.status === 'fulfilled'
                ? forecastResult.value.forecast
                : [],
    };
}

type AnalysisParams = {
    accountId: string;
    gardenId: number;
    raisedBed: RaisedBedAnalysisTarget;
    imageUrls: string[];
    positionIndex?: number;
    referenceDate?: Date | string | null;
};

async function buildAnalysisMessages({
    accountId,
    gardenId,
    raisedBed,
    imageUrls,
    positionIndex,
    referenceDate: inputReferenceDate,
}: AnalysisParams) {
    const inputReferenceDateValue =
        normalizeAnalysisReferenceDate(inputReferenceDate);
    const referenceDate = inputReferenceDateValue ?? new Date();
    const [plantSorts, operations, operationsData, weather] = await Promise.all(
        [
            getEntitiesFormatted<{
                id: string;
                information?: { name?: string };
            }>('plantSort'),
            getOperations(accountId, gardenId, raisedBed.id),
            getEntitiesFormatted<{
                id: string;
                slug?: string;
                attributes?: { application?: string | null };
                information?: { label?: string; name?: string };
            }>('operation'),
            buildWeatherContext(referenceDate),
        ],
    );

    const plantSortNameById = new Map(
        plantSorts.map((sort) => [
            Number(sort.id),
            sort.information?.name ?? sort.id,
        ]),
    );
    const operationNameById = new Map(
        operationsData.map((entity) => [
            Number(entity.id),
            entity.information?.label ?? entity.information?.name ?? entity.id,
        ]),
    );
    const availableOperations = operationsData.map((entity) => {
        const application = entity.attributes?.application ?? null;
        const isRaisedBedOperation =
            application === 'raisedBedFull' || application === 'raisedBed1m';
        const isPlantFieldOperation = application === 'plant';
        const publicOperationUrl = entity.slug
            ? `https://www.gredice.com/radnje/${entity.slug}`
            : null;

        return {
            id: entity.id,
            name:
                entity.information?.label ??
                entity.information?.name ??
                entity.id,
            slug: entity.slug ?? null,
            application,
            raisedBedOperationUrl:
                isRaisedBedOperation && publicOperationUrl
                    ? `${publicOperationUrl}#raisedBedId=${raisedBed.id}`
                    : null,
            plantFieldOperationUrlTemplate:
                isPlantFieldOperation && publicOperationUrl
                    ? `${publicOperationUrl}#raisedBedId=${raisedBed.id}&positionIndex={positionIndex}`
                    : null,
        };
    });

    const plantedFields = raisedBed.fields
        .filter((field) => field.active && field.plantSortId)
        .map((field) => {
            const isGreenhouseSeedling = isCurrentlyGreenhouseSeedling(field);
            return {
                positionIndex: field.positionIndex,
                positionLabel: toPositionLabel(field.positionIndex),
                plantSortId: field.plantSortId,
                plantName:
                    plantSortNameById.get(Number(field.plantSortId)) ??
                    String(field.plantSortId),
                plantStatus: field.plantStatus,
                sowingLocation: field.sowingLocation ?? 'direct',
                currentLocation: isGreenhouseSeedling
                    ? ('greenhouse' as const)
                    : ('raisedBed' as const),
                isGreenhouseSeedling,
                daysFromSowing: daysSince(field.plantSowDate, referenceDate),
                daysFromGrowth: daysSince(field.plantGrowthDate, referenceDate),
                daysFromReady: daysSince(field.plantReadyDate, referenceDate),
                daysFromHarvest: daysSince(
                    field.plantHarvestedDate,
                    referenceDate,
                ),
                daysFromDead: daysSince(field.plantDeadDate, referenceDate),
                needsRemoval: Boolean(field.toBeRemoved),
                isAnalyzedField:
                    typeof positionIndex === 'number' &&
                    field.positionIndex === positionIndex,
            };
        });

    const executedOperations = operations.map((op) => ({
        id: op.id,
        operationId: op.entityId,
        operationName: operationNameById.get(op.entityId) ?? op.entityId,
        status: op.status,
        createdAt: op.createdAt,
        scheduledDate: op.scheduledDate,
        completedAt: op.completedAt,
        fieldId: op.raisedBedFieldId,
    }));

    const totalFields =
        raisedBed.fields.length || RAISED_BED_FIELDS_PER_BLOCK * 2;
    const rows = Math.max(1, Math.ceil(totalFields / RAISED_BED_COLUMNS));
    const orientation = raisedBed.orientation ?? 'vertical';
    const nowIso = new Date().toISOString();
    const referenceDateIso = referenceDate.toISOString();
    const imageDateSource = inputReferenceDateValue
        ? 'requestReferenceDate'
        : 'analysisTimeFallback';
    const analyzedPositionLabel =
        typeof positionIndex === 'number'
            ? toPositionLabel(positionIndex)
            : null;

    return [
        {
            role: 'system' as const,
            content: [
                'Ti si stručni agronom za urbane vrtove. Piši ISKLJUČIVO na hrvatskom jeziku i vrati odgovor kao uredno formatiran markdown. Korisnik nema fizički pristup gredici; kada preporuka traži rad na gredici, predloži naručivanje najbliže odgovarajuće operacije iz dostupnog popisa umjesto da korisniku kažeš da to sam ručno napravi.',
                '',
                'Raspored polja u gredici:',
                `- Standardna gredica ima ${RAISED_BED_COLUMNS} stupca i do ${rows} redova (ukupno do ${totalFields} polja).`,
                '- Polja su numerirana od 1 nadalje, počevši od donjeg desnog kuta slike i čitajući zdesna nalijevo, red po red prema gore.',
                '- Donji red: 1 (donje desno) → 2 (donje sredina) → 3 (donje lijevo).',
                '- Gornji red kod 18-poljne gredice: 16 (gornje desno) → 17 (gornja sredina) → 18 (gornje lijevo).',
                '- U JSON kontekstu vrijednost `positionLabel` koristi ovo brojanje (1-bazirano), dok `positionIndex` ostaje 0-bazirana interna oznaka (`positionLabel = positionIndex + 1`).',
                '- Polja s `currentLocation: "greenhouse"` su presadnice koje trenutno rastu u stakleniku i još nisu presađene u gredicu; polja s `currentLocation: "raisedBed"` su u gredici. `sowingLocation` opisuje gdje je biljka započela.',
                '- `imageDate` je datum fotografija/dnevničkog unosa. Koristi `imageDate`, `analysisReferenceDate` i `weather.historical` za procjenu stanja na fotografijama. `currentDate`, `weather.now` i `weather.forecast` koristi samo za današnje i buduće preporuke za zalijevanje, zaštitu od mraza, sjetvu i berbu.',
                '- Kada preporučiš konkretnu radnju iz `availableOperations`, napiši je kao markdown poveznicu na apsolutni URL iz `raisedBedOperationUrl` ili `plantFieldOperationUrlTemplate`, npr. `[Naziv radnje](https://www.gredice.com/radnje/{slug}#raisedBedId={raisedBedId})`.',
                '- Za radnje nad pojedinom biljkom/poljem koristi hash s 0-baziranim `positionIndex`: `[Naziv radnje](https://www.gredice.com/radnje/{slug}#raisedBedId={raisedBedId}&positionIndex={positionIndex})`. Ne koristi `positionLabel` u URL-u.',
                '- Koristi samo apsolutne `https://www.gredice.com/radnje/...` URL predloške iz `availableOperations`; ne izmišljaj slugove, ne piši sirovi URL bez markdown oznake i ne dodaj link ako za radnju ne postoji odgovarajući URL predložak.',
            ].join('\n'),
        },
        {
            role: 'user' as const,
            content: [
                {
                    type: 'text' as const,
                    text: [
                        typeof positionIndex === 'number'
                            ? `Analiziraj sve fotografije vrta i kontekst te napiši objedinjene praktične preporuke za označeno polje (positionLabel ${analyzedPositionLabel}) i ostatak gredice.`
                            : 'Analiziraj sve fotografije gredice i kontekst te napiši objedinjene praktične preporuke za cijelu gredicu.',
                        'Fotografije su različiti pogledi istog dnevničkog unosa; nemoj ih tretirati kao zasebne zahtjeve.',
                        'Odgovor MORA imati ove markdown sekcije:',
                        '## Sažetak stanja',
                        '## Globalne preporuke (2-4 stavke)',
                        '## Biljke koje traže najviše pažnje (2-4 biljke, po biljci navedi problem + konkretan idući korak)',
                        '## Plan za sljedeća 3 dana',
                        '',
                        'Kontekst (JSON):',
                        JSON.stringify(
                            {
                                currentDate: nowIso,
                                imageDate: referenceDateIso,
                                imageDateSource,
                                analysisReferenceDate: referenceDateIso,
                                weather,
                                raisedBed: {
                                    orientation,
                                    columns: RAISED_BED_COLUMNS,
                                    rows,
                                    totalFields,
                                },
                                analyzedField:
                                    typeof positionIndex === 'number'
                                        ? {
                                              positionIndex,
                                              positionLabel:
                                                  analyzedPositionLabel,
                                          }
                                        : null,
                                imageCount: imageUrls.length,
                                plantedFields,
                                availableOperations,
                                executedOperations,
                            },
                            null,
                            2,
                        ),
                    ].join('\n'),
                },
                ...imageUrls.map((imageUrl) => ({
                    type: 'image' as const,
                    image: new URL(imageUrl),
                })),
            ],
        },
    ];
}

export async function streamRaisedBedImageAnalysis(
    params: AnalysisParams,
    onFinish: (result: {
        markdown: string;
        model: string;
        analyzedAt: string;
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    }) => void | Promise<void>,
) {
    const messages = await buildAnalysisMessages(params);

    const result = streamText({
        model: AI_MODEL,
        messages,
        onFinish: async ({ text, usage }) => {
            await onFinish({
                markdown: text,
                model: AI_MODEL,
                analyzedAt: new Date().toISOString(),
                inputTokens: usage.inputTokens ?? 0,
                outputTokens: usage.outputTokens ?? 0,
                totalTokens: usage.totalTokens ?? 0,
            });
        },
    });

    return result;
}
