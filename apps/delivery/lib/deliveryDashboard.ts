import { notifyDeliveryRequestEvent } from '@gredice/notifications';
import {
    abandonDeliveryRun,
    consumeDeliveryRunPreparation,
    DeliveryRequestStates,
    DeliveryRunManifestItemStates,
    DeliveryRunManifestStates,
    DeliveryRunStates,
    DeliveryRunStopOperationKinds,
    DeliveryRunStopStates,
    getActiveDeliveryRunForDriver,
    getActiveDeliveryRunStopsForRequestIds,
    getDeliveryRequest,
    getDeliveryRequestsWithEvents,
    getDeliveryRun,
    getDeliveryRunExecutionProgress,
    getDeliveryRunStopsForRequestIds,
    getUser,
    isDeliveryRunStopActionable,
    isDeliveryRunStopTerminal,
    type RecordDeliveryRunStopExceptionsInput,
    reassignDeliveryRun,
    recordDeliveryRunStopExceptions,
    recordDeliveryRunStopOperation,
    recoverDeliveryRunStop,
    retryDeliveryRunStop,
    updateDeliveryRunEstimates,
    updateDeliveryRunLocation,
} from '@gredice/storage';
import 'server-only';
import type {
    ActiveDeliveryRunSummary,
    DeliveryDashboard,
    DeliveryHarvestSummary,
    DeliveryPickupManifestItemState,
    DeliveryPickupManifestSummary,
    DeliveryPickupStepSummary,
    DeliveryRouteOrderSummary,
    DeliveryRouteStepSummary,
    DeliveryStopDeliverySummary,
    DeliveryStopSummary,
} from './deliveryDashboardTypes';
import {
    customerDeliveryRecoverySummary,
    driverDeliveryExceptionSummary,
} from './deliveryExceptionPresentation';
import {
    configuredDeliveryHqAddress,
    DeliveryRoutePlanningError,
    formatDeliveryDestinationAddress,
    maximumDeliveryRouteStops,
    maximumDeliveryRouteWindowHours,
    recalculateDeliveryRoute,
} from './deliveryRouting';
import {
    DeliveryRunPreparationError,
    deliveryRunPersistencePreparationError,
    prepareDeliveryRun,
    savePreparedDeliveryRun,
} from './deliveryRunPlanning';
import {
    deliveryRerouteLocationIsFresh,
    deliveryRerouteRetryIsDue,
    reconcileDeliveryRunReroute,
} from './deliveryRunRerouting';
import { resolveDeliveryRunStart } from './deliveryRunStart';
import { buildDeliveryStopKey } from './deliveryStopGrouping';
import {
    customerDeliveryTrackingSummary,
    deliveryTrackingRecoveryTransition,
    deliveryTrackingStatus,
    driverDeliveryTrackingLocation,
} from './deliveryTracking';

type ListedDeliveryRequest = Awaited<
    ReturnType<typeof getDeliveryRequestsWithEvents>
>[number];
type DeliveryRequest =
    | ListedDeliveryRequest
    | NonNullable<Awaited<ReturnType<typeof getDeliveryRequest>>>;
export type DeliveryRun = NonNullable<
    Awaited<ReturnType<typeof getDeliveryRun>>
>;
type DeliveryRunStop = DeliveryRun['stops'][number];
type DeliveryRunExecutionStep = Awaited<
    ReturnType<typeof getDeliveryRunExecutionProgress>
>[number];

const driverRoles = new Set(['driver', 'admin']);
const batchStates: ReadonlySet<string> = new Set([
    DeliveryRequestStates.CONFIRMED,
    DeliveryRequestStates.PREPARING,
    DeliveryRequestStates.READY,
]);
const terminalDeliveryRequestStates: ReadonlySet<string> = new Set([
    DeliveryRequestStates.FULFILLED,
    DeliveryRequestStates.FAILED,
    DeliveryRequestStates.CANCELLED,
]);
const etaRefreshIntervalMs = 2 * 60 * 1000;

function iso(value?: Date | null) {
    return value?.toISOString() ?? null;
}

function plantName(request: DeliveryRequest) {
    return (
        request.plantSort?.information?.name ??
        request.plantSort?.information?.plant?.information?.name ??
        request.operationData?.information?.label ??
        'Urod'
    );
}

export function visibleDeliveryNotes(
    audience: 'driver' | 'customer',
    notes: string | null | undefined,
) {
    return audience === 'driver' ? (notes ?? null) : null;
}

function raisedBedName(request: DeliveryRequest) {
    const physicalId = request.raisedBed?.physicalId;
    return physicalId ? `Gredica ${physicalId}` : null;
}

function fieldName(request: DeliveryRequest) {
    const positionIndex = request.raisedBedField?.positionIndex;
    return typeof positionIndex === 'number'
        ? `Polje ${positionIndex + 1}`
        : null;
}

function harvestSummary(request: DeliveryRequest): DeliveryHarvestSummary {
    return {
        plantName: plantName(request),
        operationName: request.operationData?.information?.label ?? null,
        raisedBedName: raisedBedName(request),
        fieldName: fieldName(request),
        tracePath: request.trace?.publicPath ?? null,
    };
}

function deliveryRequestStopKey(request: DeliveryRequest) {
    if (!request.slot || !request.address) {
        return `request:${request.id}`;
    }

    return buildDeliveryStopKey(
        request.slot.id,
        formatDeliveryDestinationAddress(request.address),
    );
}

export type ResolvedDeliveryRunStop = {
    stop: DeliveryRunStop;
    request: DeliveryRequest | undefined;
    stopKey: string;
};

export type ResolvedDeliveryRunStopGroup = {
    executionKey: string;
    stopKey: string;
    items: ResolvedDeliveryRunStop[];
};

export async function resolveDeliveryRunStopGroups(
    run: DeliveryRun,
): Promise<ResolvedDeliveryRunStopGroup[]> {
    const requests = await Promise.all(
        run.stops.map((stop) => getDeliveryRequest(stop.deliveryRequestId)),
    );

    const items = run.stops.map((stop, index) => {
        const request = requests[index];
        return {
            stop,
            request,
            stopKey:
                stop.stopKey ??
                buildDeliveryStopKey(run.timeSlotId, stop.formattedAddress),
        };
    });
    const groups = new Map<string, ResolvedDeliveryRunStop[]>();
    for (const item of items) {
        const executionLane =
            item.stop.retryLaneRank === null
                ? `route:${item.stop.itinerarySequence ?? 'legacy'}`
                : `retry:${item.stop.retryLaneRank}`;
        const executionKey = `${executionLane}:${item.stopKey}`;
        const group = groups.get(executionKey);
        if (group) group.push(item);
        else groups.set(executionKey, [item]);
    }
    return Array.from(groups, ([executionKey, groupedItems]) => ({
        executionKey,
        stopKey: groupedItems[0]?.stopKey ?? executionKey,
        items: groupedItems,
    })).sort((first, second) => {
        const firstRetryRank = first.items[0]?.stop.retryLaneRank;
        const secondRetryRank = second.items[0]?.stop.retryLaneRank;
        const firstLane = firstRetryRank === null ? 0 : 1;
        const secondLane = secondRetryRank === null ? 0 : 1;
        const sequence = (group: ResolvedDeliveryRunStopGroup) =>
            Math.min(
                ...group.items.map(
                    ({ stop }) =>
                        stop.retryLaneRank ??
                        stop.itinerarySequence ??
                        stop.sequence,
                ),
            );
        return (
            firstLane - secondLane ||
            sequence(first) - sequence(second) ||
            first.executionKey.localeCompare(second.executionKey)
        );
    });
}

export function deliveryStatusLabel({
    requestState,
    stopState,
    isCurrent,
    runState,
}: {
    requestState: string;
    stopState?: string | null;
    isCurrent: boolean;
    runState?: string | null;
}) {
    if (
        stopState === DeliveryRunStopStates.DELIVERED ||
        (!stopState && requestState === DeliveryRequestStates.FULFILLED)
    ) {
        return 'Dostavljeno';
    }
    if (stopState === DeliveryRunStopStates.ARRIVED) {
        return 'Vozač je stigao';
    }
    if (stopState === DeliveryRunStopStates.DEFERRED) {
        return 'Dostava je odgođena';
    }
    if (stopState === DeliveryRunStopStates.FAILED) {
        return 'Dostava nije uspjela';
    }
    if (stopState === DeliveryRunStopStates.CANCELLED) {
        return 'Dostava je otkazana';
    }
    if (runState === DeliveryRunStates.ACTIVE) {
        return isCurrent ? 'Vozač stiže' : 'U dostavi';
    }

    switch (requestState) {
        case DeliveryRequestStates.PENDING:
            return 'Čeka potvrdu';
        case DeliveryRequestStates.CONFIRMED:
            return 'Dostava potvrđena';
        case DeliveryRequestStates.PREPARING:
            return 'Urod se priprema';
        case DeliveryRequestStates.READY:
            return 'Spremno za dostavu';
        case DeliveryRequestStates.DEFERRED:
            return 'Dostava je odgođena';
        case DeliveryRequestStates.FAILED:
            return 'Dostava nije uspjela';
        case DeliveryRequestStates.CANCELLED:
            return 'Otkazano';
        default:
            return requestState;
    }
}

function pickupStatusLabel(requestState: string) {
    if (requestState === DeliveryRequestStates.READY) {
        return 'Spremno za preuzimanje';
    }
    if (requestState === DeliveryRequestStates.PREPARING) {
        return 'U pripremi na lokaciji preuzimanja';
    }
    return 'Još nije spremno za preuzimanje';
}

type DeliveryRunSnapshot = Pick<
    DeliveryRun,
    | 'id'
    | 'state'
    | 'currentLatitude'
    | 'currentLongitude'
    | 'currentLocationAccuracy'
    | 'currentLocationHeading'
    | 'currentLocationSpeed'
    | 'currentLocationRecordedAt'
    | 'currentLocationReceivedAt'
    | 'rerouteRequiredAt'
>;

export function visibleDeliveryStopEstimates({
    reroutePending,
    estimatedArrivalAt,
    estimatedTravelSeconds,
    estimatedDistanceMeters,
}: {
    reroutePending: boolean;
    estimatedArrivalAt?: Date | null;
    estimatedTravelSeconds?: number | null;
    estimatedDistanceMeters?: number | null;
}) {
    return {
        estimatedArrivalAt: reroutePending ? null : iso(estimatedArrivalAt),
        estimatedTravelSeconds: reroutePending
            ? null
            : (estimatedTravelSeconds ?? null),
        estimatedDistanceMeters: reroutePending
            ? null
            : (estimatedDistanceMeters ?? null),
    };
}

export function visibleDeliveryRunTotals({
    reroutePending,
    totalDistanceMeters,
    totalDurationSeconds,
}: {
    reroutePending: boolean;
    totalDistanceMeters?: number | null;
    totalDurationSeconds?: number | null;
}) {
    return {
        totalDistanceMeters: reroutePending
            ? null
            : (totalDistanceMeters ?? null),
        totalDurationSeconds: reroutePending
            ? null
            : (totalDurationSeconds ?? null),
    };
}

function deliverySummaryItem(
    request: DeliveryRequest,
    stop: DeliveryRunStop | null | undefined,
    audience: 'driver' | 'customer',
): DeliveryStopDeliverySummary {
    const address = request.address;
    return {
        stopId: stop?.id ?? null,
        stopState: stop?.state ?? null,
        requestId: request.id,
        requestState: request.state,
        contactName:
            stop?.deliveryContactName ??
            address?.contactName ??
            'Nepoznat kontakt',
        phone: stop?.deliveryPhone ?? address?.phone ?? null,
        addressLabel: stop?.deliveryAddressLabel ?? address?.label ?? null,
        requestNotes: request.requestNotes ?? null,
        deliveryNotes: visibleDeliveryNotes(audience, request.deliveryNotes),
        harvest: harvestSummary(request),
        exception:
            audience === 'driver' && stop
                ? driverDeliveryExceptionSummary({
                      state: stop.state,
                      reason: stop.exceptionReason,
                      note: stop.exceptionNote,
                      occurredAt: stop.exceptionOccurredAt,
                  })
                : null,
    };
}

function deliveryStopSummary({
    items,
    run,
    isCurrent,
    audience,
    now,
    includeTracking,
    sequence,
    actionState,
    lockedReason,
}: {
    items: { request: DeliveryRequest; stop?: DeliveryRunStop | null }[];
    run?: DeliveryRunSnapshot | null;
    isCurrent: boolean;
    audience: 'driver' | 'customer';
    now: Date;
    includeTracking: boolean;
    sequence?: number | null;
    actionState?: DeliveryStopSummary['actionState'];
    lockedReason?: string | null;
}): DeliveryStopSummary {
    const primary = items[0];
    if (!primary) {
        throw new Error('Dostavna stanica nema nijednu dostavu.');
    }
    const request = primary.request;
    const stops = items.flatMap((item) => (item.stop ? [item.stop] : []));
    const representativeStop =
        stops.find((stop) => isDeliveryRunStopActionable(stop.state)) ??
        stops.find((stop) => !isDeliveryRunStopTerminal(stop.state)) ??
        stops[0];
    const stopState =
        stops.length > 0 &&
        stops.every((stop) => stop.state === DeliveryRunStopStates.DELIVERED)
            ? DeliveryRunStopStates.DELIVERED
            : stops.some((stop) => stop.state === DeliveryRunStopStates.ARRIVED)
              ? DeliveryRunStopStates.ARRIVED
              : stops.some(
                      (stop) => stop.state === DeliveryRunStopStates.PENDING,
                  )
                ? DeliveryRunStopStates.PENDING
                : stops.some(
                        (stop) => stop.state === DeliveryRunStopStates.DEFERRED,
                    )
                  ? DeliveryRunStopStates.DEFERRED
                  : stops.some(
                          (stop) => stop.state === DeliveryRunStopStates.FAILED,
                      )
                    ? DeliveryRunStopStates.FAILED
                    : stops.some(
                            (stop) =>
                                stop.state === DeliveryRunStopStates.CANCELLED,
                        )
                      ? DeliveryRunStopStates.CANCELLED
                      : (representativeStop?.state ?? null);
    const address = request.address;
    const formattedAddress =
        representativeStop?.formattedAddress ??
        (address
            ? formatDeliveryDestinationAddress(address)
            : 'Adresa nije dostupna');
    const runSlot = representativeStop?.runSlot;
    const reroutePending = Boolean(
        run?.state === DeliveryRunStates.ACTIVE && run.rerouteRequiredAt,
    );
    const estimates = visibleDeliveryStopEstimates({
        reroutePending,
        estimatedArrivalAt: representativeStop?.estimatedArrivalAt,
        estimatedTravelSeconds: representativeStop?.estimatedTravelSeconds,
        estimatedDistanceMeters: representativeStop?.estimatedDistanceMeters,
    });

    return {
        id: representativeStop?.id ?? null,
        requestId: request.id,
        sequence: sequence ?? representativeStop?.sequence ?? null,
        stopState,
        requestState: request.state,
        statusLabel: deliveryStatusLabel({
            requestState: request.state,
            stopState,
            isCurrent,
            runState: run?.state,
        }),
        isCurrent,
        contactName:
            representativeStop?.deliveryContactName ??
            address?.contactName ??
            'Nepoznat kontakt',
        phone: representativeStop?.deliveryPhone ?? address?.phone ?? null,
        address: formattedAddress,
        addressLabel:
            representativeStop?.deliveryAddressLabel ?? address?.label ?? null,
        requestNotes: request.requestNotes ?? null,
        deliveryNotes: visibleDeliveryNotes(audience, request.deliveryNotes),
        slotStartAt: iso(runSlot?.windowStartAt ?? request.slot?.startAt),
        slotEndAt: iso(runSlot?.windowEndAt ?? request.slot?.endAt),
        ...estimates,
        reroutePending,
        arrivedAt: iso(stops.find((stop) => stop.arrivedAt)?.arrivedAt),
        deliveredAt: iso(stops.find((stop) => stop.deliveredAt)?.deliveredAt),
        harvest: harvestSummary(request),
        recovery:
            audience === 'customer'
                ? customerDeliveryRecoverySummary({
                      requestState: request.state,
                      stopState,
                      exceptionReason: representativeStop?.exceptionReason,
                      exceptionRecordedAt:
                          request.deliveryException?.recordedAt,
                      hqAddress: configuredDeliveryHqAddress(),
                      now,
                  })
                : null,
        tracking:
            includeTracking && run
                ? customerDeliveryTrackingSummary(run, now)
                : null,
        runId: run?.id ?? null,
        deliveryCount: items.length,
        deliveries: items.map((item) =>
            deliverySummaryItem(item.request, item.stop, audience),
        ),
        ...(actionState
            ? { actionState, lockedReason: lockedReason ?? null }
            : {}),
    };
}

function deliveryManifestItemState(
    state: DeliveryRunStop['pickupItemState'],
    manifestConfirmed: boolean,
): DeliveryPickupManifestItemState {
    switch (state) {
        case DeliveryRunManifestItemStates.READY:
        case DeliveryRunManifestItemStates.SCANNED:
        case DeliveryRunManifestItemStates.MISSING_LABEL:
        case DeliveryRunManifestItemStates.NOT_READY:
            return state;
        default:
            return manifestConfirmed
                ? DeliveryRunManifestItemStates.SCANNED
                : DeliveryRunManifestItemStates.READY;
    }
}

export function pickupManifestTracePath(
    pickupTraceToken: string | null | undefined,
) {
    return pickupTraceToken ? `/trag/${pickupTraceToken}` : null;
}

function pickupManifestSummary({
    run,
    slot,
    requestsById,
}: {
    run: DeliveryRun;
    slot: DeliveryRun['runSlots'][number];
    requestsById: ReadonlyMap<string, DeliveryRequest>;
}): DeliveryPickupManifestSummary {
    const confirmed =
        slot.manifestState === DeliveryRunManifestStates.CONFIRMED;
    const items = run.stops
        .filter((stop) => stop.runSlotId === slot.id)
        .map((stop) => {
            const request = requestsById.get(stop.deliveryRequestId);
            const tracePath = pickupManifestTracePath(stop.pickupTraceToken);
            return {
                id: String(stop.id),
                stopId: stop.id,
                requestId: stop.deliveryRequestId,
                stopKey:
                    stop.stopKey ??
                    (request
                        ? deliveryRequestStopKey(request)
                        : `request:${stop.deliveryRequestId}`),
                state: deliveryManifestItemState(
                    stop.pickupItemState,
                    confirmed,
                ),
                resolvedAt: iso(stop.pickupResolvedAt),
                tracePath,
                harvest: request
                    ? { ...harvestSummary(request), tracePath }
                    : {
                          plantName: 'Urod',
                          operationName: null,
                          raisedBedName: null,
                          fieldName: null,
                          tracePath: null,
                      },
            };
        });
    const scannedCount = items.filter(
        (item) => item.state === DeliveryRunManifestItemStates.SCANNED,
    ).length;
    const missingLabelCount = items.filter(
        (item) => item.state === DeliveryRunManifestItemStates.MISSING_LABEL,
    ).length;
    const notReadyCount = items.filter(
        (item) => item.state === DeliveryRunManifestItemStates.NOT_READY,
    ).length;

    return {
        id: slot.manifestId,
        timeSlotId: slot.timeSlotId,
        startAt: slot.windowStartAt.toISOString(),
        endAt: slot.windowEndAt.toISOString(),
        state: confirmed ? 'confirmed' : 'pending',
        confirmedAt: iso(slot.confirmedAt),
        expectedCount: items.length,
        scannedCount,
        missingLabelCount,
        notReadyCount,
        remainingCount: items.length - scannedCount - missingLabelCount,
        items,
    };
}

function pickupStepSummary({
    run,
    step,
    requestsById,
}: {
    run: DeliveryRun;
    step: Extract<DeliveryRunExecutionStep, { kind: 'pickup' }>;
    requestsById: ReadonlyMap<string, DeliveryRequest>;
}): DeliveryPickupStepSummary | null {
    const pickupNode = run.pickupNodes.find(
        (node) => node.id === step.pickupNodeId,
    );
    if (!pickupNode) return null;

    const manifests = run.runSlots
        .filter((slot) => slot.pickupNodeId === pickupNode.id)
        .map((slot) => pickupManifestSummary({ run, slot, requestsById }));
    const scannedCount = manifests.reduce(
        (count, manifest) => count + manifest.scannedCount,
        0,
    );
    const missingLabelCount = manifests.reduce(
        (count, manifest) => count + manifest.missingLabelCount,
        0,
    );
    const notReadyCount = manifests.reduce(
        (count, manifest) => count + manifest.notReadyCount,
        0,
    );
    const remainingCount = manifests.reduce(
        (count, manifest) => count + manifest.remainingCount,
        0,
    );
    const allConfirmed =
        manifests.length > 0 &&
        manifests.every((manifest) => manifest.state === 'confirmed');
    const hasProgress =
        scannedCount > 0 || missingLabelCount > 0 || notReadyCount > 0;
    const estimates = visibleDeliveryStopEstimates({
        reroutePending: run.rerouteRequiredAt !== null,
        estimatedArrivalAt: pickupNode.estimatedArrivalAt,
        estimatedTravelSeconds: pickupNode.incomingTravelSeconds,
        estimatedDistanceMeters: pickupNode.incomingDistanceMeters,
    });

    return {
        id: pickupNode.id,
        pickupLocationId: pickupNode.pickupLocationId,
        sequence: pickupNode.sequence,
        itinerarySequence: step.itinerarySequence,
        name: pickupNode.name,
        address: pickupNode.formattedAddress,
        ...estimates,
        serviceDurationSeconds: pickupNode.serviceDurationSeconds,
        state: allConfirmed ? 'confirmed' : hasProgress ? 'partial' : 'pending',
        isCurrent: step.state === 'current',
        expectedCount: manifests.reduce(
            (count, manifest) => count + manifest.expectedCount,
            0,
        ),
        scannedCount,
        missingLabelCount,
        notReadyCount,
        remainingCount,
        manifests,
    };
}

async function activeRunSummary(
    run: DeliveryRun,
    now: Date,
): Promise<ActiveDeliveryRunSummary> {
    const groups = await resolveDeliveryRunStopGroups(run);
    const requests = groups.flatMap((group) =>
        group.items.flatMap((item) => (item.request ? [item.request] : [])),
    );
    const requestsById = new Map(
        requests.map((request) => [request.id, request]),
    );
    const executionSteps = await getDeliveryRunExecutionProgress(run.id);
    const groupsByStopId = new Map<number, ResolvedDeliveryRunStopGroup>();
    for (const group of groups) {
        for (const { stop } of group.items) {
            groupsByStopId.set(stop.id, group);
        }
    }
    const stops: DeliveryStopSummary[] = [];
    const routeSteps: DeliveryRouteStepSummary[] = [];
    const includedDeliveryGroups = new Set<string>();
    for (const executionStep of executionSteps) {
        if (executionStep.kind === 'pickup') {
            const pickup = pickupStepSummary({
                run,
                step: executionStep,
                requestsById,
            });
            if (!pickup) continue;
            routeSteps.push({
                kind: 'pickup',
                itinerarySequence: executionStep.itinerarySequence,
                actionState:
                    executionStep.state === 'completed'
                        ? 'completed'
                        : executionStep.state === 'current'
                          ? 'current'
                          : 'locked',
                pickup,
            });
            continue;
        }

        const group = executionStep.stopIds.flatMap((stopId) => {
            const candidate = groupsByStopId.get(stopId);
            return candidate ? [candidate] : [];
        })[0];
        if (!group || includedDeliveryGroups.has(group.executionKey)) continue;
        includedDeliveryGroups.add(group.executionKey);

        const groupStopIds = new Set(group.items.map(({ stop }) => stop.id));
        const groupExecutionSteps = executionSteps.filter(
            (
                candidate,
            ): candidate is Extract<
                DeliveryRunExecutionStep,
                { kind: 'delivery' }
            > =>
                candidate.kind === 'delivery' &&
                candidate.stopIds.some((stopId) => groupStopIds.has(stopId)),
        );
        const items = group.items.flatMap(({ request, stop }) =>
            request ? [{ request, stop }] : [],
        );
        if (items.length === 0) continue;
        const complete = group.items.every(({ stop }) =>
            isDeliveryRunStopTerminal(stop.state),
        );
        const dependencySatisfied = groupExecutionSteps.every(
            (candidate) => candidate.pickupConfirmed,
        );
        const current = groupExecutionSteps.some(
            (candidate) => candidate.state === 'current',
        );
        const actionState: NonNullable<DeliveryStopSummary['actionState']> =
            complete
                ? 'completed'
                : !dependencySatisfied
                  ? 'locked'
                  : current
                    ? 'current'
                    : 'upcoming';
        const itinerarySequence = Math.min(
            ...groupExecutionSteps.map(
                (candidate) => candidate.itinerarySequence,
            ),
        );
        const stop = deliveryStopSummary({
            items,
            run,
            isCurrent: actionState === 'current',
            audience: 'driver',
            now,
            includeTracking: false,
            sequence: Number.isFinite(itinerarySequence)
                ? itinerarySequence
                : stops.length + 1,
            actionState,
            lockedReason:
                actionState === 'locked'
                    ? 'Najprije potvrdi preuzimanje svih uroda za ovu stanicu.'
                    : null,
        });
        stops.push(stop);
        routeSteps.push({
            kind: 'delivery',
            itinerarySequence: Number.isFinite(itinerarySequence)
                ? itinerarySequence
                : executionStep.itinerarySequence,
            retryLaneRank: executionStep.retryLaneRank ?? null,
            retryAttempt: executionStep.retryAttempt ?? 0,
            actionState,
            lockedReason: stop.lockedReason ?? null,
            stop,
        });
    }

    const reroutePending = run.rerouteRequiredAt !== null;
    return {
        id: run.id,
        state: run.state,
        startedAt: run.startedAt.toISOString(),
        completedAt: iso(run.completedAt),
        ...visibleDeliveryRunTotals({
            reroutePending,
            totalDistanceMeters: run.totalDistanceMeters,
            totalDurationSeconds: run.totalDurationSeconds,
        }),
        routePlanVersion: run.routePlanVersion,
        routeRevision: run.routeRevision,
        reroutePending,
        estimateSource: run.estimateSource,
        tracking: customerDeliveryTrackingSummary(run, now),
        location: driverDeliveryTrackingLocation(run, now),
        estimatesUpdatedAt: iso(run.estimatesUpdatedAt),
        mapUrl: `/api/map/${run.id}`,
        deliveryCount: stops.reduce(
            (count, stop) => count + stop.deliveryCount,
            0,
        ),
        stops,
        routeSteps,
    };
}

async function driverDashboard({
    userId,
    role,
}: {
    userId: string;
    role: string;
}): Promise<DeliveryDashboard> {
    const [user, initialActiveRun, requests] = await Promise.all([
        getUser(userId),
        getActiveDeliveryRunForDriver(userId),
        getDeliveryRequestsWithEvents(),
    ]);
    if (!user) {
        throw new Error('Korisnik nije pronađen.');
    }
    const projectedAt = new Date();
    let activeRun = initialActiveRun;
    if (
        activeRun?.rerouteRequiredAt &&
        deliveryRerouteLocationIsFresh(activeRun, projectedAt) &&
        deliveryRerouteRetryIsDue(
            activeRun.rerouteRequiredAt,
            activeRun.rerouteAttemptedAt,
            projectedAt,
        )
    ) {
        await reconcileDeliveryRunReroute({
            actorUserId: userId,
            runId: activeRun.id,
            expectedRouteRevision: activeRun.routeRevision,
        });
        activeRun = await getActiveDeliveryRunForDriver(userId);
    }

    const now = projectedAt.getTime();
    const candidateRequests = requests.filter(
        (request) =>
            request.mode === 'delivery' &&
            request.address &&
            request.slot &&
            batchStates.has(request.state) &&
            request.slot.endAt.getTime() >= now &&
            request.slot.startAt.getTime() <= now + 14 * 24 * 60 * 60 * 1000,
    );
    const assigned = await getActiveDeliveryRunStopsForRequestIds(
        candidateRequests.map((request) => request.id),
    );
    const assignedRequestIds = new Set(
        assigned.map(({ stop }) => stop.deliveryRequestId),
    );
    const batchesBySlot = new Map<
        number,
        {
            startAt: Date;
            endAt: Date;
            pickupLocationId: number;
            pickupLocationName: string | null;
            pickupAddress: string | null;
            orders: DeliveryRouteOrderSummary[];
        }
    >();
    for (const request of candidateRequests) {
        if (
            !request.slot ||
            !request.address ||
            assignedRequestIds.has(request.id)
        ) {
            continue;
        }
        const order = {
            requestId: request.id,
            stopKey: deliveryRequestStopKey(request),
            readyForPickup: request.state === DeliveryRequestStates.READY,
            pickupStatusLabel: pickupStatusLabel(request.state),
            contactName: request.address.contactName,
            address: formatDeliveryDestinationAddress(request.address),
            addressLabel: request.address.label,
            requestNotes: request.requestNotes ?? null,
            harvest: harvestSummary(request),
        } satisfies DeliveryRouteOrderSummary;
        const batch = batchesBySlot.get(request.slot.id);
        if (batch) {
            batch.orders.push(order);
        } else {
            const pickupLocation = request.slot.location;
            batchesBySlot.set(request.slot.id, {
                startAt: request.slot.startAt,
                endAt: request.slot.endAt,
                pickupLocationId: request.slot.locationId,
                pickupLocationName: pickupLocation?.name ?? null,
                pickupAddress: pickupLocation
                    ? formatDeliveryDestinationAddress(pickupLocation)
                    : null,
                orders: [order],
            });
        }
    }

    return {
        kind: 'driver',
        user: {
            id: user.id,
            displayName: user.displayName ?? user.userName,
            role,
        },
        activeRun: activeRun
            ? await activeRunSummary(activeRun, projectedAt)
            : null,
        batches: Array.from(batchesBySlot, ([slotId, batch]) => ({
            slotId,
            startAt: batch.startAt.toISOString(),
            endAt: batch.endAt.toISOString(),
            pickupLocationId: batch.pickupLocationId,
            pickupLocationName: batch.pickupLocationName,
            pickupAddress: batch.pickupAddress,
            deliveryCount: batch.orders.length,
            stopCount: new Set(batch.orders.map((order) => order.stopKey)).size,
            orders: batch.orders.sort((first, second) =>
                first.address.localeCompare(second.address, 'hr'),
            ),
        })).sort((first, second) =>
            first.startAt.localeCompare(second.startAt),
        ),
        maximumRouteStops: maximumDeliveryRouteStops,
        maximumRouteWindowHours: maximumDeliveryRouteWindowHours,
        refreshedAt: projectedAt.toISOString(),
    };
}

async function customerDashboard({
    accountId,
    userId,
    role,
}: {
    accountId: string;
    userId: string;
    role: string;
}): Promise<DeliveryDashboard> {
    const [user, requests] = await Promise.all([
        getUser(userId),
        getDeliveryRequestsWithEvents(accountId),
    ]);
    if (!user) {
        throw new Error('Korisnik nije pronađen.');
    }

    const runRows = await getDeliveryRunStopsForRequestIds(
        requests.map((request) => request.id),
    );
    const rowsByRequestId = new Map(
        runRows.map((row) => [row.stop.deliveryRequestId, row]),
    );
    const activeRunIds = Array.from(
        new Set(
            runRows.flatMap(({ run }) =>
                run.state === DeliveryRunStates.ACTIVE ? [run.id] : [],
            ),
        ),
    );
    const activeRuns = await Promise.all(activeRunIds.map(getDeliveryRun));
    const currentStopIdsByRunId = new Map<string, Set<number> | null>();
    for (const run of activeRuns) {
        if (!run) continue;
        const progress = await getDeliveryRunExecutionProgress(run.id);
        const current = progress.find((step) => step.state === 'current');
        if (current?.kind !== 'delivery' || !current.pickupConfirmed) {
            currentStopIdsByRunId.set(run.id, null);
            continue;
        }
        currentStopIdsByRunId.set(
            run.id,
            deliveryTrackingStopIds({
                routePlanVersion: run.routePlanVersion,
                currentStopIds: new Set(current.actionableStopIds),
                groups: await resolveDeliveryRunStopGroups(run),
            }),
        );
    }

    const projectedAt = new Date();
    const deliveries = requests
        .map((request) => {
            const historicalRow = rowsByRequestId.get(request.id);
            const row =
                historicalRow?.stop.releasedAt !== null &&
                !terminalDeliveryRequestStates.has(request.state)
                    ? undefined
                    : historicalRow;
            const isCurrent = row
                ? (currentStopIdsByRunId.get(row.run.id)?.has(row.stop.id) ??
                  false)
                : false;
            return deliveryStopSummary({
                items: [{ request, stop: row?.stop }],
                run: row?.run,
                isCurrent,
                audience: 'customer',
                now: projectedAt,
                includeTracking:
                    row?.run.state === DeliveryRunStates.ACTIVE &&
                    isDeliveryRunStopActionable(row.stop.state) &&
                    isCurrent,
            });
        })
        .sort((first, second) => {
            const firstTime = first.slotStartAt ?? '';
            const secondTime = second.slotStartAt ?? '';
            return secondTime.localeCompare(firstTime);
        });

    return {
        kind: 'customer',
        user: {
            id: user.id,
            displayName: user.displayName ?? user.userName,
            role,
        },
        deliveries,
        refreshedAt: projectedAt.toISOString(),
    };
}

export function expandLegacyCurrentDeliveryStopIds({
    currentStopIds,
    groups,
}: {
    currentStopIds: ReadonlySet<number>;
    groups: ReadonlyArray<{
        items: ReadonlyArray<{ stop: { id?: number } }>;
    }>;
}) {
    const currentGroup = groups.find((group) =>
        group.items.some(
            ({ stop }) => stop.id !== undefined && currentStopIds.has(stop.id),
        ),
    );
    if (!currentGroup) {
        return new Set(currentStopIds);
    }

    return new Set(
        currentGroup.items.flatMap(({ stop }) =>
            stop.id === undefined ? [] : [stop.id],
        ),
    );
}

export function deliveryTrackingStopIds({
    routePlanVersion,
    currentStopIds,
    groups,
}: {
    routePlanVersion: number;
    currentStopIds: ReadonlySet<number>;
    groups: ReadonlyArray<{
        items: ReadonlyArray<{ stop: { id?: number } }>;
    }>;
}) {
    return routePlanVersion < 2
        ? expandLegacyCurrentDeliveryStopIds({ currentStopIds, groups })
        : new Set(currentStopIds);
}

export async function getDeliveryDashboard({
    accountId,
    userId,
    role,
}: {
    accountId: string;
    userId: string;
    role: string;
}) {
    return driverRoles.has(role)
        ? await driverDashboard({ userId, role })
        : await customerDashboard({ accountId, userId, role });
}

export async function startDeliveryRun({
    driverUserId,
    deliveryRequestIds,
    preparationToken,
}: {
    driverUserId: string;
    deliveryRequestIds: string[];
    preparationToken?: string;
}) {
    const consumePreparation = async (token: string) => {
        try {
            return await consumeDeliveryRunPreparation({
                preparationToken: token,
                driverUserId,
                deliveryRequestIds,
            });
        } catch (error) {
            const preparationError =
                deliveryRunPersistencePreparationError(error);
            if (preparationError) throw preparationError;
            throw error;
        }
    };

    return await resolveDeliveryRunStart({
        preparationToken,
        getExistingRun: async () =>
            await getActiveDeliveryRunForDriver(driverUserId),
        createPreparationToken: async () => {
            const preparation = await prepareDeliveryRun({
                driverUserId,
                deliveryRequestIds,
            });
            const savedPreparation = await savePreparedDeliveryRun(preparation);
            return savedPreparation.preparationToken;
        },
        consumePreparation,
    });
}

export async function arriveAtDeliveryStop({
    driverUserId,
    runId,
    stopId,
    expectedRouteRevision,
    clientOperationId,
    occurredAt,
}: {
    driverUserId: string;
    runId: string;
    stopId: number;
    expectedRouteRevision: number;
    clientOperationId: string;
    occurredAt: Date;
}) {
    const recorded = await recordDeliveryRunStopOperation({
        kind: DeliveryRunStopOperationKinds.ARRIVE,
        driverUserId,
        runId,
        targetStopId: stopId,
        expectedRouteRevision,
        clientOperationId,
        occurredAt,
    });
    return {
        clientOperationId: recorded.clientOperationId,
        replayed: recorded.replayed,
        result: recorded.result,
    };
}

export async function deliverDeliveryStop({
    driverUserId,
    runId,
    stopId,
    notes,
    expectedRouteRevision,
    clientOperationId,
    occurredAt,
}: {
    driverUserId: string;
    runId: string;
    stopId: number;
    notes?: string;
    expectedRouteRevision: number;
    clientOperationId: string;
    occurredAt: Date;
}) {
    const recorded = await recordDeliveryRunStopOperation({
        kind: DeliveryRunStopOperationKinds.DELIVER,
        driverUserId,
        runId,
        targetStopId: stopId,
        deliveryNotes: notes,
        expectedRouteRevision,
        clientOperationId,
        occurredAt,
    });
    if (!recorded.replayed) {
        // Receipts suppress replay duplicates; a post-commit crash can still
        // lose this notification until delivery notifications use an outbox.
        await Promise.all(
            recorded.newlyFulfilledRequestIds.map((requestId) =>
                notifyDeliveryRequestEvent(requestId, 'updated', {
                    status: DeliveryRequestStates.FULFILLED,
                    note: notes,
                }),
            ),
        );
    }
    return {
        clientOperationId: recorded.clientOperationId,
        replayed: recorded.replayed,
        result: recorded.result,
    };
}

async function currentDeliveryRunMutationResult({
    runId,
    fallbackRouteRevision,
}: {
    runId: string;
    fallbackRouteRevision: number;
}) {
    const run = await getDeliveryRun(runId);
    return deliveryMutationRouteState(run, fallbackRouteRevision);
}

export function deliveryMutationRouteState(
    run:
        | {
              routeRevision: number;
              rerouteRequiredAt: Date | null;
              state?: string;
          }
        | null
        | undefined,
    fallbackRouteRevision: number,
) {
    return {
        routeRevision: run?.routeRevision ?? fallbackRouteRevision,
        reroutePending: Boolean(run?.rerouteRequiredAt),
        runCompleted: run?.state === DeliveryRunStates.COMPLETED,
    };
}

export function recordedExceptionNeedsReroute({
    currentRouteRevision,
    recordedRouteRevision,
    reroutePending,
}: {
    currentRouteRevision?: number;
    recordedRouteRevision: number;
    reroutePending: boolean;
}) {
    return reroutePending && currentRouteRevision === recordedRouteRevision;
}

export async function recordDriverDeliveryExceptions({
    driverUserId,
    runId,
    clientOperationId,
    expectedRouteRevision,
    occurredAt,
    exceptions,
}: Omit<RecordDeliveryRunStopExceptionsInput, 'driverUserId'> & {
    driverUserId: string;
}) {
    const recorded = await recordDeliveryRunStopExceptions({
        driverUserId,
        runId,
        clientOperationId,
        expectedRouteRevision,
        occurredAt,
        exceptions,
    });
    const runAfterMutation = await getDeliveryRun(runId);
    if (
        recordedExceptionNeedsReroute({
            currentRouteRevision: runAfterMutation?.routeRevision,
            recordedRouteRevision: recorded.result.routeRevision,
            reroutePending: Boolean(runAfterMutation?.rerouteRequiredAt),
        })
    ) {
        await reconcileDeliveryRunReroute({
            actorUserId: driverUserId,
            runId,
            expectedRouteRevision: recorded.result.routeRevision,
            originStopId: exceptions[0]?.stopId,
        });
    }
    return {
        clientOperationId: recorded.clientOperationId,
        replayed: recorded.replayed,
        outcomes: recorded.result.outcomes,
        ...(await currentDeliveryRunMutationResult({
            runId,
            fallbackRouteRevision: recorded.result.routeRevision,
        })),
    };
}

export async function retryDriverDeliveryStop({
    driverUserId,
    runId,
    stopId,
    expectedRouteRevision,
}: {
    driverUserId: string;
    runId: string;
    stopId: number;
    expectedRouteRevision: number;
}) {
    const retried = await retryDeliveryRunStop({
        driverUserId,
        runId,
        stopId,
        expectedRouteRevision,
    });
    await reconcileDeliveryRunReroute({
        actorUserId: driverUserId,
        runId,
        expectedRouteRevision: retried.routeRevision,
    });
    return await currentDeliveryRunMutationResult({
        runId,
        fallbackRouteRevision: retried.routeRevision,
    });
}

export async function reassignAdminDeliveryRun(input: {
    adminUserId: string;
    runId: string;
    newDriverUserId: string;
    expectedRouteRevision: number;
}) {
    return await reassignDeliveryRun(input);
}

export async function recoverAdminDeliveryStop(input: {
    adminUserId: string;
    runId: string;
    stopId: number;
    expectedRouteRevision: number;
}) {
    const recovered = await recoverDeliveryRunStop(input);
    if (recovered.resumedInRun) {
        await reconcileDeliveryRunReroute({
            actorUserId: input.adminUserId,
            runId: input.runId,
            expectedRouteRevision: recovered.routeRevision,
            allowAdmin: true,
        });
    }
    return {
        ...recovered,
        ...(await currentDeliveryRunMutationResult({
            runId: input.runId,
            fallbackRouteRevision: recovered.routeRevision,
        })),
    };
}

export async function abandonAdminDeliveryRun(input: {
    adminUserId: string;
    runId: string;
    expectedRouteRevision: number;
    reason?: string;
}) {
    return await abandonDeliveryRun(input);
}

export async function accountCanTrackDeliveryRun({
    accountId,
    runId,
}: {
    accountId: string;
    runId: string;
}) {
    const run = await getDeliveryRun(runId);
    if (!run || run.state !== DeliveryRunStates.ACTIVE) {
        return false;
    }
    const [groups, progress] = await Promise.all([
        resolveDeliveryRunStopGroups(run),
        getDeliveryRunExecutionProgress(run.id),
    ]);
    const current = progress.find((step) => step.state === 'current');
    const currentDeliveryStopIds =
        current?.kind === 'delivery' && current.pickupConfirmed
            ? deliveryTrackingStopIds({
                  routePlanVersion: run.routePlanVersion,
                  currentStopIds: new Set(current.actionableStopIds),
                  groups,
              })
            : null;
    return accountCanTrackCurrentDeliveryGroup({
        accountId,
        runState: run.state,
        groups,
        currentDeliveryStopIds,
    });
}

export function accountCanTrackCurrentDeliveryGroup({
    accountId,
    runState,
    groups,
    currentDeliveryStopIds,
}: {
    accountId: string;
    runState: string;
    groups: ReadonlyArray<{
        items: ReadonlyArray<{
            stop: { id?: number; state: string };
            request?: { accountId?: string | null };
        }>;
    }>;
    currentDeliveryStopIds?: ReadonlySet<number> | null;
}) {
    if (runState !== DeliveryRunStates.ACTIVE) {
        return false;
    }
    const currentGroup =
        currentDeliveryStopIds === undefined
            ? groups.find((group) =>
                  group.items.some(({ stop }) =>
                      isDeliveryRunStopActionable(stop.state),
                  ),
              )
            : currentDeliveryStopIds === null
              ? undefined
              : groups.find((group) =>
                    group.items.some(
                        ({ stop }) =>
                            stop.id !== undefined &&
                            currentDeliveryStopIds.has(stop.id),
                    ),
                );

    return Boolean(
        currentGroup?.items.some(({ stop, request }) => {
            if (!isDeliveryRunStopActionable(stop.state)) return false;
            if (
                currentDeliveryStopIds !== undefined &&
                (stop.id === undefined || !currentDeliveryStopIds?.has(stop.id))
            ) {
                return false;
            }
            return request?.accountId === accountId;
        }),
    );
}

async function refreshDeliveryRunAfterLocation({
    run,
    previousRun,
    driverUserId,
    runId,
    expectedLocationRecordedAt,
    expectedLocationReceivedAt,
    now,
}: {
    run: DeliveryRun | null;
    previousRun: DeliveryRun | null;
    driverUserId: string;
    runId: string;
    expectedLocationRecordedAt: Date;
    expectedLocationReceivedAt: Date;
    now: Date;
}) {
    if (
        !run ||
        run.driverUserId !== driverUserId ||
        run.currentLocationRecordedAt?.getTime() !==
            expectedLocationRecordedAt.getTime() ||
        run.currentLocationReceivedAt?.getTime() !==
            expectedLocationReceivedAt.getTime()
    ) {
        return;
    }
    const location = driverDeliveryTrackingLocation(run, now);
    if (!location) return;
    if (
        run.rerouteRequiredAt &&
        deliveryRerouteLocationIsFresh(run, now) &&
        (!previousRun ||
            !deliveryRerouteLocationIsFresh(previousRun, now) ||
            deliveryRerouteRetryIsDue(
                run.rerouteRequiredAt,
                run.rerouteAttemptedAt,
                now,
            ))
    ) {
        await reconcileDeliveryRunReroute({
            actorUserId: driverUserId,
            runId,
            expectedRouteRevision: run.routeRevision,
        });
        return;
    }
    const estimatesAreFresh =
        run.estimatesUpdatedAt &&
        now.getTime() - run.estimatesUpdatedAt.getTime() < etaRefreshIntervalMs;
    if (estimatesAreFresh) {
        return;
    }
    // Pickup-aware plans contain interleaved pickup and delivery checkpoints.
    // Rebuilding only the customer portion would corrupt their itinerary.
    if (run.routePlanVersion >= 2) {
        return;
    }

    const groups = await resolveDeliveryRunStopGroups(run);
    const remainingGroups = groups.flatMap((group) => {
        const items = group.items.filter(({ stop }) =>
            isDeliveryRunStopActionable(stop.state),
        );
        return items.length > 0 ? [{ ...group, items }] : [];
    });
    const groupsByRepresentativeId = new Map<
        string,
        (typeof remainingGroups)[number]
    >();
    const routeStops = remainingGroups.flatMap((group) => {
        const representative = group.items.find(({ request }) => request);
        if (!representative) return [];
        groupsByRepresentativeId.set(
            representative.stop.deliveryRequestId,
            group,
        );
        return [
            {
                deliveryRequestId: representative.stop.deliveryRequestId,
                formattedAddress: representative.stop.formattedAddress,
                latitude: representative.stop.latitude,
                longitude: representative.stop.longitude,
                windowStartAt:
                    representative.stop.runSlot?.windowStartAt ??
                    representative.request?.slot?.startAt,
                windowEndAt:
                    representative.stop.runSlot?.windowEndAt ??
                    representative.request?.slot?.endAt,
            },
        ];
    });
    const plan = await recalculateDeliveryRoute({
        origin: {
            latitude: location.latitude,
            longitude: location.longitude,
        },
        stops: routeStops,
    });
    const estimates = plan.stops.flatMap((estimate) => {
        const group = groupsByRepresentativeId.get(estimate.deliveryRequestId);
        return (
            group?.items.map(({ stop }) => ({
                deliveryRequestId: stop.deliveryRequestId,
                estimatedArrivalAt: estimate.estimatedArrivalAt,
                estimatedTravelSeconds: estimate.estimatedTravelSeconds,
                estimatedDistanceMeters: estimate.estimatedDistanceMeters,
            })) ?? []
        );
    });
    await updateDeliveryRunEstimates({
        runId,
        driverUserId,
        expectedRouteRevision: run.routeRevision,
        expectedLocationRecordedAt,
        expectedLocationReceivedAt,
        encodedPolyline: plan.encodedPolyline,
        totalDistanceMeters: plan.totalDistanceMeters,
        totalDurationSeconds: plan.totalDurationSeconds,
        estimates,
    });
}

export async function recordDriverLocation({
    driverUserId,
    runId,
    latitude,
    longitude,
    accuracy,
    heading,
    speed,
    recordedAt,
}: {
    driverUserId: string;
    runId: string;
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
    recordedAt: Date;
}) {
    const previousRun = (await getDeliveryRun(runId)) ?? null;
    const acknowledgement = await updateDeliveryRunLocation({
        runId,
        driverUserId,
        latitude,
        longitude,
        accuracy,
        heading,
        speed,
        recordedAt,
    });
    const processedAt = new Date();
    const acknowledgedRun = (await getDeliveryRun(runId)) ?? null;
    const status = acknowledgedRun
        ? customerDeliveryTrackingSummary(acknowledgedRun, processedAt).status
        : 'unavailable';
    const previousStatus = previousRun
        ? deliveryTrackingStatus(
              {
                  ...previousRun,
                  currentLocationReceivedAt: acknowledgement.previousAcceptedAt,
              },
              processedAt,
          )
        : 'unavailable';

    if (
        !acknowledgement.replayed &&
        deliveryTrackingRecoveryTransition(previousStatus, status)
    ) {
        console.info('Delivery tracking freshness recovered', {
            runId,
            previousStatus,
            newStatus: status,
        });
    }

    try {
        await refreshDeliveryRunAfterLocation({
            run: acknowledgedRun,
            previousRun,
            driverUserId,
            runId,
            expectedLocationRecordedAt: recordedAt,
            expectedLocationReceivedAt: acknowledgement.acceptedAt,
            now: processedAt,
        });
    } catch (error) {
        console.warn('Driver location saved but route refresh failed', {
            runId,
            errorName: error instanceof Error ? error.name : 'Unknown',
        });
    }

    return {
        status,
        acceptedAt: acknowledgement.acceptedAt,
        replayed: acknowledgement.replayed,
    };
}

export function deliveryRunStartErrorMessage(error: unknown) {
    return error instanceof DeliveryRunPreparationError ||
        error instanceof DeliveryRoutePlanningError
        ? error.message
        : null;
}

export function deliveryRunStartErrorLogContext(error: unknown) {
    if (error instanceof DeliveryRoutePlanningError) {
        return {
            errorName: error.name,
            errorCode: error.code,
            deliveryRequestId: error.deliveryRequestId,
        };
    }
    if (error instanceof DeliveryRunPreparationError) {
        return {
            errorName: error.name,
            errorCode: error.code,
            deliveryRequestId: error.conflict.deliveryRequestId,
        };
    }
    return { error };
}
