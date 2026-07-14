import 'server-only';

export type DeliveryCoordinates = {
    latitude: number;
    longitude: number;
};

export type DeliveryRouteCandidate = {
    deliveryRequestId: string;
    formattedAddress: string;
    geocodingAddress?: string;
    windowStartAt?: Date;
    windowEndAt?: Date;
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
export const maximumDeliveryRouteStops = 26;
export const maximumDeliveryRouteWindowHours = 24;
const defaultHqAddress = 'Ulica Julija Knifera 3, 10000 Zagreb, Hrvatska';

export class DeliveryRoutePlanningError extends Error {
    override name = 'DeliveryRoutePlanningError';

    constructor(
        message: string,
        readonly code = 'route-planning',
        readonly deliveryRequestId?: string,
    ) {
        super(message);
    }
}

function googleMapsServerApiKey() {
    const apiKey = process.env.GREDICE_GOOGLE_MAPS_SERVER_API_KEY?.trim();
    if (!apiKey) {
        throw new DeliveryRoutePlanningError(
            'Planiranje rute nije ispravno konfigurirano. Obrati se administratoru.',
            'google-maps-server-key-missing',
        );
    }
    return apiKey;
}

function googleServiceErrorCode(prefix: string, status: unknown) {
    const normalizedStatus =
        typeof status === 'string'
            ? status.toLowerCase().replaceAll('_', '-')
            : 'unknown';
    return `${prefix}-${normalizedStatus}`;
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

export function formatDeliveryGeocodingAddress(address: {
    street1: string;
    postalCode: string;
    city: string;
    countryCode: string;
}) {
    return [
        address.street1,
        `${address.postalCode} ${address.city}`,
        address.countryCode,
    ]
        .map((value) => value.trim())
        .filter(Boolean)
        .join(', ');
}

export function buildGoogleGeocodingUrl(
    formattedAddress: string,
    apiKey: string,
) {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', formattedAddress);
    // The address already contains its country. A region bias improves local
    // matching without redundantly applying a strict country component filter.
    url.searchParams.set('language', 'hr');
    url.searchParams.set('region', 'hr');
    url.searchParams.set('key', apiKey);
    return url;
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

function estimatedRoadLeg(
    first: DeliveryCoordinates,
    second: DeliveryCoordinates,
) {
    const estimatedDistanceMeters = Math.round(
        haversineDistanceMeters(first, second) * 1.25,
    );
    return {
        estimatedDistanceMeters,
        estimatedTravelSeconds: Math.max(
            60,
            Math.round(estimatedDistanceMeters / (25_000 / 3600)),
        ),
    };
}

function windowTimestamp(value: Date | undefined, fallback: number) {
    return value?.getTime() ?? fallback;
}

function deliveryWindowKey(stop: GeocodedDeliveryRouteCandidate) {
    return `${windowTimestamp(stop.windowStartAt, 0)}:${windowTimestamp(stop.windowEndAt, 0)}`;
}

export function orderDeliveryStopsByTimeWindow(
    origin: DeliveryCoordinates,
    stops: GeocodedDeliveryRouteCandidate[],
    departureTime = new Date(),
) {
    const remaining = [...stops];
    const ordered: GeocodedDeliveryRouteCandidate[] = [];
    let current = origin;
    let currentTime = departureTime.getTime();

    while (remaining.length > 0) {
        const candidates = remaining.map((stop, index) => {
            const { estimatedTravelSeconds } = estimatedRoadLeg(current, stop);
            const physicalArrivalTime =
                currentTime + estimatedTravelSeconds * 1_000;
            const scheduledArrivalTime = Math.max(
                physicalArrivalTime,
                windowTimestamp(stop.windowStartAt, physicalArrivalTime),
            );
            const windowEndTime = windowTimestamp(
                stop.windowEndAt,
                Number.POSITIVE_INFINITY,
            );
            const departureAfterService =
                scheduledArrivalTime + deliveryStopServiceSeconds * 1_000;
            const leavesRemainingReachable = remaining.every(
                (other, otherIndex) => {
                    if (otherIndex === index) return true;
                    const nextLeg = estimatedRoadLeg(stop, other);
                    const nextPhysicalArrival =
                        departureAfterService +
                        nextLeg.estimatedTravelSeconds * 1_000;
                    const nextScheduledArrival = Math.max(
                        nextPhysicalArrival,
                        windowTimestamp(
                            other.windowStartAt,
                            nextPhysicalArrival,
                        ),
                    );
                    return (
                        nextScheduledArrival <=
                        windowTimestamp(
                            other.windowEndAt,
                            Number.POSITIVE_INFINITY,
                        )
                    );
                },
            );

            return {
                index,
                stop,
                estimatedTravelSeconds,
                scheduledArrivalTime,
                windowEndTime,
                feasible: scheduledArrivalTime <= windowEndTime,
                leavesRemainingReachable,
            };
        });
        const feasibleCandidates = candidates.filter(
            (candidate) => candidate.feasible,
        );
        const candidatesKeepingOptionsOpen = feasibleCandidates.filter(
            (candidate) => candidate.leavesRemainingReachable,
        );
        const viableCandidates =
            candidatesKeepingOptionsOpen.length > 0
                ? candidatesKeepingOptionsOpen
                : feasibleCandidates.length > 0
                  ? feasibleCandidates
                  : candidates;
        const rankedCandidates = viableCandidates.sort(
            (first, second) =>
                first.scheduledArrivalTime - second.scheduledArrivalTime ||
                first.windowEndTime - second.windowEndTime ||
                first.estimatedTravelSeconds - second.estimatedTravelSeconds,
        );
        const nextCandidate = rankedCandidates[0];
        if (!nextCandidate) break;

        const [next] = remaining.splice(nextCandidate.index, 1);
        if (!next) break;
        ordered.push(next);
        current = next;
        currentTime =
            nextCandidate.scheduledArrivalTime +
            (remaining.length > 0 ? deliveryStopServiceSeconds * 1_000 : 0);
    }

    return ordered;
}

function stopsShareDeliveryWindow(stops: GeocodedDeliveryRouteCandidate[]) {
    const first = stops[0];
    return Boolean(
        first &&
            stops.every(
                (stop) => deliveryWindowKey(stop) === deliveryWindowKey(first),
            ),
    );
}

function scheduledArrival({
    departureTime,
    elapsedSeconds,
    travelSeconds,
    stop,
    enforceTimeWindows,
}: {
    departureTime: Date;
    elapsedSeconds: number;
    travelSeconds: number;
    stop: GeocodedDeliveryRouteCandidate;
    enforceTimeWindows: boolean;
}) {
    const physicalArrivalTime =
        departureTime.getTime() + (elapsedSeconds + travelSeconds) * 1_000;
    const arrivalTime = Math.max(
        physicalArrivalTime,
        windowTimestamp(stop.windowStartAt, physicalArrivalTime),
    );
    const windowEndTime = stop.windowEndAt?.getTime();
    if (
        enforceTimeWindows &&
        windowEndTime !== undefined &&
        arrivalTime > windowEndTime
    ) {
        throw new DeliveryRoutePlanningError(
            'Odabrane dostave nije moguće obaviti unutar svih termina. Ukloni dio dostava ili izradi zasebnu rutu.',
        );
    }

    return {
        estimatedArrivalAt: new Date(arrivalTime),
        elapsedSeconds: Math.round(
            (arrivalTime - departureTime.getTime()) / 1_000,
        ),
    };
}

async function geocodeAddress({
    formattedAddress,
    geocodingAddress,
    deliveryRequestId,
}: {
    formattedAddress: string;
    geocodingAddress?: string;
    deliveryRequestId?: string;
}): Promise<DeliveryCoordinates> {
    const queries = Array.from(
        new Set(
            [geocodingAddress, formattedAddress].filter(
                (value): value is string => Boolean(value),
            ),
        ),
    );

    for (const query of queries) {
        const response = await fetch(
            buildGoogleGeocodingUrl(query, googleMapsServerApiKey()),
            { cache: 'no-store' },
        );
        const body: unknown = await response.json().catch(() => null);
        const googleStatus = isRecord(body) ? body.status : undefined;
        if (response.ok && googleStatus === 'ZERO_RESULTS') {
            continue;
        }
        if (!response.ok || !isRecord(body) || googleStatus !== 'OK') {
            throw new DeliveryRoutePlanningError(
                'Google Maps trenutačno nije mogao provjeriti adrese dostave. Obrati se administratoru.',
                googleServiceErrorCode('google-geocoding', googleStatus),
                deliveryRequestId,
            );
        }

        const firstResult = Array.isArray(body.results)
            ? body.results[0]
            : null;
        const geometry = isRecord(firstResult) ? firstResult.geometry : null;
        const location = isRecord(geometry) ? geometry.location : null;
        const latitude = isRecord(location)
            ? numberField(location.lat)
            : undefined;
        const longitude = isRecord(location)
            ? numberField(location.lng)
            : undefined;

        if (latitude === undefined || longitude === undefined) {
            throw new Error(
                'Google Maps nije vratio valjane koordinate dostave.',
            );
        }

        return { latitude, longitude };
    }

    const addressType = deliveryRequestId ? 'dostave' : 'sjedišta';
    throw new DeliveryRoutePlanningError(
        `Adresu ${addressType} "${formattedAddress}" nije moguće pronaći na karti. Provjeri zapis adrese i pokušaj ponovno.`,
        deliveryRequestId
            ? 'delivery-address-not-found'
            : 'hq-address-not-found',
        deliveryRequestId,
    );
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
    enforceTimeWindows,
}: {
    origin: DeliveryCoordinates;
    stops: GeocodedDeliveryRouteCandidate[];
    optimize: boolean;
    departureTime: Date;
    enforceTimeWindows: boolean;
}): Promise<DeliveryRoutePlan> {
    if (stops.length > maximumDeliveryRouteStops) {
        throw new Error(
            `Jedna ruta može sadržavati najviše ${maximumDeliveryRouteStops} fizičkih stanica.`,
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
                'X-Goog-Api-Key': googleMapsServerApiKey(),
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
        const scheduled = scheduledArrival({
            departureTime,
            elapsedSeconds,
            travelSeconds: estimatedTravelSeconds,
            stop,
            enforceTimeWindows,
        });
        elapsedSeconds = scheduled.elapsedSeconds;
        if (index < orderedStops.length - 1) {
            elapsedSeconds += deliveryStopServiceSeconds;
        }

        return {
            ...stop,
            sequence: index + 1,
            estimatedArrivalAt: scheduled.estimatedArrivalAt,
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

export function estimateDeliveryRoute({
    origin,
    stops,
    departureTime,
    optimize = true,
    enforceTimeWindows = true,
}: {
    origin: DeliveryCoordinates;
    stops: GeocodedDeliveryRouteCandidate[];
    departureTime: Date;
    optimize?: boolean;
    enforceTimeWindows?: boolean;
}): DeliveryRoutePlan {
    const orderedStops = optimize
        ? nearestNeighborStopOrder(origin, stops)
        : stops;
    let current = origin;
    let elapsedSeconds = 0;
    let totalDistanceMeters = 0;
    const plannedStops = orderedStops.map((stop, index) => {
        const { estimatedDistanceMeters, estimatedTravelSeconds } =
            estimatedRoadLeg(current, stop);
        totalDistanceMeters += estimatedDistanceMeters;
        const scheduled = scheduledArrival({
            departureTime,
            elapsedSeconds,
            travelSeconds: estimatedTravelSeconds,
            stop,
            enforceTimeWindows,
        });
        elapsedSeconds = scheduled.elapsedSeconds;
        if (index < orderedStops.length - 1) {
            elapsedSeconds += deliveryStopServiceSeconds;
        }
        current = stop;

        return {
            ...stop,
            sequence: index + 1,
            estimatedArrivalAt: scheduled.estimatedArrivalAt,
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
    if (candidates.length > maximumDeliveryRouteStops) {
        throw new Error(
            `Jedna ruta može sadržavati najviše ${maximumDeliveryRouteStops} fizičkih stanica.`,
        );
    }
    for (const candidate of candidates) {
        if (
            !candidate.windowStartAt ||
            !candidate.windowEndAt ||
            !Number.isFinite(candidate.windowStartAt.getTime()) ||
            !Number.isFinite(candidate.windowEndAt.getTime()) ||
            candidate.windowStartAt >= candidate.windowEndAt
        ) {
            throw new DeliveryRoutePlanningError(
                'Jedna ili više odabranih dostava nema valjani termin.',
            );
        }
    }
    const earliestWindowStart = Math.min(
        ...candidates.map(
            (candidate) => candidate.windowStartAt?.getTime() ?? 0,
        ),
    );
    const latestWindowEnd = Math.max(
        ...candidates.map((candidate) => candidate.windowEndAt?.getTime() ?? 0),
    );
    if (
        latestWindowEnd - earliestWindowStart >
        maximumDeliveryRouteWindowHours * 60 * 60 * 1_000
    ) {
        throw new DeliveryRoutePlanningError(
            `Jedna ruta može povezati termine unutar najviše ${maximumDeliveryRouteWindowHours} sata. Za udaljenije termine izradi zasebne rute.`,
        );
    }

    const hqAddress =
        process.env.GREDICE_DELIVERY_HQ_ADDRESS?.trim() || defaultHqAddress;
    const [origin, geocodedStops] = await Promise.all([
        geocodeAddress({ formattedAddress: hqAddress }),
        Promise.all(
            candidates.map(async (candidate) => ({
                ...candidate,
                ...(await geocodeAddress({
                    formattedAddress: candidate.formattedAddress,
                    geocodingAddress: candidate.geocodingAddress,
                    deliveryRequestId: candidate.deliveryRequestId,
                })),
            })),
        ),
    ]);
    const optimizeAsOneWindow = stopsShareDeliveryWindow(geocodedStops);
    const orderedStops = optimizeAsOneWindow
        ? geocodedStops
        : orderDeliveryStopsByTimeWindow(origin, geocodedStops, departureTime);

    try {
        return await computeGoogleRoute({
            origin,
            stops: orderedStops,
            optimize: optimizeAsOneWindow,
            departureTime,
            enforceTimeWindows: true,
        });
    } catch (error) {
        if (error instanceof DeliveryRoutePlanningError) {
            throw error;
        }
        console.warn('Google route optimization failed; using local fallback', {
            error,
            stopCount: orderedStops.length,
        });
        return estimateDeliveryRoute({
            origin,
            stops: orderedStops,
            departureTime,
            optimize: optimizeAsOneWindow,
            enforceTimeWindows: true,
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
            enforceTimeWindows: false,
        });
    } catch (error) {
        console.warn('Google ETA refresh failed; using local estimate', {
            error,
            stopCount: stops.length,
        });
        return estimateDeliveryRoute({
            origin,
            stops,
            departureTime,
            optimize: false,
            enforceTimeWindows: false,
        });
    }
}
