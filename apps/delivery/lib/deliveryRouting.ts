import 'server-only';

export type DeliveryCoordinates = {
    latitude: number;
    longitude: number;
};

export type DeliveryRouteCandidate = {
    deliveryRequestId: string;
    formattedAddress: string;
};

export type GeocodedDeliveryRouteCandidate = DeliveryRouteCandidate &
    DeliveryCoordinates;

export type PlannedDeliveryRouteStop = GeocodedDeliveryRouteCandidate & {
    sequence: number;
    estimatedArrivalAt: Date;
    estimatedTravelSeconds: number;
    estimatedDistanceMeters: number;
};

export type DeliveryRoutePlan = {
    encodedPolyline?: string;
    totalDistanceMeters: number;
    totalDurationSeconds: number;
    stops: PlannedDeliveryRouteStop[];
};

type GoogleRouteLeg = {
    distanceMeters?: unknown;
    duration?: unknown;
};

type GoogleRoute = {
    distanceMeters?: unknown;
    duration?: unknown;
    legs?: unknown;
    optimizedIntermediateWaypointIndex?: unknown;
    polyline?: { encodedPolyline?: unknown };
};

const deliveryStopServiceSeconds = 5 * 60;
const maximumRouteStops = 26;
const defaultHqAddress = 'Ulica Julija Knifera 3, 10000 Zagreb, Hrvatska';

function googleMapsApiKey() {
    const apiKey = process.env.GREDICE_GOOGLE_MAPS_API_KEY?.trim();
    if (!apiKey) {
        throw new Error(
            'Google Maps API ključ nije konfiguriran za aplikaciju dostave.',
        );
    }
    return apiKey;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function numberField(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : undefined;
}

function durationSeconds(value: unknown): number | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }
    const match = /^(\d+(?:\.\d+)?)s$/.exec(value);
    return match?.[1] ? Math.round(Number(match[1])) : undefined;
}

function routeLegs(value: unknown): GoogleRouteLeg[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter(isRecord);
}

function optimizedIndexes(value: unknown): number[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter(
        (index): index is number =>
            typeof index === 'number' && Number.isInteger(index),
    );
}

export function formatDeliveryDestinationAddress(address: {
    street1: string;
    street2?: string | null;
    postalCode: string;
    city: string;
    countryCode: string;
}) {
    return [
        address.street1,
        address.street2,
        `${address.postalCode} ${address.city}`,
        address.countryCode,
    ]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
        .join(', ');
}

export function haversineDistanceMeters(
    first: DeliveryCoordinates,
    second: DeliveryCoordinates,
) {
    const earthRadiusMeters = 6_371_000;
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const latitudeDelta = toRadians(second.latitude - first.latitude);
    const longitudeDelta = toRadians(second.longitude - first.longitude);
    const firstLatitude = toRadians(first.latitude);
    const secondLatitude = toRadians(second.latitude);
    const a =
        Math.sin(latitudeDelta / 2) ** 2 +
        Math.cos(firstLatitude) *
            Math.cos(secondLatitude) *
            Math.sin(longitudeDelta / 2) ** 2;

    return Math.round(
        earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)),
    );
}

export function nearestNeighborStopOrder(
    origin: DeliveryCoordinates,
    stops: GeocodedDeliveryRouteCandidate[],
) {
    const remaining = [...stops];
    const ordered: GeocodedDeliveryRouteCandidate[] = [];
    let current = origin;

    while (remaining.length > 0) {
        let closestIndex = 0;
        let closestDistance = Number.POSITIVE_INFINITY;

        for (const [index, stop] of remaining.entries()) {
            const distance = haversineDistanceMeters(current, stop);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = index;
            }
        }

        const [next] = remaining.splice(closestIndex, 1);
        if (!next) {
            break;
        }
        ordered.push(next);
        current = next;
    }

    return ordered;
}

async function geocodeAddress(
    formattedAddress: string,
): Promise<DeliveryCoordinates> {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', formattedAddress);
    url.searchParams.set('components', 'country:HR');
    url.searchParams.set('language', 'hr');
    url.searchParams.set('region', 'hr');
    url.searchParams.set('key', googleMapsApiKey());

    const response = await fetch(url, { cache: 'no-store' });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok || !isRecord(body) || body.status !== 'OK') {
        throw new Error(`Adresa se ne može pronaći: ${formattedAddress}`);
    }

    const firstResult = Array.isArray(body.results) ? body.results[0] : null;
    const geometry = isRecord(firstResult) ? firstResult.geometry : null;
    const location = isRecord(geometry) ? geometry.location : null;
    const latitude = isRecord(location) ? numberField(location.lat) : undefined;
    const longitude = isRecord(location)
        ? numberField(location.lng)
        : undefined;

    if (latitude === undefined || longitude === undefined) {
        throw new Error(`Adresa nema valjane koordinate: ${formattedAddress}`);
    }

    return { latitude, longitude };
}

function locationWaypoint(coordinates: DeliveryCoordinates) {
    return {
        location: {
            latLng: {
                latitude: coordinates.latitude,
                longitude: coordinates.longitude,
            },
        },
    };
}

function farthestStopIndex(
    origin: DeliveryCoordinates,
    stops: GeocodedDeliveryRouteCandidate[],
) {
    let selectedIndex = 0;
    let selectedDistance = -1;
    for (const [index, stop] of stops.entries()) {
        const distance = haversineDistanceMeters(origin, stop);
        if (distance > selectedDistance) {
            selectedIndex = index;
            selectedDistance = distance;
        }
    }
    return selectedIndex;
}

async function computeGoogleRoute({
    origin,
    stops,
    optimize,
    departureTime,
}: {
    origin: DeliveryCoordinates;
    stops: GeocodedDeliveryRouteCandidate[];
    optimize: boolean;
    departureTime: Date;
}): Promise<DeliveryRoutePlan> {
    if (stops.length > maximumRouteStops) {
        throw new Error(
            `Jedna ruta može sadržavati najviše ${maximumRouteStops} dostava.`,
        );
    }

    const destinationIndex = optimize
        ? farthestStopIndex(origin, stops)
        : stops.length - 1;
    const destination = stops[destinationIndex];
    if (!destination) {
        throw new Error('Ruta nema odredište.');
    }
    const intermediates = stops.filter(
        (_stop, index) => index !== destinationIndex,
    );

    const response = await fetch(
        'https://routes.googleapis.com/directions/v2:computeRoutes',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': googleMapsApiKey(),
                'X-Goog-FieldMask':
                    'routes.distanceMeters,routes.duration,routes.legs.distanceMeters,routes.legs.duration,routes.optimizedIntermediateWaypointIndex,routes.polyline.encodedPolyline',
            },
            body: JSON.stringify({
                origin: locationWaypoint(origin),
                destination: locationWaypoint(destination),
                intermediates: intermediates.map(locationWaypoint),
                travelMode: 'DRIVE',
                routingPreference: 'TRAFFIC_AWARE',
                optimizeWaypointOrder: optimize && intermediates.length > 1,
                departureTime: departureTime.toISOString(),
                languageCode: 'hr-HR',
                regionCode: 'HR',
                units: 'METRIC',
            }),
            cache: 'no-store',
        },
    );
    const body: unknown = await response.json().catch(() => null);
    const routes =
        isRecord(body) && Array.isArray(body.routes) ? body.routes : [];
    const routeValue = routes[0];
    if (!response.ok || !isRecord(routeValue)) {
        throw new Error('Google trenutno nije mogao izračunati rutu.');
    }
    const route: GoogleRoute = routeValue;
    const legs = routeLegs(route.legs);
    if (legs.length !== stops.length) {
        throw new Error('Izračun rute nije vratio sve planirane stanice.');
    }

    const indexes = optimizedIndexes(route.optimizedIntermediateWaypointIndex);
    const orderedIntermediates =
        optimize && indexes.length === intermediates.length
            ? indexes.map((index) => intermediates[index]).filter(Boolean)
            : intermediates;
    const orderedStops = [...orderedIntermediates, destination];
    let elapsedSeconds = 0;
    const plannedStops = orderedStops.map((stop, index) => {
        const leg = legs[index];
        const estimatedTravelSeconds = durationSeconds(leg?.duration) ?? 0;
        const estimatedDistanceMeters = numberField(leg?.distanceMeters) ?? 0;
        elapsedSeconds += estimatedTravelSeconds;
        const estimatedArrivalAt = new Date(
            departureTime.getTime() + elapsedSeconds * 1000,
        );
        if (index < orderedStops.length - 1) {
            elapsedSeconds += deliveryStopServiceSeconds;
        }

        return {
            ...stop,
            sequence: index + 1,
            estimatedArrivalAt,
            estimatedTravelSeconds,
            estimatedDistanceMeters,
        };
    });

    return {
        encodedPolyline:
            typeof route.polyline?.encodedPolyline === 'string'
                ? route.polyline.encodedPolyline
                : undefined,
        totalDistanceMeters:
            numberField(route.distanceMeters) ??
            plannedStops.reduce(
                (sum, stop) => sum + stop.estimatedDistanceMeters,
                0,
            ),
        totalDurationSeconds: elapsedSeconds,
        stops: plannedStops,
    };
}

function computeFallbackRoute({
    origin,
    stops,
    departureTime,
    optimize = true,
}: {
    origin: DeliveryCoordinates;
    stops: GeocodedDeliveryRouteCandidate[];
    departureTime: Date;
    optimize?: boolean;
}): DeliveryRoutePlan {
    const orderedStops = optimize
        ? nearestNeighborStopOrder(origin, stops)
        : stops;
    let current = origin;
    let elapsedSeconds = 0;
    let totalDistanceMeters = 0;
    const plannedStops = orderedStops.map((stop, index) => {
        const directDistance = haversineDistanceMeters(current, stop);
        const estimatedDistanceMeters = Math.round(directDistance * 1.25);
        const estimatedTravelSeconds = Math.max(
            60,
            Math.round(estimatedDistanceMeters / (25_000 / 3600)),
        );
        totalDistanceMeters += estimatedDistanceMeters;
        elapsedSeconds += estimatedTravelSeconds;
        const estimatedArrivalAt = new Date(
            departureTime.getTime() + elapsedSeconds * 1000,
        );
        if (index < orderedStops.length - 1) {
            elapsedSeconds += deliveryStopServiceSeconds;
        }
        current = stop;

        return {
            ...stop,
            sequence: index + 1,
            estimatedArrivalAt,
            estimatedTravelSeconds,
            estimatedDistanceMeters,
        };
    });

    return {
        totalDistanceMeters,
        totalDurationSeconds: elapsedSeconds,
        stops: plannedStops,
    };
}

export async function planDeliveryRoute({
    candidates,
    departureTime = new Date(),
}: {
    candidates: DeliveryRouteCandidate[];
    departureTime?: Date;
}) {
    if (candidates.length === 0) {
        throw new Error('Nema dostava za planiranje rute.');
    }
    if (candidates.length > maximumRouteStops) {
        throw new Error(
            `Jedna ruta može sadržavati najviše ${maximumRouteStops} dostava.`,
        );
    }

    const hqAddress =
        process.env.GREDICE_DELIVERY_HQ_ADDRESS?.trim() || defaultHqAddress;
    const [origin, geocodedStops] = await Promise.all([
        geocodeAddress(hqAddress),
        Promise.all(
            candidates.map(async (candidate) => ({
                ...candidate,
                ...(await geocodeAddress(candidate.formattedAddress)),
            })),
        ),
    ]);

    try {
        return await computeGoogleRoute({
            origin,
            stops: geocodedStops,
            optimize: true,
            departureTime,
        });
    } catch (error) {
        console.warn('Google route optimization failed; using local fallback', {
            error,
            stopCount: geocodedStops.length,
        });
        return computeFallbackRoute({
            origin,
            stops: geocodedStops,
            departureTime,
        });
    }
}

export async function recalculateDeliveryRoute({
    origin,
    stops,
    departureTime = new Date(),
}: {
    origin: DeliveryCoordinates;
    stops: GeocodedDeliveryRouteCandidate[];
    departureTime?: Date;
}) {
    if (stops.length === 0) {
        return {
            totalDistanceMeters: 0,
            totalDurationSeconds: 0,
            stops: [],
        } satisfies DeliveryRoutePlan;
    }

    try {
        return await computeGoogleRoute({
            origin,
            stops,
            optimize: false,
            departureTime,
        });
    } catch (error) {
        console.warn('Google ETA refresh failed; using local estimate', {
            error,
            stopCount: stops.length,
        });
        return computeFallbackRoute({
            origin,
            stops,
            departureTime,
            optimize: false,
        });
    }
}
