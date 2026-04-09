import { createHmac } from 'node:crypto';
import {
    type EntityStandardized,
    getEntitiesFormatted,
} from '@gredice/storage';

const GOOGLE_GEOCODE_API = 'https://maps.googleapis.com/maps/api/geocode/json';
const GOOGLE_DISTANCE_MATRIX_API =
    'https://maps.googleapis.com/maps/api/distancematrix/json';

const DEFAULT_MAX_DELIVERY_DISTANCE_KM = 100;
const HQ_CACHE_TTL_MS = 5 * 60 * 1000;
const GOOGLE_REQUEST_TIMEOUT_MS = 5_000;
const GOOGLE_REQUEST_MAX_ATTEMPTS = 2;
const GOOGLE_REQUEST_RETRY_BASE_DELAY_MS = 250;

const GOOGLE_RETRYABLE_RESPONSE_STATUSES = new Set([
    408, 429, 500, 502, 503, 504,
]);

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

interface FetchGoogleMapsResponseOptions {
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    maxAttempts?: number;
    retryBaseDelayMs?: number;
}

interface HeadquarterConfigOptions {
    getEntitiesFormattedImpl?: (
        entityTypeName: string,
    ) => Promise<EntityStandardized[]>;
    now?: () => number;
}

let cachedHqLocation: {
    value: HqLocationConfig;
    expiresAt: number;
} | null = null;

export class DeliveryAddressEligibilityError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DeliveryAddressEligibilityError';
    }
}

export class GoogleMapsUpstreamError extends Error {
    readonly statusCode: 503 | 504;

    constructor(message: string, statusCode: 503 | 504) {
        super(message);
        this.name = 'GoogleMapsUpstreamError';
        this.statusCode = statusCode;
    }
}

export function isDeliveryAddressEligibilityError(
    error: unknown,
): error is DeliveryAddressEligibilityError {
    return error instanceof DeliveryAddressEligibilityError;
}

export function isGoogleMapsUpstreamError(
    error: unknown,
): error is GoogleMapsUpstreamError {
    return error instanceof GoogleMapsUpstreamError;
}

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

function getGoogleMapsUrlSigningSecret(): string | null {
    const signingSecret = process.env.GREDICE_GOOGLE_MAPS_URL_SIGNING_SECRET;

    if (typeof signingSecret !== 'string') {
        return null;
    }

    const normalizedSecret = signingSecret.trim();
    return normalizedSecret.length > 0 ? normalizedSecret : null;
}

function decodeGoogleMapsSigningSecret(secret: string): Buffer {
    const normalizedSecret = secret.replace(/-/g, '+').replace(/_/g, '/');
    const paddingLength = (4 - (normalizedSecret.length % 4)) % 4;

    return Buffer.from(
        `${normalizedSecret}${'='.repeat(paddingLength)}`,
        'base64',
    );
}

function toUrlSafeBase64(value: string): string {
    return value.replace(/\+/g, '-').replace(/\//g, '_');
}

export function buildGoogleMapsRequestUrl(
    baseUrl: string,
    params: URLSearchParams,
    urlSigningSecret?: string | null,
): string {
    const requestUrl = new URL(baseUrl);
    requestUrl.search = params.toString();

    if (!urlSigningSecret) {
        return requestUrl.toString();
    }

    const urlToSign = `${requestUrl.pathname}${requestUrl.search}`;
    const signature = createHmac(
        'sha1',
        decodeGoogleMapsSigningSecret(urlSigningSecret),
    )
        .update(urlToSign)
        .digest('base64');

    requestUrl.searchParams.set('signature', toUrlSafeBase64(signature));
    return requestUrl.toString();
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

export function extractHqLocationConfig(
    entity: EntityStandardized,
): HqLocationConfig {
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

export function resetHeadquarterConfigCacheForTests(): void {
    cachedHqLocation = null;
}

export async function getHeadquarterConfig(
    options?: HeadquarterConfigOptions,
): Promise<HqLocationConfig> {
    const now = options?.now ?? Date.now;

    if (cachedHqLocation && cachedHqLocation.expiresAt > now()) {
        return cachedHqLocation.value;
    }

    const getEntitiesFormattedImpl =
        options?.getEntitiesFormattedImpl ?? getEntitiesFormatted;
    const hqLocations = await getEntitiesFormattedImpl('hqLocations');
    const firstHqLocation = hqLocations[0];
    if (!firstHqLocation) {
        throw new Error('No HQ location found in /entities/hqLocations');
    }

    const config = extractHqLocationConfig(firstHqLocation);
    cachedHqLocation = {
        value: config,
        expiresAt: now() + HQ_CACHE_TTL_MS,
    };
    return config;
}

export function buildAddressString(input: DistanceComputationInput): string {
    const addressParts = [
        input.street1,
        input.street2,
        input.postalCode,
        input.city,
        input.countryCode,
    ].filter((part) => typeof part === 'string' && part.trim().length > 0);

    return addressParts.join(', ');
}

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
}

function isRetryableGoogleResponseStatus(status: number): boolean {
    return GOOGLE_RETRYABLE_RESPONSE_STATUSES.has(status);
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function buildGoogleStatusMessage(
    requestName: string,
    status: string | undefined,
    errorMessage?: string,
): string {
    return `${requestName} failed with status ${status ?? 'UNKNOWN'}${
        errorMessage ? `: ${errorMessage}` : ''
    }`;
}

export function createGoogleStatusError(
    requestName: string,
    status: string | undefined,
    errorMessage?: string,
): DeliveryAddressEligibilityError | GoogleMapsUpstreamError {
    if (status === 'ZERO_RESULTS' || status === 'NOT_FOUND') {
        return new DeliveryAddressEligibilityError(
            status === 'ZERO_RESULTS'
                ? 'Address could not be located'
                : 'Address could not be validated for delivery',
        );
    }

    return new GoogleMapsUpstreamError(
        buildGoogleStatusMessage(requestName, status, errorMessage),
        503,
    );
}

async function parseGoogleJsonResponse<T>(
    response: Response,
    requestName: string,
): Promise<T> {
    try {
        const payload: T = await response.json();
        return payload;
    } catch {
        throw new GoogleMapsUpstreamError(
            `${requestName} returned an invalid JSON payload`,
            503,
        );
    }
}

export async function fetchGoogleMapsResponse(
    url: string,
    requestName: string,
    options?: FetchGoogleMapsResponseOptions,
): Promise<Response> {
    const fetchImpl = options?.fetchImpl ?? fetch;
    const timeoutMs = options?.timeoutMs ?? GOOGLE_REQUEST_TIMEOUT_MS;
    const maxAttempts = Math.max(
        1,
        options?.maxAttempts ?? GOOGLE_REQUEST_MAX_ATTEMPTS,
    );
    const retryBaseDelayMs =
        options?.retryBaseDelayMs ?? GOOGLE_REQUEST_RETRY_BASE_DELAY_MS;
    let lastError: GoogleMapsUpstreamError | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        let timedOut = false;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, timeoutMs);

        try {
            const response = await fetchImpl(url, {
                signal: controller.signal,
            });

            if (response.ok) {
                return response;
            }

            const upstreamError = new GoogleMapsUpstreamError(
                `${requestName} failed with status ${response.status}`,
                503,
            );

            if (
                !isRetryableGoogleResponseStatus(response.status) ||
                attempt === maxAttempts
            ) {
                throw upstreamError;
            }

            lastError = upstreamError;
        } catch (error) {
            if (error instanceof GoogleMapsUpstreamError) {
                throw error;
            }

            if (timedOut || isAbortError(error)) {
                const timeoutError = new GoogleMapsUpstreamError(
                    `${requestName} timed out after ${timeoutMs}ms`,
                    504,
                );

                if (attempt === maxAttempts) {
                    throw timeoutError;
                }

                lastError = timeoutError;
            } else if (error instanceof TypeError) {
                const upstreamError = new GoogleMapsUpstreamError(
                    `${requestName} failed due to an upstream network error`,
                    503,
                );

                if (attempt === maxAttempts) {
                    throw upstreamError;
                }

                lastError = upstreamError;
            } else {
                throw error;
            }
        } finally {
            clearTimeout(timeoutId);
        }

        await delay(retryBaseDelayMs * 2 ** (attempt - 1));
    }

    throw (
        lastError ?? new GoogleMapsUpstreamError(`${requestName} failed`, 503)
    );
}

async function geocodeAddress(
    address: string,
    apiKey: string,
    urlSigningSecret: string | null,
): Promise<Coordinates> {
    const params = new URLSearchParams({
        key: apiKey,
        address,
    });
    const response = await fetchGoogleMapsResponse(
        buildGoogleMapsRequestUrl(GOOGLE_GEOCODE_API, params, urlSigningSecret),
        'Google geocoding request',
    );

    const payload = await parseGoogleJsonResponse<{
        status?: string;
        error_message?: string;
        results?: Array<{
            geometry?: { location?: { lat?: number; lng?: number } };
        }>;
    }>(response, 'Google geocoding request');

    if (payload.status !== 'OK') {
        throw createGoogleStatusError(
            'Google geocoding request',
            payload.status,
            payload.error_message,
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
    urlSigningSecret: string | null,
): Promise<number> {
    const params = new URLSearchParams({
        key: apiKey,
        units: 'metric',
        origins: `${origin.latitude},${origin.longitude}`,
        destinations: `${destination.latitude},${destination.longitude}`,
    });

    const response = await fetchGoogleMapsResponse(
        buildGoogleMapsRequestUrl(
            GOOGLE_DISTANCE_MATRIX_API,
            params,
            urlSigningSecret,
        ),
        'Google distance matrix request',
    );

    const payload = await parseGoogleJsonResponse<{
        status?: string;
        error_message?: string;
        rows?: Array<{
            elements?: Array<{
                status?: string;
                distance?: { value?: number };
            }>;
        }>;
    }>(response, 'Google distance matrix request');

    if (payload.status !== 'OK') {
        throw createGoogleStatusError(
            'Google distance matrix request',
            payload.status,
            payload.error_message,
        );
    }

    const element = payload.rows?.[0]?.elements?.[0];

    if (!element || element.status !== 'OK') {
        throw createGoogleStatusError(
            'Google distance matrix request',
            element?.status,
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
    const urlSigningSecret = getGoogleMapsUrlSigningSecret();
    const hqLocation = await getHeadquarterConfig();

    const addressString = buildAddressString(input);
    const destinationCoordinates = await geocodeAddress(
        addressString,
        apiKey,
        urlSigningSecret,
    );

    const distanceInMeters = await getRoadDistanceMeters(
        {
            latitude: hqLocation.latitude,
            longitude: hqLocation.longitude,
        },
        destinationCoordinates,
        apiKey,
        urlSigningSecret,
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
        throw new DeliveryAddressEligibilityError(
            `Address is outside the delivery zone (${distanceKm.toFixed(1)}km > ${maxDistanceKm}km)`,
        );
    }
}
