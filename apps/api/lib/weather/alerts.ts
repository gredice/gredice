import { parseStringPromise } from 'xml2js';

const dhmzCapUrls = [
    'https://meteo.hr/upozorenja/cap_hr_today.xml',
    'https://meteo.hr/upozorenja/cap_hr_tomorrow.xml',
    'https://meteo.hr/upozorenja/cap_hr_day_after_tomorrow.xml',
] as const;

const defaultAlertRegionCode = 'HR002';

type WeatherAlertFarm = {
    latitude: number;
    longitude: number;
};

type WeatherAlertRegion = {
    code: string;
    nameHr: string;
    latitude: number;
    longitude: number;
};

const landAlertRegions: WeatherAlertRegion[] = [
    {
        code: 'HR001',
        nameHr: 'Kninska regija',
        latitude: 44.04,
        longitude: 16.2,
    },
    {
        code: 'HR002',
        nameHr: 'Zagrebacka regija',
        latitude: 45.81,
        longitude: 16.0,
    },
    {
        code: 'HR003',
        nameHr: 'Karlovacka regija',
        latitude: 45.49,
        longitude: 15.55,
    },
    {
        code: 'HR004',
        nameHr: 'Gospicka regija',
        latitude: 44.55,
        longitude: 15.37,
    },
    {
        code: 'HR005',
        nameHr: 'Osjecka regija',
        latitude: 45.55,
        longitude: 18.7,
    },
    {
        code: 'HR006',
        nameHr: 'Rijecka regija',
        latitude: 45.33,
        longitude: 14.45,
    },
    {
        code: 'HR007',
        nameHr: 'Dubrovacka regija',
        latitude: 42.65,
        longitude: 18.09,
    },
    {
        code: 'HR008',
        nameHr: 'Splitska regija',
        latitude: 43.51,
        longitude: 16.44,
    },
];

const awarenessTypeLabelsHr: Record<string, string> = {
    '1': 'vjetar',
    '2': 'snijeg i poledica',
    '3': 'grmljavinsku oluju',
    '4': 'maglu',
    '5': 'visoku temperaturu',
    '6': 'nisku temperaturu',
    '7': 'obalni dogadaj',
    '8': 'opasnost od pozara',
    '9': 'lavine',
    '10': 'kisu',
    '11': 'poplave',
    '12': 'kisu i poplave',
    '13': 'morsku grmljavinsku oluju',
};

export type WeatherAlertLanguage = 'hr' | 'en';

export type WeatherAlertAwareness = {
    id: string;
    color: string | null;
    label: string | null;
};

export type WeatherAlertType = {
    id: string;
    label: string;
};

export type WeatherAlertArea = {
    name: string;
    regionCode: string;
};

export type DhmzWeatherAlert = {
    id: string;
    source: 'dhmz-cap';
    sourceUrl: string;
    language: string;
    event: string;
    description: string;
    instruction: string | null;
    urgency: string | null;
    severity: string | null;
    certainty: string | null;
    onset: string;
    expires: string;
    sent: string | null;
    senderName: string | null;
    awarenessLevel: WeatherAlertAwareness | null;
    awarenessType: WeatherAlertType | null;
    area: WeatherAlertArea;
    deduplicationKey: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function arrayFromUnknown(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    if (value == null) return [];
    return [value];
}

function firstString(value: unknown): string | null {
    if (typeof value === 'string') return value;
    const first = arrayFromUnknown(value)[0];
    return typeof first === 'string' ? first : null;
}

function field(record: Record<string, unknown>, key: string): unknown {
    return record[key];
}

function stringField(record: Record<string, unknown>, key: string) {
    return firstString(field(record, key));
}

function normalizeText(value: string | null) {
    const normalized = value?.replace(/\s+/g, ' ').trim();
    return normalized && normalized.length > 0 ? normalized : null;
}

function parseParameter(
    info: Record<string, unknown>,
    valueName: string,
): string | null {
    for (const item of arrayFromUnknown(field(info, 'parameter'))) {
        if (!isRecord(item)) continue;
        if (stringField(item, 'valueName') === valueName) {
            return normalizeText(stringField(item, 'value'));
        }
    }
    return null;
}

function parseAwarenessLevel(
    value: string | null,
): WeatherAlertAwareness | null {
    if (!value) return null;
    const [id, color, label] = value.split(';').map((part) => part.trim());
    if (!id) return null;
    return {
        id,
        color: color || null,
        label: label || null,
    };
}

function parseAwarenessType(value: string | null): WeatherAlertType | null {
    if (!value) return null;
    const [id, label] = value.split(';').map((part) => part.trim());
    if (!id) return null;
    return {
        id,
        label: label || awarenessTypeLabelsHr[id] || id,
    };
}

function parseArea(area: unknown): WeatherAlertArea | null {
    if (!isRecord(area)) return null;
    const areaName = normalizeText(stringField(area, 'areaDesc'));
    if (!areaName) return null;

    for (const geocode of arrayFromUnknown(field(area, 'geocode'))) {
        if (!isRecord(geocode)) continue;
        if (stringField(geocode, 'valueName') !== 'EMMA_ID') continue;
        const regionCode = normalizeText(stringField(geocode, 'value'));
        if (regionCode) {
            return {
                name: areaName,
                regionCode,
            };
        }
    }

    return null;
}

function fallbackCroatianEvent(alertType: WeatherAlertType | null) {
    if (!alertType) return 'Vremensko upozorenje';
    const label = awarenessTypeLabelsHr[alertType.id] ?? alertType.label;
    return `Upozorenje za ${label}`;
}

function severityRank(
    alert: Pick<DhmzWeatherAlert, 'awarenessLevel' | 'severity'>,
) {
    const awarenessLevel = Number(alert.awarenessLevel?.id);
    if (Number.isFinite(awarenessLevel)) return awarenessLevel;

    switch (alert.severity?.toLowerCase()) {
        case 'extreme':
            return 4;
        case 'severe':
            return 3;
        case 'moderate':
            return 2;
        case 'minor':
            return 1;
        default:
            return 0;
    }
}

function alertSortKey(alert: DhmzWeatherAlert) {
    return [
        String(4 - severityRank(alert)).padStart(2, '0'),
        alert.onset,
        alert.expires,
        alert.id,
    ].join(':');
}

export async function parseDhmzCapAlertXml(
    xml: string,
    sourceUrl = 'dhmz-cap',
): Promise<DhmzWeatherAlert[]> {
    return parseStringPromise(xml).then((data: unknown) => {
        if (!isRecord(data) || !isRecord(data.alert)) return [];
        const alert = data.alert;
        const identifier =
            normalizeText(stringField(alert, 'identifier')) ?? sourceUrl;
        const sent = normalizeText(stringField(alert, 'sent'));
        const parsedAlerts: DhmzWeatherAlert[] = [];

        for (const infoItem of arrayFromUnknown(field(alert, 'info'))) {
            if (!isRecord(infoItem)) continue;

            const language = normalizeText(stringField(infoItem, 'language'));
            const urgency = normalizeText(stringField(infoItem, 'urgency'));
            const severity = normalizeText(stringField(infoItem, 'severity'));
            const certainty = normalizeText(stringField(infoItem, 'certainty'));
            const onset = normalizeText(stringField(infoItem, 'onset'));
            const expires = normalizeText(stringField(infoItem, 'expires'));
            if (!onset || !expires) continue;

            const awarenessLevel = parseAwarenessLevel(
                parseParameter(infoItem, 'awareness_level'),
            );
            const awarenessType = parseAwarenessType(
                parseParameter(infoItem, 'awareness_type'),
            );
            const event =
                normalizeText(stringField(infoItem, 'event')) ??
                fallbackCroatianEvent(awarenessType);
            const description =
                normalizeText(stringField(infoItem, 'description')) ?? event;
            const instruction = normalizeText(
                stringField(infoItem, 'instruction'),
            );
            const senderName = normalizeText(
                stringField(infoItem, 'senderName'),
            );

            for (const areaItem of arrayFromUnknown(field(infoItem, 'area'))) {
                const area = parseArea(areaItem);
                if (!area) continue;
                const typeKey = awarenessType?.id ?? event;
                const levelKey = awarenessLevel?.id ?? severity ?? 'unknown';
                const deduplicationKey = [
                    area.regionCode,
                    typeKey,
                    levelKey,
                    onset,
                    expires,
                ].join(':');
                parsedAlerts.push({
                    id: [
                        identifier,
                        language ?? 'unknown',
                        area.regionCode,
                        typeKey,
                        onset,
                        expires,
                    ].join(':'),
                    source: 'dhmz-cap',
                    sourceUrl,
                    language: language ?? 'unknown',
                    event,
                    description,
                    instruction,
                    urgency,
                    severity,
                    certainty,
                    onset,
                    expires,
                    sent,
                    senderName,
                    awarenessLevel,
                    awarenessType,
                    area,
                    deduplicationKey,
                });
            }
        }

        return parsedAlerts;
    });
}

export async function getDhmzWeatherAlerts(
    fetchFn: typeof fetch = fetch,
): Promise<DhmzWeatherAlert[]> {
    const parsedGroups = await Promise.all(
        dhmzCapUrls.map(async (url) => {
            try {
                const response = await fetchFn(url);
                if (!response.ok) {
                    console.warn('DHMZ weather alerts feed unavailable', {
                        status: response.status,
                        url,
                    });
                    return [];
                }
                return await parseDhmzCapAlertXml(await response.text(), url);
            } catch (error) {
                console.warn('Failed to fetch DHMZ weather alerts feed', {
                    error,
                    url,
                });
                return [];
            }
        }),
    );

    const alertsByKey = new Map<string, DhmzWeatherAlert>();
    for (const alert of parsedGroups.flat()) {
        alertsByKey.set(alert.id, alert);
    }

    return Array.from(alertsByKey.values()).sort((left, right) =>
        alertSortKey(left).localeCompare(alertSortKey(right)),
    );
}

function configuredRegionCode() {
    const configured = process.env.GREDICE_WEATHER_ALERT_REGION_CODE?.trim();
    if (!configured) return null;
    return configured.toUpperCase();
}

function distanceSquaredToRegion(
    farm: WeatherAlertFarm,
    region: WeatherAlertRegion,
) {
    const latitudeDistance = farm.latitude - region.latitude;
    const longitudeDistance =
        (farm.longitude - region.longitude) *
        Math.cos((farm.latitude * Math.PI) / 180);
    return (
        latitudeDistance * latitudeDistance +
        longitudeDistance * longitudeDistance
    );
}

export function resolveWeatherAlertRegionCode(
    farm?: WeatherAlertFarm | null,
): string {
    const configured = configuredRegionCode();
    if (configured) return configured;
    if (!farm) return defaultAlertRegionCode;

    const nearestRegion = landAlertRegions.reduce<WeatherAlertRegion | null>(
        (nearest, region) => {
            if (!nearest) return region;
            return distanceSquaredToRegion(farm, region) <
                distanceSquaredToRegion(farm, nearest)
                ? region
                : nearest;
        },
        null,
    );

    return nearestRegion?.code ?? defaultAlertRegionCode;
}

export function filterWeatherAlertsForFarm(
    alerts: DhmzWeatherAlert[],
    farm?: WeatherAlertFarm | null,
    options: {
        horizonHours?: number;
        language?: WeatherAlertLanguage;
        now?: Date;
    } = {},
): DhmzWeatherAlert[] {
    const now = options.now ?? new Date();
    const horizonMs = (options.horizonHours ?? 72) * 60 * 60 * 1000;
    const regionCode = resolveWeatherAlertRegionCode(farm);
    const language = options.language ?? 'hr';
    const relevantAlerts = alerts.filter((alert) => {
        const onsetMs = new Date(alert.onset).getTime();
        const expiresMs = new Date(alert.expires).getTime();
        return (
            alert.area.regionCode === regionCode &&
            Number.isFinite(onsetMs) &&
            Number.isFinite(expiresMs) &&
            expiresMs > now.getTime() &&
            onsetMs <= now.getTime() + horizonMs
        );
    });
    const localizedAlerts = relevantAlerts.filter(
        (alert) => alert.language === language,
    );
    const selectedAlerts =
        localizedAlerts.length > 0 ? localizedAlerts : relevantAlerts;

    return selectedAlerts.sort((left, right) =>
        alertSortKey(left).localeCompare(alertSortKey(right)),
    );
}

export function mostImportantWeatherAlert(alerts: DhmzWeatherAlert[]) {
    return alerts[0] ?? null;
}
