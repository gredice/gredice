import {
    getEntitiesFormatted,
    getOperations,
    grediceCacheKeys,
    grediceCached,
} from '@gredice/storage';
import { streamText } from 'ai';
import { validateHostedImageUrl } from '../http/safeUrls';
import { getBjelovarForecast } from '../weather/forecast';
import { findClosestForecastEntry } from '../weather/weatherNowContract';

const FORECAST_CACHE_TTL_SECONDS = 60 * 60;
const RAISED_BED_FIELDS_PER_BLOCK = 9;
const RAISED_BED_COLUMNS = 3;
const GREENHOUSE_SEEDLING_STATUSES = new Set([
    'pendingVerification',
    'sowed',
    'sprouted',
]);

const AI_MODEL = process.env.AI_GATEWAY_MODEL ?? 'openai/gpt-5.5';

export const AI_REQUEST_QUOTA_WINDOW_DAYS = 7;
export const AI_REQUEST_QUOTA_WINDOW_MS =
    AI_REQUEST_QUOTA_WINDOW_DAYS * 24 * 60 * 60 * 1000;
export const AI_REQUEST_WEEKLY_LIMIT = 5;
export const RAISED_BED_IMAGE_ANALYSIS_REQUEST_KIND =
    'raisedBedImageAnalysis' as const;

export type AiRequestKind = typeof RAISED_BED_IMAGE_ANALYSIS_REQUEST_KIND;

export const AI_REQUEST_QUOTAS = {
    [RAISED_BED_IMAGE_ANALYSIS_REQUEST_KIND]: {
        limit: AI_REQUEST_WEEKLY_LIMIT,
        windowDays: AI_REQUEST_QUOTA_WINDOW_DAYS,
        windowMs: AI_REQUEST_QUOTA_WINDOW_MS,
    },
} as const satisfies Record<
    AiRequestKind,
    { limit: number; windowDays: number; windowMs: number }
>;

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

function daysSince(date: Date | string | null | undefined) {
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
        Math.floor((Date.now() - dateValue.getTime()) / oneDayMs),
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

type WeatherContext = {
    location: string;
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

async function buildWeatherContext(): Promise<WeatherContext | null> {
    try {
        const forecast = await grediceCached(
            grediceCacheKeys.forecastBjelovar,
            getBjelovarForecast,
            FORECAST_CACHE_TTL_SECONDS,
        );
        if (!forecast || forecast.length === 0) {
            return null;
        }

        const closestEntry = findClosestForecastEntry(forecast, Date.now());

        return {
            location: 'Bjelovar, HR',
            now: closestEntry
                ? {
                      temperatureC: closestEntry.temperature,
                      rainMm: closestEntry.rain,
                      symbol: closestEntry.symbol,
                      windDirection: closestEntry.windDirection,
                      windStrength: closestEntry.windStrength,
                  }
                : null,
            forecast: forecast.slice(0, 5).map((day) => ({
                date: day.date,
                minTemperatureC: day.minTemp,
                maxTemperatureC: day.maxTemp,
                rainMm: day.rain,
                symbol: day.symbol,
                windDirection: day.windDirection,
                windStrength: day.windStrength,
            })),
        };
    } catch (error) {
        console.warn(
            'Failed to load weather context for AI analysis:',
            error,
        );
        return null;
    }
}

type AnalysisParams = {
    accountId: string;
    gardenId: number;
    raisedBed: RaisedBedAnalysisTarget;
    imageUrls: string[];
    positionIndex?: number;
};

async function buildAnalysisMessages({
    accountId,
    gardenId,
    raisedBed,
    imageUrls,
    positionIndex,
}: AnalysisParams) {
    const [plantSorts, operations, operationsData, weather] = await Promise.all([
        getEntitiesFormatted<{
            id: string;
            information?: { name?: string };
        }>('plantSort'),
        getOperations(accountId, gardenId, raisedBed.id),
        getEntitiesFormatted<{
            id: string;
            information?: { label?: string; name?: string };
        }>('operation'),
        buildWeatherContext(),
    ]);

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
    const availableOperations = operationsData.map((entity) => ({
        id: entity.id,
        name:
            entity.information?.label ?? entity.information?.name ?? entity.id,
    }));

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
                daysFromSowing: daysSince(field.plantSowDate),
                daysFromGrowth: daysSince(field.plantGrowthDate),
                daysFromReady: daysSince(field.plantReadyDate),
                daysFromHarvest: daysSince(field.plantHarvestedDate),
                daysFromDead: daysSince(field.plantDeadDate),
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

    const totalFields = raisedBed.fields.length || RAISED_BED_FIELDS_PER_BLOCK * 2;
    const rows = Math.max(1, Math.ceil(totalFields / RAISED_BED_COLUMNS));
    const orientation = raisedBed.orientation ?? 'vertical';
    const nowIso = new Date().toISOString();
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
                '- Koristi `weather` kontekst (trenutno stanje i prognozu) i `currentDate` pri preporukama za zalijevanje, zaštitu od mraza, sjetvu i berbu.',
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
