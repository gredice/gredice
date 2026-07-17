import 'server-only';

import {
    buildDeliveryQuote,
    grediceHqPosition,
    isPositionInsideBoundary,
    zagrebBoundary,
} from '@gredice/js/delivery';

type GoogleGeocodingResult = {
    formattedAddress: string;
    position: { lat: number; lng: number };
};

export class DeliveryAvailabilityLookupError extends Error {
    override name = 'DeliveryAvailabilityLookupError';
    readonly code: 'configuration' | 'not-found' | 'service-unavailable';

    constructor(code: 'configuration' | 'not-found' | 'service-unavailable') {
        super(code);
        this.code = code;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function numberField(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : undefined;
}

function googleMapsServerApiKey() {
    const apiKey = process.env.GREDICE_GOOGLE_MAPS_SERVER_API_KEY?.trim();
    if (!apiKey) throw new DeliveryAvailabilityLookupError('configuration');
    return apiKey;
}

function googleGeocodingUrl(address: string, apiKey: string) {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', address);
    url.searchParams.set('components', 'country:HR');
    url.searchParams.set('language', 'hr');
    url.searchParams.set('region', 'hr');
    url.searchParams.set('key', apiKey);
    return url;
}

function countryCode(addressComponents: unknown) {
    if (!Array.isArray(addressComponents)) return null;

    for (const component of addressComponents) {
        if (!isRecord(component) || !Array.isArray(component.types)) continue;
        if (
            component.types.includes('country') &&
            typeof component.short_name === 'string'
        ) {
            return component.short_name;
        }
    }
    return null;
}

async function geocodeCroatianAddress(
    address: string,
): Promise<GoogleGeocodingResult> {
    const response = await fetch(
        googleGeocodingUrl(address, googleMapsServerApiKey()),
        { cache: 'no-store', signal: AbortSignal.timeout(8_000) },
    );
    const body: unknown = await response.json().catch(() => null);
    const status = isRecord(body) ? body.status : null;
    if (response.ok && status === 'ZERO_RESULTS') {
        throw new DeliveryAvailabilityLookupError('not-found');
    }
    if (!response.ok || !isRecord(body) || status !== 'OK') {
        throw new DeliveryAvailabilityLookupError('service-unavailable');
    }

    const result = Array.isArray(body.results) ? body.results[0] : null;
    const geometry = isRecord(result) ? result.geometry : null;
    const location = isRecord(geometry) ? geometry.location : null;
    const lat = isRecord(location) ? numberField(location.lat) : undefined;
    const lng = isRecord(location) ? numberField(location.lng) : undefined;
    const formattedAddress = isRecord(result)
        ? result.formatted_address
        : undefined;
    if (
        lat === undefined ||
        lng === undefined ||
        typeof formattedAddress !== 'string' ||
        countryCode(isRecord(result) ? result.address_components : null) !==
            'HR'
    ) {
        throw new DeliveryAvailabilityLookupError('not-found');
    }

    return { formattedAddress, position: { lat, lng } };
}

async function drivingDistanceMeters(destination: {
    lat: number;
    lng: number;
}) {
    const response = await fetch(
        'https://routes.googleapis.com/directions/v2:computeRoutes',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': googleMapsServerApiKey(),
                'X-Goog-FieldMask': 'routes.distanceMeters',
            },
            body: JSON.stringify({
                origin: {
                    location: {
                        latLng: {
                            latitude: grediceHqPosition.lat,
                            longitude: grediceHqPosition.lng,
                        },
                    },
                },
                destination: {
                    location: {
                        latLng: {
                            latitude: destination.lat,
                            longitude: destination.lng,
                        },
                    },
                },
                travelMode: 'DRIVE',
                routingPreference: 'TRAFFIC_UNAWARE',
                languageCode: 'hr-HR',
                regionCode: 'HR',
                units: 'METRIC',
            }),
            cache: 'no-store',
            signal: AbortSignal.timeout(8_000),
        },
    );
    const body: unknown = await response.json().catch(() => null);
    const route =
        isRecord(body) && Array.isArray(body.routes) ? body.routes[0] : null;
    const distanceMeters = isRecord(route)
        ? numberField(route.distanceMeters)
        : undefined;
    if (!response.ok || distanceMeters === undefined) {
        throw new DeliveryAvailabilityLookupError('service-unavailable');
    }
    return distanceMeters;
}

export async function lookupDeliveryAvailability(address: string) {
    const destination = await geocodeCroatianAddress(address);
    const distanceMeters = await drivingDistanceMeters(destination.position);

    return {
        ...buildDeliveryQuote({
            distanceMeters,
            isInZagreb: isPositionInsideBoundary(
                destination.position,
                zagrebBoundary,
            ),
        }),
        formattedAddress: destination.formattedAddress,
    };
}
