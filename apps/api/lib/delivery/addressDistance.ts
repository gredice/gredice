import {
    type EntityStandardized,
    getEntitiesFormatted,
} from '@gredice/storage';

const GOOGLE_GEOCODE_API = 'https://maps.googleapis.com/maps/api/geocode/json';
const GOOGLE_DISTANCE_MATRIX_API =
    'https://maps.googleapis.com/maps/api/distancematrix/json';

const DEFAULT_MAX_DELIVERY_DISTANCE_KM = 100;
const HQ_CACHE_TTL_MS = 5 * 60 * 1000;

interface Coordinates {
    latitude: number;
    longitude: number;
}

interface AddressDistanceResult {
    latitude: string;
    longitude: string;
    roadDistanceKm: string;
}

interface DistanceComputationInput {
    street1: string;
    street2?: string;
    city: string;
    postalCode: string;
    countryCode: string;
}

interface HqLocationConfig {
    latitude: number;
    longitude: number;
    maxDistanceKm: number;
}

let cachedHqLocation: {
    value: HqLocationConfig;
    expiresAt: number;
} | null = null;

export function isAddressDistanceVerificationEnabled(): boolean {
    const configuredValue =
        process.env.addressDistanceVerification ??
        process.env.ADDRESS_DISTANCE_VERIFICATION;

    if (typeof configuredValue !== 'string') {
        return false;
    }

    const normalizedValue = configuredValue.trim().toLowerCase();
    return normalizedValue === '1' || normalizedValue === 'true';
}

function getGoogleMapsApiKey(): string {
    const apiKey = process.env.GREDICE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        throw new Error('GREDICE_GOOGLE_MAPS_API_KEY is not configured');
    }

    return apiKey;
}

function getMaximumAllowedDistanceKmFallback(): number {
    const configuredValue = Number(
        process.env.GREDICE_DELIVERY_MAX_DISTANCE_KM,
    );

    if (!Number.isFinite(configuredValue) || configuredValue <= 0) {
        return DEFAULT_MAX_DELIVERY_DISTANCE_KM;
    }

    return configuredValue;
}

function readNumericValue(
    record: Record<string, unknown> | undefined,
    key: string,
): number | null {
    const value = record?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return null;
}

function toUnknownRecord(value: unknown): Record<string, unknown> | undefined {
    if (typeof value === 'object' && value !== null) {
        return Object.fromEntries(Object.entries(value));
    }

    return undefined;
}

function extractHqLocationConfig(entity: EntityStandardized): HqLocationConfig {
    const attributes = entity.attributes;
    const information = toUnknownRecord(entity.information);

    const latitude =
        readNumericValue(attributes, 'latitude') ??
        readNumericValue(attributes, 'lat') ??
        readNumericValue(information, 'latitude') ??
        readNumericValue(information, 'lat');
    const longitude =
        readNumericValue(attributes, 'longitude') ??
        readNumericValue(attributes, 'lng') ??
        readNumericValue(information, 'longitude') ??
        readNumericValue(information, 'lng');
    const maxDistanceKm =
        readNumericValue(attributes, 'maxDeliveryDistanceKm') ??
        readNumericValue(attributes, 'deliveryRadiusKm') ??
        readNumericValue(attributes, 'maxDistanceKm') ??
        getMaximumAllowedDistanceKmFallback();

    if (latitude === null || longitude === null) {
        throw new Error(
            'First /entities/hqLocations item is missing latitude/longitude attributes',
        );
    }

    return {
        latitude,
        longitude,
        maxDistanceKm,
    };
}

async function getHeadquarterConfig(): Promise<HqLocationConfig> {
    if (cachedHqLocation && cachedHqLocation.expiresAt > Date.now()) {
        return cachedHqLocation.value;
    }

    const hqLocations =
        await getEntitiesFormatted<EntityStandardized>('hqLocations');
    const firstHqLocation = hqLocations[0];
    if (!firstHqLocation) {
        throw new Error('No HQ location found in /entities/hqLocations');
    }

    const config = extractHqLocationConfig(firstHqLocation);
    cachedHqLocation = {
        value: config,
        expiresAt: Date.now() + HQ_CACHE_TTL_MS,
    };
    return config;
}

function buildAddressString(input: DistanceComputationInput): string {
    const addressParts = [
        input.street1,
        input.street2,
        input.postalCode,
        input.city,
        input.countryCode,
    ].filter((part) => typeof part === 'string' && part.trim().length > 0);

    return addressParts.join(', ');
}

async function geocodeAddress(
    address: string,
    apiKey: string,
): Promise<Coordinates> {
    const params = new URLSearchParams({
        key: apiKey,
        address,
    });
    const response = await fetch(`${GOOGLE_GEOCODE_API}?${params.toString()}`);

    if (!response.ok) {
        throw new Error(`Geocoding failed with status ${response.status}`);
    }

    const payload = (await response.json()) as {
        status?: string;
        error_message?: string;
        results?: Array<{
            geometry?: { location?: { lat?: number; lng?: number } };
        }>;
    };

    if (payload.status !== 'OK') {
        throw new Error(
            `Geocoding failed with status ${payload.status ?? 'UNKNOWN'}${
                payload.error_message ? `: ${payload.error_message}` : ''
            }`,
        );
    }

    const location = payload.results?.[0]?.geometry?.location;

    if (
        typeof location?.lat !== 'number' ||
        !Number.isFinite(location.lat) ||
        typeof location.lng !== 'number' ||
        !Number.isFinite(location.lng)
    ) {
        throw new Error('Geocoding did not return valid coordinates');
    }

    return { latitude: location.lat, longitude: location.lng };
}

async function getRoadDistanceMeters(
    origin: Coordinates,
    destination: Coordinates,
    apiKey: string,
): Promise<number> {
    const params = new URLSearchParams({
        key: apiKey,
        units: 'metric',
        origins: `${origin.latitude},${origin.longitude}`,
        destinations: `${destination.latitude},${destination.longitude}`,
    });

    const response = await fetch(
        `${GOOGLE_DISTANCE_MATRIX_API}?${params.toString()}`,
    );

    if (!response.ok) {
        throw new Error(
            `Distance matrix failed with status ${response.status}`,
        );
    }

    const payload = (await response.json()) as {
        status?: string;
        error_message?: string;
        rows?: Array<{
            elements?: Array<{
                status?: string;
                distance?: { value?: number };
            }>;
        }>;
    };

    if (payload.status !== 'OK') {
        throw new Error(
            `Distance matrix failed with status ${payload.status ?? 'UNKNOWN'}${
                payload.error_message ? `: ${payload.error_message}` : ''
            }`,
        );
    }

    const element = payload.rows?.[0]?.elements?.[0];

    if (!element || element.status !== 'OK') {
        throw new Error(
            `Distance matrix route not found (${element?.status ?? 'UNKNOWN'})`,
        );
    }

    const distanceInMeters = element.distance?.value;

    if (
        typeof distanceInMeters !== 'number' ||
        !Number.isFinite(distanceInMeters)
    ) {
        throw new Error(
            'Distance matrix did not return a valid distance value',
        );
    }

    return distanceInMeters;
}

export async function computeAddressDistanceData(
    input: DistanceComputationInput,
): Promise<AddressDistanceResult> {
    const apiKey = getGoogleMapsApiKey();
    const hqLocation = await getHeadquarterConfig();

    const addressString = buildAddressString(input);
    const destinationCoordinates = await geocodeAddress(addressString, apiKey);

    const distanceInMeters = await getRoadDistanceMeters(
        {
            latitude: hqLocation.latitude,
            longitude: hqLocation.longitude,
        },
        destinationCoordinates,
        apiKey,
    );
    const distanceInKm = distanceInMeters / 1000;

    return {
        latitude: destinationCoordinates.latitude.toFixed(8),
        longitude: destinationCoordinates.longitude.toFixed(8),
        roadDistanceKm: distanceInKm.toFixed(3),
    };
}

export async function validateDeliveryDistanceLimit(
    distanceKmRaw: string,
): Promise<void> {
    const distanceKm = Number(distanceKmRaw);
    const hqLocation = await getHeadquarterConfig();
    const maxDistanceKm = hqLocation.maxDistanceKm;

    if (!Number.isFinite(distanceKm)) {
        throw new Error('Calculated distance is invalid');
    }

    if (distanceKm > maxDistanceKm) {
        throw new Error(
            `Address is outside the delivery zone (${distanceKm.toFixed(1)}km > ${maxDistanceKm}km)`,
        );
    }
}
