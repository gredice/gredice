import {
    type CreateDeliveryRunInput,
    DeliveryRequestStates,
    DeliveryRunPersistenceError,
    type DeliveryRunRequestSnapshotInput,
    getActiveDeliveryRunForDriver,
    getDeliveryDispatchRevision,
    getDeliveryRequestsWithEvents,
    getDeliveryRunStopsForRequestIds,
    saveDeliveryRunPreparation,
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
    updatedAt: Date;
    contactName: string;
    phone: string;
    label: string;
    street1: string;
    street2?: string | null;
    postalCode: string;
    city: string;
    countryCode: string;
};

type DeliveryRunPlanningPickupLocation = {
    id: number;
    updatedAt: Date;
    name: string;
    street1: string;
    street2?: string | null;
    postalCode: string;
    city: string;
    countryCode: string;
};

export type DeliveryRunPlanningRequest = {
    id: string;
    routeRevision: number;
    mode?: string;
    state: string;
    address?: DeliveryRunPlanningAddress;
    slot?: {
        id: number;
        locationId: number;
        updatedAt: Date;
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
    getDispatchRevision: () => Promise<number>;
    getAssignedStops: (
        requestIds: string[],
    ) => Promise<readonly AssignedDeliveryRunStop[]>;
    planRoute: typeof planDeliveryRoute;
    now: () => Date;
};

const defaultDependencies: DeliveryRunPlanningDependencies = {
    getActiveRunForDriver: getActiveDeliveryRunForDriver,
    getRequests: getDeliveryRequestsWithEvents,
    getDispatchRevision: getDeliveryDispatchRevision,
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

export function deliveryRunPersistencePreparationError(error: unknown) {
    if (!(error instanceof DeliveryRunPersistenceError)) return null;

    const messages: Record<typeof error.code, string> = {
        'active-run-exists':
            'Već imaš aktivnu rutu. Osvježi prikaz i nastavi postojeću rutu.',
        'delivery-already-assigned':
            'Jedna ili više odabranih dostava već je dodijeljena drugoj ruti. Osvježi popis i odaberi ponovno.',
        'delivery-request-changed':
            'Odabrane dostave promijenile su se tijekom provjere rute. Osvježi popis i pokušaj ponovno.',
        'delivery-source-changed':
            'Adresa ili termin dostave promijenili su se tijekom provjere rute. Osvježi popis i pokušaj ponovno.',
        'invalid-plan':
            'Pripremljena ruta više nije valjana. Osvježi popis i pokušaj ponovno.',
        'preparation-expired':
            'Priprema rute je istekla. Ruta će se ponovno provjeriti.',
        'preparation-not-found':
            'Priprema rute više nije dostupna. Ruta će se ponovno provjeriti.',
        'preparation-owner-mismatch':
            'Priprema rute više nije dostupna. Osvježi popis i pokušaj ponovno.',
        'preparation-selection-mismatch':
            'Odabir dostava ne odgovara pripremljenoj ruti. Osvježi popis i pokušaj ponovno.',
        'preparation-token-invalid':
            'Priprema rute više nije dostupna. Osvježi popis i pokušaj ponovno.',
    };
    const publicCode =
        error.code === 'preparation-owner-mismatch' ||
        error.code === 'preparation-token-invalid'
            ? 'preparation-not-found'
            : error.code;

    return new DeliveryRunPreparationError(messages[error.code], {
        code: publicCode,
        deliveryRequestId: error.deliveryRequestId,
        activeRunId: error.activeRunId,
    });
}

export type DeliveryRunPreflightSummary = DeliveryRouteSelectionSummary & {
    slotCount: number;
    totalDistanceMeters: number;
    totalDurationSeconds: number;
};

export type PreparedDeliveryRun = {
    createRunInput: CreateDeliveryRunInput;
    summary: DeliveryRunPreflightSummary;
    dispatchRevision: number;
    selectionRequestIds: string[];
    requestSnapshots: DeliveryRunRequestSnapshotInput[];
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

function createPickupNodeInputs(
    requests: readonly DeliveryRunPlanningRequest[],
): NonNullable<CreateDeliveryRunInput['pickupNodes']> {
    const firstRequestByLocationId = new Map<
        number,
        DeliveryRunPlanningRequest
    >();
    for (const request of requests) {
        const location = request.slot?.location;
        if (location && !firstRequestByLocationId.has(location.id)) {
            firstRequestByLocationId.set(location.id, request);
        }
    }

    return Array.from(firstRequestByLocationId.values())
        .sort((first, second) => {
            const windowDifference =
                (first.slot?.startAt.getTime() ?? 0) -
                (second.slot?.startAt.getTime() ?? 0);
            return (
                windowDifference ||
                (first.slot?.locationId ?? 0) - (second.slot?.locationId ?? 0)
            );
        })
        .map((request, index) => {
            const location = request.slot?.location;
            if (!location) {
                throw new DeliveryRunPreparationError(
                    'Lokacija preuzimanja odabrane dostave nije dostupna.',
                    requestConflict('pickup-location-missing', request),
                );
            }
            return {
                pickupLocationId: location.id,
                sequence: index + 1,
                name: location.name,
                street1: location.street1,
                street2: location.street2,
                city: location.city,
                postalCode: location.postalCode,
                countryCode: location.countryCode,
                sourceUpdatedAt: location.updatedAt,
            };
        });
}

function createRunSlotInputs(
    requests: readonly DeliveryRunPlanningRequest[],
): NonNullable<CreateDeliveryRunInput['runSlots']> {
    const firstRequestBySlotId = new Map<number, DeliveryRunPlanningRequest>();
    for (const request of requests) {
        const slot = request.slot;
        if (slot && !firstRequestBySlotId.has(slot.id)) {
            firstRequestBySlotId.set(slot.id, request);
        }
    }

    return Array.from(firstRequestBySlotId.values())
        .sort((first, second) => {
            const windowDifference =
                (first.slot?.startAt.getTime() ?? 0) -
                (second.slot?.startAt.getTime() ?? 0);
            return (
                windowDifference ||
                (first.slot?.id ?? 0) - (second.slot?.id ?? 0)
            );
        })
        .map((request, index) => {
            const slot = request.slot;
            if (!slot?.location) {
                throw new DeliveryRunPreparationError(
                    'Termin nema valjanu lokaciju preuzimanja.',
                    requestConflict('pickup-location-missing', request),
                );
            }
            return {
                timeSlotId: slot.id,
                pickupLocationId: slot.locationId,
                sequence: index + 1,
                windowStartAt: slot.startAt,
                windowEndAt: slot.endAt,
                sourceUpdatedAt: slot.updatedAt,
            };
        });
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
        !request.slot.location ||
        !Number.isInteger(request.routeRevision) ||
        request.routeRevision <= 0 ||
        request.state !== DeliveryRequestStates.READY ||
        request.slot.endAt < now
    ) {
        throw new DeliveryRunPreparationError(
            'Jedna ili više odabranih dostava još nije spremna za preuzimanje. Osvježi popis i pokušaj ponovno.',
            requestConflict(
                'delivery-not-ready',
                request ?? { id: requestId, routeRevision: 0, state: '' },
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
            if (!request.address || !request.slot) {
                throw new DeliveryRunPreparationError(
                    'Planirana dostava nema valjanu adresu ili termin.',
                    requestConflict(
                        'delivery-address-or-slot-invalid',
                        request,
                    ),
                );
            }
            storedSequence += 1;
            return {
                deliveryRequestId: request.id,
                timeSlotId: request.slot.id,
                stopKey: stopKey(request),
                requestDispatchEventId: request.routeRevision,
                deliveryAddressId: request.address.id,
                deliveryAddressUpdatedAt: request.address.updatedAt,
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
    const snapshots: DeliveryRunRequestSnapshotInput[] = candidates.flatMap(
        (request) => {
            const candidate = selectionCandidate(request);
            const location = request.slot?.location;
            return request.slot && request.address && location && candidate
                ? [
                      {
                          deliveryRequestId: request.id,
                          requestDispatchEventId: request.routeRevision,
                          state: request.state,
                          stopKey: candidate.stopKey,
                          address: {
                              id: request.address.id,
                              updatedAt: request.address.updatedAt,
                              label: request.address.label,
                              contactName: request.address.contactName,
                              phone: request.address.phone,
                              street1: request.address.street1,
                              street2: request.address.street2,
                              city: request.address.city,
                              postalCode: request.address.postalCode,
                              countryCode: request.address.countryCode,
                          },
                          slot: {
                              id: request.slot.id,
                              updatedAt: request.slot.updatedAt,
                              locationId: request.slot.locationId,
                              startAt: request.slot.startAt,
                              endAt: request.slot.endAt,
                          },
                          pickupLocation: {
                              id: location.id,
                              updatedAt: location.updatedAt,
                              name: location.name,
                              street1: location.street1,
                              street2: location.street2,
                              city: location.city,
                              postalCode: location.postalCode,
                              countryCode: location.countryCode,
                          },
                      },
                  ]
                : [];
        },
    );
    const dispatchRevision = await dependencies.getDispatchRevision();

    return {
        createRunInput: {
            driverUserId,
            timeSlotId: primarySlot.id,
            encodedPolyline: plan.encodedPolyline,
            totalDistanceMeters: plan.totalDistanceMeters,
            totalDurationSeconds: plan.totalDurationSeconds,
            pickupNodes: createPickupNodeInputs(candidates),
            runSlots: createRunSlotInputs(candidates),
            stops: storedStops,
        },
        summary: {
            ...inspection.summary,
            slotCount: inspection.summary.slots.length,
            totalDistanceMeters: plan.totalDistanceMeters,
            totalDurationSeconds: plan.totalDurationSeconds,
        },
        dispatchRevision,
        selectionRequestIds: uniqueRequestIds,
        requestSnapshots: snapshots,
    };
}

export async function savePreparedDeliveryRun(
    preparation: PreparedDeliveryRun,
) {
    try {
        return await saveDeliveryRunPreparation({
            dispatchRevision: preparation.dispatchRevision,
            createRunInput: preparation.createRunInput,
            selectionRequestIds: preparation.selectionRequestIds,
            requestSnapshots: preparation.requestSnapshots,
        });
    } catch (error) {
        const preparationError = deliveryRunPersistencePreparationError(error);
        if (preparationError) throw preparationError;
        throw error;
    }
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
        const request = requestsById.get(snapshot.deliveryRequestId);
        const candidate = request ? selectionCandidate(request) : null;
        const location = request?.slot?.location;
        if (
            request?.mode !== 'delivery' ||
            request.state !== snapshot.state ||
            request.state !== DeliveryRequestStates.READY ||
            request.routeRevision !== snapshot.requestDispatchEventId ||
            !request.address ||
            request.address.id !== snapshot.address.id ||
            request.address.updatedAt.getTime() !==
                snapshot.address.updatedAt.getTime() ||
            !request.slot ||
            request.slot.endAt < now ||
            request.slot.id !== snapshot.slot.id ||
            request.slot.updatedAt.getTime() !==
                snapshot.slot.updatedAt.getTime() ||
            request.slot.locationId !== snapshot.pickupLocation.id ||
            request.slot.startAt.getTime() !==
                snapshot.slot.startAt.getTime() ||
            request.slot.endAt.getTime() !== snapshot.slot.endAt.getTime() ||
            !location ||
            location.updatedAt.getTime() !==
                snapshot.pickupLocation.updatedAt.getTime() ||
            candidate?.stopKey !== snapshot.stopKey
        ) {
            throw new DeliveryRunPreparationError(
                'Odabrane dostave promijenile su se tijekom provjere rute. Osvježi popis i pokušaj ponovno.',
                requestConflict(
                    'delivery-selection-changed',
                    request ?? {
                        id: snapshot.deliveryRequestId,
                        routeRevision: 0,
                        state: '',
                    },
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
        (snapshot) => snapshot.deliveryRequestId,
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
