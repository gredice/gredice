import {
    DeliveryRequestStates,
    getActiveDeliveryRunForDriver,
    getDeliveryRequestsWithEvents,
    getDeliveryRunStopsForRequestIds,
} from '@gredice/storage';
import 'server-only';
import type {
    DeliveryRouteSelectionCandidate,
    DeliveryRouteSelectionConflict,
    DeliveryRouteSelectionSummary,
} from './deliveryRouteSelection';
import { inspectDeliveryRouteSelection } from './deliveryRouteSelection';
import {
    DeliveryRoutePlanningError,
    formatDeliveryDestinationAddress,
    formatDeliveryGeocodingAddress,
    maximumDeliveryRouteStops,
    maximumDeliveryRouteWindowHours,
    planDeliveryRoute,
} from './deliveryRouting';
import {
    buildDeliveryStopKey,
    groupByDeliveryStop,
} from './deliveryStopGrouping';

type DeliveryRunPlanningAddress = {
    id: number;
    street1: string;
    street2?: string | null;
    postalCode: string;
    city: string;
    countryCode: string;
};

type DeliveryRunPlanningPickupLocation = {
    id: number;
    name: string;
    street1: string;
    street2?: string | null;
    postalCode: string;
    city: string;
    countryCode: string;
};

export type DeliveryRunPlanningRequest = {
    id: string;
    mode?: string;
    state: string;
    address?: DeliveryRunPlanningAddress;
    slot?: {
        id: number;
        locationId: number;
        startAt: Date;
        endAt: Date;
        location?: DeliveryRunPlanningPickupLocation | null;
    };
};

type AssignedDeliveryRunStop = {
    stop: {
        deliveryRequestId: string;
    };
};

export type DeliveryRunPlanningDependencies = {
    getActiveRunForDriver: (
        driverUserId: string,
    ) => Promise<{ id: string } | undefined>;
    getRequests: () => Promise<readonly DeliveryRunPlanningRequest[]>;
    getAssignedStops: (
        requestIds: string[],
    ) => Promise<readonly AssignedDeliveryRunStop[]>;
    planRoute: typeof planDeliveryRoute;
    now: () => Date;
};

const defaultDependencies: DeliveryRunPlanningDependencies = {
    getActiveRunForDriver: getActiveDeliveryRunForDriver,
    getRequests: getDeliveryRequestsWithEvents,
    getAssignedStops: getDeliveryRunStopsForRequestIds,
    planRoute: planDeliveryRoute,
    now: () => new Date(),
};

export type DeliveryRunPreparationConflict = {
    code: string;
    deliveryRequestId?: string;
    activeRunId?: string;
    stopKey?: string;
    deliveryAddress?: string;
    slot?: {
        id: number;
        startAt: string;
        endAt: string;
    };
    pickupLocation?: {
        id: number;
        name: string | null;
        address: string | null;
    };
    selection?: DeliveryRouteSelectionConflict;
};

export class DeliveryRunPreparationError extends Error {
    override name = 'DeliveryRunPreparationError';

    constructor(
        message: string,
        readonly conflict: DeliveryRunPreparationConflict,
    ) {
        super(message);
    }

    get code() {
        return this.conflict.code;
    }
}

export type DeliveryRunRequestSnapshot = {
    requestId: string;
    state: string;
    stopKey: string;
    addressId: number;
    slotId: number;
    pickupLocationId: number;
    slotStartAt: string;
    slotEndAt: string;
};

export type PreparedDeliveryRunStop = {
    deliveryRequestId: string;
    sequence: number;
    latitude: number;
    longitude: number;
    formattedAddress: string;
    estimatedArrivalAt: Date;
    estimatedTravelSeconds: number;
    estimatedDistanceMeters: number;
};

export type DeliveryRunPreflightSummary = DeliveryRouteSelectionSummary & {
    slotCount: number;
    totalDistanceMeters: number;
    totalDurationSeconds: number;
};

export type PreparedDeliveryRun = {
    createRunInput: {
        driverUserId: string;
        timeSlotId: number;
        encodedPolyline?: string;
        totalDistanceMeters: number;
        totalDurationSeconds: number;
        stops: PreparedDeliveryRunStop[];
    };
    summary: DeliveryRunPreflightSummary;
    requestSnapshots: DeliveryRunRequestSnapshot[];
};

function sameRequestIds(first: readonly string[], second: readonly string[]) {
    if (first.length !== second.length) return false;
    const secondIds = new Set(second);
    return first.every((requestId) => secondIds.has(requestId));
}

function stopKey(request: DeliveryRunPlanningRequest) {
    if (!request.slot || !request.address) {
        return `request:${request.id}`;
    }
    return buildDeliveryStopKey(
        request.slot.id,
        formatDeliveryDestinationAddress(request.address),
    );
}

function pickupAddress(
    location: DeliveryRunPlanningPickupLocation | null | undefined,
) {
    return location ? formatDeliveryDestinationAddress(location) : null;
}

function selectionCandidate(
    request: DeliveryRunPlanningRequest,
): DeliveryRouteSelectionCandidate | null {
    if (!request.slot || !request.address) return null;

    return {
        requestId: request.id,
        stopKey: stopKey(request),
        readyForPickup: request.state === DeliveryRequestStates.READY,
        pickupLocationId: request.slot.locationId,
        pickupLocationName: request.slot.location?.name ?? null,
        pickupAddress: pickupAddress(request.slot.location),
        slotId: request.slot.id,
        slotStartAt: request.slot.startAt.toISOString(),
        slotEndAt: request.slot.endAt.toISOString(),
        deliveryAddress: formatDeliveryDestinationAddress(request.address),
    };
}

function requestConflict(
    code: string,
    request: DeliveryRunPlanningRequest | undefined,
): DeliveryRunPreparationConflict {
    const candidate = request ? selectionCandidate(request) : null;
    return {
        code,
        deliveryRequestId: request?.id,
        stopKey: candidate?.stopKey,
        deliveryAddress: candidate?.deliveryAddress,
        slot: request?.slot
            ? {
                  id: request.slot.id,
                  startAt: request.slot.startAt.toISOString(),
                  endAt: request.slot.endAt.toISOString(),
              }
            : undefined,
        pickupLocation: request?.slot
            ? {
                  id: request.slot.locationId,
                  name: request.slot.location?.name ?? null,
                  address: pickupAddress(request.slot.location),
              }
            : undefined,
    };
}

function selectionPreparationError(
    conflict: DeliveryRouteSelectionConflict,
    requestsById: ReadonlyMap<string, DeliveryRunPlanningRequest>,
) {
    const conflictingRequestId = conflict.conflictingRequestIds[0];
    const request = conflictingRequestId
        ? requestsById.get(conflictingRequestId)
        : undefined;
    return new DeliveryRunPreparationError(conflict.message, {
        ...requestConflict(conflict.code, request),
        selection: conflict,
    });
}

function routePreparationError(
    error: DeliveryRoutePlanningError,
    requestsById: ReadonlyMap<string, DeliveryRunPlanningRequest>,
) {
    const request = error.deliveryRequestId
        ? requestsById.get(error.deliveryRequestId)
        : undefined;
    return new DeliveryRunPreparationError(
        error.message,
        requestConflict(error.code, request),
    );
}

function assertSelectedRequest(
    requestId: string,
    request: DeliveryRunPlanningRequest | undefined,
    now: Date,
) {
    if (
        request?.mode !== 'delivery' ||
        !request.address ||
        !request.slot ||
        request.state !== DeliveryRequestStates.READY ||
        request.slot.endAt < now
    ) {
        throw new DeliveryRunPreparationError(
            'Jedna ili više odabranih dostava još nije spremna za preuzimanje. Osvježi popis i pokušaj ponovno.',
            requestConflict(
                'delivery-not-ready',
                request ?? { id: requestId, state: '' },
            ),
        );
    }
}

export async function prepareDeliveryRun(
    {
        driverUserId,
        deliveryRequestIds,
    }: {
        driverUserId: string;
        deliveryRequestIds: string[];
    },
    dependencies: DeliveryRunPlanningDependencies = defaultDependencies,
): Promise<PreparedDeliveryRun> {
    const existingRun = await dependencies.getActiveRunForDriver(driverUserId);
    if (existingRun) {
        throw new DeliveryRunPreparationError(
            'Već imaš aktivnu rutu. Osvježi prikaz i nastavi postojeću rutu.',
            {
                code: 'active-run-exists',
                activeRunId: existingRun.id,
            },
        );
    }

    const uniqueRequestIds = Array.from(new Set(deliveryRequestIds));
    if (
        uniqueRequestIds.length === 0 ||
        uniqueRequestIds.length !== deliveryRequestIds.length
    ) {
        throw new DeliveryRunPreparationError(
            'Odaberi barem jednu valjanu dostavu.',
            { code: 'invalid-selection' },
        );
    }

    const requests = await dependencies.getRequests();
    const requestsById = new Map(
        requests.map((request) => [request.id, request]),
    );
    const now = dependencies.now();
    const selectedStopKeys = new Set<string>();
    for (const requestId of uniqueRequestIds) {
        const request = requestsById.get(requestId);
        assertSelectedRequest(requestId, request, now);
        if (request) selectedStopKeys.add(stopKey(request));
    }

    const candidates = requests.filter(
        (request) =>
            request.mode === 'delivery' &&
            request.address &&
            request.slot &&
            request.state === DeliveryRequestStates.READY &&
            request.slot.endAt >= now &&
            selectedStopKeys.has(stopKey(request)),
    );
    const normalizedCandidates = candidates.flatMap((request) => {
        const candidate = selectionCandidate(request);
        return candidate ? [candidate] : [];
    });
    const inspection = inspectDeliveryRouteSelection({
        candidates: normalizedCandidates,
        requestIds: normalizedCandidates.map(
            (candidate) => candidate.requestId,
        ),
        maximumRouteStops: maximumDeliveryRouteStops,
        maximumRouteWindowHours: maximumDeliveryRouteWindowHours,
    });
    if (inspection.conflict) {
        throw selectionPreparationError(inspection.conflict, requestsById);
    }

    const existingStops = await dependencies.getAssignedStops(
        normalizedCandidates.map((candidate) => candidate.requestId),
    );
    if (existingStops.length > 0) {
        const assignedRequestId = existingStops[0]?.stop.deliveryRequestId;
        throw new DeliveryRunPreparationError(
            'Jedna ili više odabranih dostava već je dodijeljena drugoj ruti. Osvježi popis i odaberi ponovno.',
            requestConflict(
                'delivery-already-assigned',
                assignedRequestId
                    ? requestsById.get(assignedRequestId)
                    : undefined,
            ),
        );
    }

    const candidateGroups = groupByDeliveryStop(
        candidates.map((request) => ({ request, stopKey: stopKey(request) })),
    );
    const groupsByRepresentativeId = new Map<
        string,
        (typeof candidateGroups)[number]
    >();
    let plan: Awaited<ReturnType<typeof planDeliveryRoute>>;
    try {
        plan = await dependencies.planRoute({
            candidates: candidateGroups.map((group) => {
                const representative = group.items[0]?.request;
                if (!representative?.address || !representative.slot) {
                    throw new DeliveryRunPreparationError(
                        'Odabrana dostava nema valjanu adresu ili termin.',
                        requestConflict(
                            'delivery-address-or-slot-invalid',
                            representative,
                        ),
                    );
                }
                groupsByRepresentativeId.set(representative.id, group);
                return {
                    deliveryRequestId: representative.id,
                    formattedAddress: formatDeliveryDestinationAddress(
                        representative.address,
                    ),
                    geocodingAddress: formatDeliveryGeocodingAddress(
                        representative.address,
                    ),
                    windowStartAt: representative.slot.startAt,
                    windowEndAt: representative.slot.endAt,
                };
            }),
            departureTime: now,
        });
    } catch (error) {
        if (error instanceof DeliveryRoutePlanningError) {
            throw routePreparationError(error, requestsById);
        }
        throw error;
    }

    const primarySlot = candidates
        .flatMap((request) => (request.slot ? [request.slot] : []))
        .sort(
            (first, second) =>
                first.startAt.getTime() - second.startAt.getTime(),
        )[0];
    if (!primarySlot) {
        throw new DeliveryRunPreparationError(
            'Odabrane dostave nemaju valjani termin.',
            { code: 'delivery-slot-invalid' },
        );
    }

    let storedSequence = 0;
    const storedStops = plan.stops.flatMap((plannedStop) => {
        const group = groupsByRepresentativeId.get(
            plannedStop.deliveryRequestId,
        );
        if (!group) {
            throw new DeliveryRunPreparationError(
                'Planirana dostavna stanica nije pronađena.',
                {
                    code: 'planned-stop-not-found',
                    deliveryRequestId: plannedStop.deliveryRequestId,
                },
            );
        }

        return group.items.map(({ request }) => {
            storedSequence += 1;
            return {
                deliveryRequestId: request.id,
                sequence: storedSequence,
                latitude: plannedStop.latitude,
                longitude: plannedStop.longitude,
                formattedAddress: plannedStop.formattedAddress,
                estimatedArrivalAt: plannedStop.estimatedArrivalAt,
                estimatedTravelSeconds: plannedStop.estimatedTravelSeconds,
                estimatedDistanceMeters: plannedStop.estimatedDistanceMeters,
            };
        });
    });
    const snapshots = candidates.flatMap((request) => {
        const candidate = selectionCandidate(request);
        return request.slot && request.address && candidate
            ? [
                  {
                      requestId: request.id,
                      state: request.state,
                      stopKey: candidate.stopKey,
                      addressId: request.address.id,
                      slotId: request.slot.id,
                      pickupLocationId: request.slot.locationId,
                      slotStartAt: request.slot.startAt.toISOString(),
                      slotEndAt: request.slot.endAt.toISOString(),
                  },
              ]
            : [];
    });

    return {
        createRunInput: {
            driverUserId,
            timeSlotId: primarySlot.id,
            encodedPolyline: plan.encodedPolyline,
            totalDistanceMeters: plan.totalDistanceMeters,
            totalDurationSeconds: plan.totalDurationSeconds,
            stops: storedStops,
        },
        summary: {
            ...inspection.summary,
            slotCount: inspection.summary.slots.length,
            totalDistanceMeters: plan.totalDistanceMeters,
            totalDurationSeconds: plan.totalDurationSeconds,
        },
        requestSnapshots: snapshots,
    };
}

export async function revalidatePreparedDeliveryRun(
    preparation: PreparedDeliveryRun,
    dependencies: DeliveryRunPlanningDependencies = defaultDependencies,
) {
    const existingRun = await dependencies.getActiveRunForDriver(
        preparation.createRunInput.driverUserId,
    );
    if (existingRun) {
        throw new DeliveryRunPreparationError(
            'Već imaš aktivnu rutu. Osvježi prikaz i nastavi postojeću rutu.',
            {
                code: 'active-run-exists',
                activeRunId: existingRun.id,
            },
        );
    }

    const requests = await dependencies.getRequests();
    const requestsById = new Map(
        requests.map((request) => [request.id, request]),
    );
    const now = dependencies.now();
    const selectedStopKeys = new Set(
        preparation.requestSnapshots.map((snapshot) => snapshot.stopKey),
    );

    for (const snapshot of preparation.requestSnapshots) {
        const request = requestsById.get(snapshot.requestId);
        const candidate = request ? selectionCandidate(request) : null;
        if (
            request?.mode !== 'delivery' ||
            request.state !== snapshot.state ||
            request.state !== DeliveryRequestStates.READY ||
            !request.address ||
            request.address.id !== snapshot.addressId ||
            !request.slot ||
            request.slot.endAt < now ||
            request.slot.id !== snapshot.slotId ||
            request.slot.locationId !== snapshot.pickupLocationId ||
            request.slot.startAt.toISOString() !== snapshot.slotStartAt ||
            request.slot.endAt.toISOString() !== snapshot.slotEndAt ||
            candidate?.stopKey !== snapshot.stopKey
        ) {
            throw new DeliveryRunPreparationError(
                'Odabrane dostave promijenile su se tijekom provjere rute. Osvježi popis i pokušaj ponovno.',
                requestConflict(
                    'delivery-selection-changed',
                    request ?? { id: snapshot.requestId, state: '' },
                ),
            );
        }
    }

    const currentBulkRequestIds = requests.flatMap((request) => {
        if (
            request.mode !== 'delivery' ||
            request.state !== DeliveryRequestStates.READY ||
            !request.address ||
            !request.slot ||
            request.slot.endAt < now ||
            !selectedStopKeys.has(stopKey(request))
        ) {
            return [];
        }
        return [request.id];
    });
    const snapshotRequestIds = preparation.requestSnapshots.map(
        (snapshot) => snapshot.requestId,
    );
    if (!sameRequestIds(currentBulkRequestIds, snapshotRequestIds)) {
        const changedRequestId =
            currentBulkRequestIds.find(
                (requestId) => !snapshotRequestIds.includes(requestId),
            ) ??
            snapshotRequestIds.find(
                (requestId) => !currentBulkRequestIds.includes(requestId),
            );
        throw new DeliveryRunPreparationError(
            'Skupna stanica promijenila se tijekom provjere rute. Osvježi popis kako nijedan spreman urod ne bi ostao iza.',
            requestConflict(
                'delivery-bulk-selection-changed',
                changedRequestId
                    ? requestsById.get(changedRequestId)
                    : undefined,
            ),
        );
    }

    const assignedStops =
        await dependencies.getAssignedStops(snapshotRequestIds);
    if (assignedStops.length > 0) {
        const assignedRequestId = assignedStops[0]?.stop.deliveryRequestId;
        throw new DeliveryRunPreparationError(
            'Jedna ili više odabranih dostava već je dodijeljena drugoj ruti. Osvježi popis i odaberi ponovno.',
            requestConflict(
                'delivery-already-assigned',
                assignedRequestId
                    ? requestsById.get(assignedRequestId)
                    : undefined,
            ),
        );
    }
}
