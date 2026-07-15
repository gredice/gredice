import 'server-only';
import {
    type DeliveryRouteGraphLeg,
    type DeliveryRouteGraphNode,
    type DeliveryRouteGraphPlan,
    DeliveryRouteGraphPlanningError,
    deliveryNodeServiceSeconds,
    maximumDeliveryRouteGraphNodes,
    pickupNodeServiceSeconds,
    solveDeliveryRouteGraph,
} from './deliveryRouteGraph';
import {
    buildGoogleGeocodingUrl,
    type DeliveryCoordinates,
    type DeliveryRouteCandidate,
    DeliveryRoutePlanningError,
    haversineDistanceMeters,
    maximumDeliveryRouteWindowHours,
} from './deliveryRouting';

export type DeliveryPickupRouteCandidate = {
    nodeKey: string;
    pickupLocationId: number;
    formattedAddress: string;
    geocodingAddress?: string;
    deliveryRequestId?: string;
};

export type PickupAwareDeliveryRouteCandidate = DeliveryRouteCandidate & {
    nodeKey: string;
    requiredPickupKey: string;
};

type PlannedRouteNodeBase = DeliveryCoordinates & {
    nodeKey: string;
    itinerarySequence: number;
    estimatedArrivalAt: Date;
    serviceDurationSeconds: number;
};

export type PlannedDeliveryPickupNode = DeliveryPickupRouteCandidate &
    PlannedRouteNodeBase & {
        kind: 'pickup';
        sequence: number;
        incomingTravelSeconds: number;
        incomingDistanceMeters: number;
        estimatedTravelSeconds: number;
        estimatedDistanceMeters: number;
    };

export type PlannedPickupAwareDeliveryStop = PickupAwareDeliveryRouteCandidate &
    PlannedRouteNodeBase & {
        kind: 'customer';
        sequence: number;
        estimatedTravelSeconds: number;
        estimatedDistanceMeters: number;
    };

export type PlannedPickupAwareRouteNode =
    | PlannedDeliveryPickupNode
    | PlannedPickupAwareDeliveryStop;

export type PickupAwareDeliveryRoutePlan = {
    routePlanVersion: 2;
    estimateSource: 'google' | 'local';
    encodedPolyline?: string;
    totalDistanceMeters: number;
    totalDurationSeconds: number;
    totalTravelSeconds: number;
    totalWaitingSeconds: number;
    totalServiceSeconds: number;
    pickupNodes: PlannedDeliveryPickupNode[];
    stops: PlannedPickupAwareDeliveryStop[];
    itinerary: PlannedPickupAwareRouteNode[];
};

type GeocodedPickupCandidate = DeliveryPickupRouteCandidate &
    DeliveryCoordinates;
type GeocodedCustomerCandidate = PickupAwareDeliveryRouteCandidate &
    DeliveryCoordinates;

type GoogleRouteLeg = {
    distanceMeters?: unknown;
    duration?: unknown;
};

type GoogleRoute = {
    legs?: unknown;
    polyline?: { encodedPolyline?: unknown };
};

const googleRouteMatrixMaximumElements = 625;
export const maximumPickupAwareRouteNodes = maximumDeliveryRouteGraphNodes;

class GoogleRouteServiceError extends Error {
    override name = 'GoogleRouteServiceError';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function finiteNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : undefined;
}

function nonnegativeInteger(value: unknown): number | undefined {
    const number = finiteNumber(value);
    return number !== undefined && number >= 0 ? Math.round(number) : undefined;
}

function durationSeconds(value: unknown): number | undefined {
    if (typeof value !== 'string') return undefined;
    const match = /^(\d+(?:\.\d+)?)s$/.exec(value);
    return match?.[1] ? Math.round(Number(match[1])) : undefined;
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

async function geocodeRouteNode({
    kind,
    nodeKey,
    formattedAddress,
    geocodingAddress,
    deliveryRequestId,
}: {
    kind: 'customer' | 'pickup';
    nodeKey: string;
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
        if (response.ok && googleStatus === 'ZERO_RESULTS') continue;
        if (!response.ok || !isRecord(body) || googleStatus !== 'OK') {
            throw new DeliveryRoutePlanningError(
                'Google Maps trenutačno nije mogao provjeriti adrese rute. Obrati se administratoru.',
                googleServiceErrorCode('google-geocoding', googleStatus),
                deliveryRequestId,
                nodeKey,
            );
        }

        const firstResult = Array.isArray(body.results)
            ? body.results[0]
            : null;
        const geometry = isRecord(firstResult) ? firstResult.geometry : null;
        const location = isRecord(geometry) ? geometry.location : null;
        const latitude = isRecord(location)
            ? finiteNumber(location.lat)
            : undefined;
        const longitude = isRecord(location)
            ? finiteNumber(location.lng)
            : undefined;
        if (latitude === undefined || longitude === undefined) {
            throw new DeliveryRoutePlanningError(
                'Google Maps nije vratio valjane koordinate rute.',
                'google-geocoding-invalid-response',
                deliveryRequestId,
                nodeKey,
            );
        }
        return { latitude, longitude };
    }

    const addressKind = kind === 'pickup' ? 'preuzimanja' : 'dostave';
    throw new DeliveryRoutePlanningError(
        `Adresu ${addressKind} "${formattedAddress}" nije moguće pronaći na karti. Provjeri zapis adrese i pokušaj ponovno.`,
        kind === 'pickup'
            ? 'pickup-address-not-found'
            : 'delivery-address-not-found',
        deliveryRequestId,
        nodeKey,
    );
}

function validateCustomerWindows(
    candidates: readonly PickupAwareDeliveryRouteCandidate[],
) {
    for (const candidate of candidates) {
        if (
            !candidate.windowStartAt ||
            !candidate.windowEndAt ||
            !Number.isFinite(candidate.windowStartAt.getTime()) ||
            !Number.isFinite(candidate.windowEndAt.getTime()) ||
            candidate.windowStartAt >= candidate.windowEndAt
        ) {
            throw new DeliveryRoutePlanningError(
                `Dostava za adresu "${candidate.formattedAddress}" nema valjani termin. Provjeri termin ili je izdvoji u zasebnu rutu.`,
                'delivery-window-invalid',
                candidate.deliveryRequestId,
                candidate.nodeKey,
            );
        }
    }

    const earliestStart = Math.min(
        ...candidates.map(
            (candidate) => candidate.windowStartAt?.getTime() ?? 0,
        ),
    );
    const latestEnd = Math.max(
        ...candidates.map((candidate) => candidate.windowEndAt?.getTime() ?? 0),
    );
    if (
        latestEnd - earliestStart <=
        maximumDeliveryRouteWindowHours * 60 * 60 * 1_000
    ) {
        return;
    }

    const offending = [...candidates].sort((first, second) => {
        const endDifference =
            (second.windowEndAt?.getTime() ?? 0) -
            (first.windowEndAt?.getTime() ?? 0);
        if (endDifference !== 0) return endDifference;
        const startDifference =
            (second.windowStartAt?.getTime() ?? 0) -
            (first.windowStartAt?.getTime() ?? 0);
        return (
            startDifference ||
            first.deliveryRequestId.localeCompare(second.deliveryRequestId)
        );
    })[0];
    throw new DeliveryRoutePlanningError(
        `Jedna ruta može povezati termine unutar najviše ${maximumDeliveryRouteWindowHours} sata. Dostavu za adresu "${offending?.formattedAddress ?? 'sljedeće dostave'}" izdvoji u zasebnu rutu.`,
        'route-window-span-exceeded',
        offending?.deliveryRequestId,
        offending?.nodeKey,
    );
}

function validateRouteCandidates({
    pickupCandidates,
    candidates,
    originPickupNodeKey,
}: {
    pickupCandidates: readonly DeliveryPickupRouteCandidate[];
    candidates: readonly PickupAwareDeliveryRouteCandidate[];
    originPickupNodeKey?: string;
}) {
    if (pickupCandidates.length === 0 || candidates.length === 0) {
        throw new DeliveryRoutePlanningError(
            'Ruta mora sadržavati barem jedno preuzimanje i jednu dostavu.',
            'invalid-route-graph',
        );
    }

    const routeNodes = [...pickupCandidates, ...candidates];
    if (routeNodes.length > maximumPickupAwareRouteNodes) {
        const offending = routeNodes[maximumPickupAwareRouteNodes];
        throw new DeliveryRoutePlanningError(
            `Jedna ruta može sadržavati najviše ${maximumPickupAwareRouteNodes} fizičkih lokacija, uključujući preuzimanja. Lokaciju "${offending?.formattedAddress ?? 'sljedeće stanice'}" izdvoji u zasebnu rutu.`,
            'route-stop-limit-exceeded',
            offending?.deliveryRequestId,
            offending?.nodeKey,
        );
    }

    const pickupKeys = new Set<string>();
    const allKeys = new Set<string>();
    for (const pickup of pickupCandidates) {
        if (!pickup.nodeKey || allKeys.has(pickup.nodeKey)) {
            throw new DeliveryRoutePlanningError(
                'Ruta sadrži neispravne ili ponovljene lokacije preuzimanja.',
                'invalid-route-graph',
                pickup.deliveryRequestId,
                pickup.nodeKey,
            );
        }
        pickupKeys.add(pickup.nodeKey);
        allKeys.add(pickup.nodeKey);
    }
    for (const candidate of candidates) {
        if (
            !candidate.nodeKey ||
            allKeys.has(candidate.nodeKey) ||
            !pickupKeys.has(candidate.requiredPickupKey)
        ) {
            throw new DeliveryRoutePlanningError(
                'Dostavna stanica nije povezana s valjanom lokacijom preuzimanja.',
                'invalid-route-graph',
                candidate.deliveryRequestId,
                candidate.nodeKey,
            );
        }
        allKeys.add(candidate.nodeKey);
    }
    if (originPickupNodeKey && !pickupKeys.has(originPickupNodeKey)) {
        throw new DeliveryRoutePlanningError(
            'Početna lokacija rute nije valjana lokacija preuzimanja.',
            'invalid-route-graph',
            undefined,
            originPickupNodeKey,
        );
    }
    validateCustomerWindows(candidates);
}

function defaultOriginPickupKey(
    pickups: readonly DeliveryPickupRouteCandidate[],
    customers: readonly PickupAwareDeliveryRouteCandidate[],
) {
    return [...pickups].sort((first, second) => {
        const firstWindow = Math.min(
            ...customers
                .filter(
                    (customer) => customer.requiredPickupKey === first.nodeKey,
                )
                .map(
                    (customer) =>
                        customer.windowStartAt?.getTime() ??
                        Number.POSITIVE_INFINITY,
                ),
        );
        const secondWindow = Math.min(
            ...customers
                .filter(
                    (customer) => customer.requiredPickupKey === second.nodeKey,
                )
                .map(
                    (customer) =>
                        customer.windowStartAt?.getTime() ??
                        Number.POSITIVE_INFINITY,
                ),
        );
        return (
            firstWindow - secondWindow ||
            first.nodeKey.localeCompare(second.nodeKey)
        );
    })[0]?.nodeKey;
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

function matrixWaypoint(coordinates: DeliveryCoordinates) {
    return { waypoint: locationWaypoint(coordinates) };
}

function matrixStatusSucceeded(status: unknown) {
    if (status === undefined || status === null) return true;
    if (!isRecord(status)) return false;
    const code = finiteNumber(status.code);
    return code === undefined || code === 0;
}

async function computeGoogleRouteMatrix({
    nodes,
    departureTime,
}: {
    nodes: DeliveryRouteGraphNode[];
    departureTime: Date;
}) {
    const maximumOriginsPerRequest = Math.max(
        1,
        Math.floor(googleRouteMatrixMaximumElements / nodes.length),
    );
    const legs: DeliveryRouteGraphLeg[] = [];

    for (
        let originOffset = 0;
        originOffset < nodes.length;
        originOffset += maximumOriginsPerRequest
    ) {
        const originNodes = nodes.slice(
            originOffset,
            originOffset + maximumOriginsPerRequest,
        );
        let response: Response;
        try {
            response = await fetch(
                'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Goog-Api-Key': googleMapsServerApiKey(),
                        'X-Goog-FieldMask':
                            'originIndex,destinationIndex,duration,distanceMeters,status,condition',
                    },
                    body: JSON.stringify({
                        origins: originNodes.map(matrixWaypoint),
                        destinations: nodes.map(matrixWaypoint),
                        travelMode: 'DRIVE',
                        routingPreference: 'TRAFFIC_AWARE',
                        departureTime: departureTime.toISOString(),
                        languageCode: 'hr-HR',
                        regionCode: 'HR',
                        units: 'METRIC',
                    }),
                    cache: 'no-store',
                },
            );
        } catch {
            throw new GoogleRouteServiceError(
                'Google route matrix request failed.',
            );
        }
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(body)) {
            throw new GoogleRouteServiceError(
                'Google route matrix response was unavailable.',
            );
        }

        for (const value of body) {
            if (!isRecord(value)) {
                throw new GoogleRouteServiceError(
                    'Google route matrix returned an invalid element.',
                );
            }
            const localOriginIndex = nonnegativeInteger(value.originIndex);
            const destinationIndex = nonnegativeInteger(value.destinationIndex);
            if (
                localOriginIndex === undefined ||
                destinationIndex === undefined ||
                localOriginIndex >= originNodes.length ||
                destinationIndex >= nodes.length
            ) {
                throw new GoogleRouteServiceError(
                    'Google route matrix returned invalid indexes.',
                );
            }
            if (value.condition === 'ROUTE_NOT_FOUND') continue;
            if (
                value.condition !== 'ROUTE_EXISTS' ||
                !matrixStatusSucceeded(value.status)
            ) {
                throw new GoogleRouteServiceError(
                    'Google route matrix returned a failed element.',
                );
            }
            const origin = originNodes[localOriginIndex];
            const destination = nodes[destinationIndex];
            if (!origin || !destination || origin.key === destination.key) {
                continue;
            }
            const travelSeconds = durationSeconds(value.duration);
            const distanceMeters = nonnegativeInteger(value.distanceMeters);
            if (travelSeconds === undefined || distanceMeters === undefined) {
                throw new GoogleRouteServiceError(
                    'Google route matrix omitted route metrics.',
                );
            }
            legs.push({
                fromKey: origin.key,
                toKey: destination.key,
                travelSeconds,
                distanceMeters,
            });
        }
    }
    return legs;
}

function localRouteLegs(nodes: readonly DeliveryRouteGraphNode[]) {
    return nodes.flatMap((origin) =>
        nodes.flatMap((destination) => {
            if (origin.key === destination.key) return [];
            const distanceMeters = Math.round(
                haversineDistanceMeters(origin, destination) * 1.25,
            );
            const travelSeconds =
                distanceMeters === 0
                    ? 0
                    : Math.max(
                          60,
                          Math.round(distanceMeters / (25_000 / 3_600)),
                      );
            return [
                {
                    fromKey: origin.key,
                    toKey: destination.key,
                    travelSeconds,
                    distanceMeters,
                },
            ];
        }),
    );
}

function routePlanningError(
    error: DeliveryRouteGraphPlanningError,
    candidatesByNodeKey: ReadonlyMap<
        string,
        DeliveryPickupRouteCandidate | PickupAwareDeliveryRouteCandidate
    >,
) {
    const candidate = error.nodeKey
        ? candidatesByNodeKey.get(error.nodeKey)
        : undefined;
    if (error.code === 'route-time-window-infeasible') {
        return new DeliveryRoutePlanningError(
            `Dostavu za adresu "${candidate?.formattedAddress ?? 'odabrane dostave'}" nije moguće stići unutar termina. Izdvoji je u zasebnu rutu ili promijeni odabir.`,
            error.code,
            error.deliveryRequestId ?? candidate?.deliveryRequestId,
            error.nodeKey,
        );
    }
    if (error.code === 'route-infeasible') {
        return new DeliveryRoutePlanningError(
            `Odabrana preuzimanja i dostave nije moguće povezati u jednu rutu. Lokaciju "${candidate?.formattedAddress ?? 'sljedeće stanice'}" izdvoji u zasebnu rutu.`,
            error.code,
            error.deliveryRequestId ?? candidate?.deliveryRequestId,
            error.nodeKey,
        );
    }
    return new DeliveryRoutePlanningError(
        'Podaci za planiranje povezane rute nisu valjani. Osvježi odabir i pokušaj ponovno.',
        error.code,
        error.deliveryRequestId ?? candidate?.deliveryRequestId,
        error.nodeKey,
    );
}

function solveRouteGraph({
    nodes,
    originKey,
    departureTime,
    legs,
    candidatesByNodeKey,
}: {
    nodes: DeliveryRouteGraphNode[];
    originKey: string;
    departureTime: Date;
    legs: DeliveryRouteGraphLeg[];
    candidatesByNodeKey: ReadonlyMap<
        string,
        DeliveryPickupRouteCandidate | PickupAwareDeliveryRouteCandidate
    >;
}) {
    try {
        return solveDeliveryRouteGraph({
            nodes,
            originKey,
            departureAt: departureTime,
            legs,
        });
    } catch (error) {
        if (error instanceof DeliveryRouteGraphPlanningError) {
            throw routePlanningError(error, candidatesByNodeKey);
        }
        throw error;
    }
}

function googleRouteLegs(value: unknown): GoogleRouteLeg[] {
    return Array.isArray(value) ? value.filter(isRecord) : [];
}

async function computeFixedGoogleRoute({
    graphPlan,
    departureTime,
    candidatesByNodeKey,
}: {
    graphPlan: DeliveryRouteGraphPlan;
    departureTime: Date;
    candidatesByNodeKey: ReadonlyMap<
        string,
        DeliveryPickupRouteCandidate | PickupAwareDeliveryRouteCandidate
    >;
}) {
    const orderedNodes = graphPlan.visits.map((visit) => visit.node);
    const origin = orderedNodes[0];
    const destination = orderedNodes.at(-1);
    if (!origin || !destination || orderedNodes.length < 2) {
        throw new GoogleRouteServiceError(
            'Google route requires an origin and destination.',
        );
    }

    let response: Response;
    try {
        response = await fetch(
            'https://routes.googleapis.com/directions/v2:computeRoutes',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': googleMapsServerApiKey(),
                    'X-Goog-FieldMask':
                        'routes.legs.distanceMeters,routes.legs.duration,routes.polyline.encodedPolyline',
                },
                body: JSON.stringify({
                    origin: locationWaypoint(origin),
                    destination: locationWaypoint(destination),
                    intermediates: orderedNodes
                        .slice(1, -1)
                        .map(locationWaypoint),
                    travelMode: 'DRIVE',
                    routingPreference: 'TRAFFIC_AWARE',
                    optimizeWaypointOrder: false,
                    departureTime: departureTime.toISOString(),
                    languageCode: 'hr-HR',
                    regionCode: 'HR',
                    units: 'METRIC',
                }),
                cache: 'no-store',
            },
        );
    } catch {
        throw new GoogleRouteServiceError('Google route request failed.');
    }
    const body: unknown = await response.json().catch(() => null);
    const routeValue =
        isRecord(body) && Array.isArray(body.routes) ? body.routes[0] : null;
    if (!response.ok || !isRecord(routeValue)) {
        throw new GoogleRouteServiceError(
            'Google final route response was unavailable.',
        );
    }
    const route: GoogleRoute = routeValue;
    const returnedLegs = googleRouteLegs(route.legs);
    if (returnedLegs.length !== orderedNodes.length - 1) {
        throw new GoogleRouteServiceError(
            'Google final route omitted itinerary legs.',
        );
    }
    const fixedLegs: DeliveryRouteGraphLeg[] = returnedLegs.map(
        (leg, index) => {
            const from = orderedNodes[index];
            const to = orderedNodes[index + 1];
            const travelSeconds = durationSeconds(leg.duration);
            const distanceMeters = nonnegativeInteger(leg.distanceMeters);
            if (
                !from ||
                !to ||
                travelSeconds === undefined ||
                distanceMeters === undefined
            ) {
                throw new GoogleRouteServiceError(
                    'Google final route returned an invalid leg.',
                );
            }
            return {
                fromKey: from.key,
                toKey: to.key,
                travelSeconds,
                distanceMeters,
            };
        },
    );
    const plan = solveRouteGraph({
        nodes: orderedNodes,
        originKey: origin.key,
        departureTime,
        legs: fixedLegs,
        candidatesByNodeKey,
    });
    return {
        plan,
        encodedPolyline:
            typeof route.polyline?.encodedPolyline === 'string'
                ? route.polyline.encodedPolyline
                : undefined,
    };
}

function formatPlan({
    graphPlan,
    estimateSource,
    encodedPolyline,
    pickupCandidatesByNodeKey,
    customerCandidatesByNodeKey,
}: {
    graphPlan: DeliveryRouteGraphPlan;
    estimateSource: 'google' | 'local';
    encodedPolyline?: string;
    pickupCandidatesByNodeKey: ReadonlyMap<string, GeocodedPickupCandidate>;
    customerCandidatesByNodeKey: ReadonlyMap<string, GeocodedCustomerCandidate>;
}): PickupAwareDeliveryRoutePlan {
    let pickupSequence = 0;
    let customerSequence = 0;
    const itinerary: PlannedPickupAwareRouteNode[] = [];
    for (const visit of graphPlan.visits) {
        if (visit.node.kind === 'pickup') {
            const candidate = pickupCandidatesByNodeKey.get(visit.node.key);
            if (!candidate) {
                throw new DeliveryRoutePlanningError(
                    'Planirana lokacija preuzimanja nije pronađena.',
                    'invalid-route-graph',
                    undefined,
                    visit.node.key,
                );
            }
            pickupSequence += 1;
            const plannedPickup: PlannedDeliveryPickupNode = {
                ...candidate,
                kind: 'pickup',
                sequence: pickupSequence,
                itinerarySequence: visit.sequence,
                estimatedArrivalAt: visit.serviceStartedAt,
                incomingTravelSeconds: visit.incomingTravelSeconds,
                incomingDistanceMeters: visit.incomingDistanceMeters,
                estimatedTravelSeconds: visit.incomingTravelSeconds,
                estimatedDistanceMeters: visit.incomingDistanceMeters,
                serviceDurationSeconds: visit.serviceSeconds,
            };
            itinerary.push(plannedPickup);
            continue;
        }
        const candidate = customerCandidatesByNodeKey.get(visit.node.key);
        if (!candidate) {
            throw new DeliveryRoutePlanningError(
                'Planirana dostavna stanica nije pronađena.',
                'invalid-route-graph',
                visit.node.deliveryRequestId,
                visit.node.key,
            );
        }
        customerSequence += 1;
        const plannedStop: PlannedPickupAwareDeliveryStop = {
            ...candidate,
            kind: 'customer',
            sequence: customerSequence,
            itinerarySequence: visit.sequence,
            estimatedArrivalAt: visit.serviceStartedAt,
            estimatedTravelSeconds: visit.incomingTravelSeconds,
            estimatedDistanceMeters: visit.incomingDistanceMeters,
            serviceDurationSeconds: visit.serviceSeconds,
        };
        itinerary.push(plannedStop);
    }
    const pickupNodes = itinerary.filter(
        (node): node is PlannedDeliveryPickupNode => node.kind === 'pickup',
    );
    const stops = itinerary.filter(
        (node): node is PlannedPickupAwareDeliveryStop =>
            node.kind === 'customer',
    );

    return {
        routePlanVersion: 2,
        estimateSource,
        ...(encodedPolyline ? { encodedPolyline } : {}),
        totalDistanceMeters: graphPlan.totalDistanceMeters,
        totalDurationSeconds: graphPlan.totalDurationSeconds,
        totalTravelSeconds: graphPlan.totalTravelSeconds,
        totalWaitingSeconds: graphPlan.totalWaitingSeconds,
        totalServiceSeconds: graphPlan.totalServiceSeconds,
        pickupNodes,
        stops,
        itinerary,
    };
}

export async function planPickupAwareDeliveryRoute({
    pickupCandidates,
    candidates,
    departureTime = new Date(),
    originPickupNodeKey,
}: {
    pickupCandidates: DeliveryPickupRouteCandidate[];
    candidates: PickupAwareDeliveryRouteCandidate[];
    departureTime?: Date;
    originPickupNodeKey?: string;
}): Promise<PickupAwareDeliveryRoutePlan> {
    validateRouteCandidates({
        pickupCandidates,
        candidates,
        originPickupNodeKey,
    });

    const [geocodedPickups, geocodedCustomers] = await Promise.all([
        Promise.all(
            pickupCandidates.map(async (candidate) => ({
                ...candidate,
                ...(await geocodeRouteNode({
                    kind: 'pickup',
                    nodeKey: candidate.nodeKey,
                    formattedAddress: candidate.formattedAddress,
                    geocodingAddress: candidate.geocodingAddress,
                    deliveryRequestId: candidate.deliveryRequestId,
                })),
            })),
        ),
        Promise.all(
            candidates.map(async (candidate) => ({
                ...candidate,
                ...(await geocodeRouteNode({
                    kind: 'customer',
                    nodeKey: candidate.nodeKey,
                    formattedAddress: candidate.formattedAddress,
                    geocodingAddress: candidate.geocodingAddress,
                    deliveryRequestId: candidate.deliveryRequestId,
                })),
            })),
        ),
    ]);
    const pickupCandidatesByNodeKey = new Map(
        geocodedPickups.map((candidate) => [candidate.nodeKey, candidate]),
    );
    const customerCandidatesByNodeKey = new Map(
        geocodedCustomers.map((candidate) => [candidate.nodeKey, candidate]),
    );
    const candidatesByNodeKey = new Map<
        string,
        DeliveryPickupRouteCandidate | PickupAwareDeliveryRouteCandidate
    >([
        ...pickupCandidates.map(
            (candidate): [string, DeliveryPickupRouteCandidate] => [
                candidate.nodeKey,
                candidate,
            ],
        ),
        ...candidates.map(
            (candidate): [string, PickupAwareDeliveryRouteCandidate] => [
                candidate.nodeKey,
                candidate,
            ],
        ),
    ]);
    const nodes: DeliveryRouteGraphNode[] = [
        ...geocodedPickups.map(
            (candidate): DeliveryRouteGraphNode => ({
                kind: 'pickup',
                key: candidate.nodeKey,
                latitude: candidate.latitude,
                longitude: candidate.longitude,
                serviceSeconds: pickupNodeServiceSeconds,
            }),
        ),
        ...geocodedCustomers.map(
            (candidate): DeliveryRouteGraphNode => ({
                kind: 'customer',
                key: candidate.nodeKey,
                latitude: candidate.latitude,
                longitude: candidate.longitude,
                serviceSeconds: deliveryNodeServiceSeconds,
                windowStartAt: candidate.windowStartAt,
                windowEndAt: candidate.windowEndAt,
                requiredPickupKey: candidate.requiredPickupKey,
                deliveryRequestId: candidate.deliveryRequestId,
            }),
        ),
    ];
    const originKey =
        originPickupNodeKey ??
        defaultOriginPickupKey(pickupCandidates, candidates);
    if (!originKey) {
        throw new DeliveryRoutePlanningError(
            'Ruta nema valjanu početnu lokaciju preuzimanja.',
            'invalid-route-graph',
        );
    }

    try {
        const matrixLegs = await computeGoogleRouteMatrix({
            nodes,
            departureTime,
        });
        const matrixPlan = solveRouteGraph({
            nodes,
            originKey,
            departureTime,
            legs: matrixLegs,
            candidatesByNodeKey,
        });
        const finalRoute = await computeFixedGoogleRoute({
            graphPlan: matrixPlan,
            departureTime,
            candidatesByNodeKey,
        });
        return formatPlan({
            graphPlan: finalRoute.plan,
            estimateSource: 'google',
            encodedPolyline: finalRoute.encodedPolyline,
            pickupCandidatesByNodeKey,
            customerCandidatesByNodeKey,
        });
    } catch (error) {
        if (error instanceof DeliveryRoutePlanningError) throw error;
        if (!(error instanceof GoogleRouteServiceError)) throw error;
        console.warn(
            'Google pickup-aware route planning failed; using local fallback',
            { nodeCount: nodes.length, error },
        );
    }

    const localPlan = solveRouteGraph({
        nodes,
        originKey,
        departureTime,
        legs: localRouteLegs(nodes),
        candidatesByNodeKey,
    });
    return formatPlan({
        graphPlan: localPlan,
        estimateSource: 'local',
        pickupCandidatesByNodeKey,
        customerCandidatesByNodeKey,
    });
}
