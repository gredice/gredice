import {
    applyDeliveryRunReroute,
    claimDeliveryRunReroute,
    DeliveryRunExecutionError,
    type DeliveryRunExecutionErrorCode,
    DeliveryRunExecutionErrorCodes,
    DeliveryRunManifestStates,
    DeliveryRunStates,
    DeliveryRunStopStates,
    deliveryRunRerouteLeaseMs,
    getDeliveryRun,
    getDeliveryRunExecutionProgress,
    isDeliveryRunStopTerminal,
} from '@gredice/storage';
import 'server-only';
import {
    deliveryRerouteOriginNodeKey,
    type RemainingDeliveryRouteNode,
    recalculatePickupAwareDeliveryRoute,
} from './deliveryPickupRouting';
import { deliveryNodeServiceSeconds } from './deliveryRouteGraph';

type DeliveryRun = NonNullable<Awaited<ReturnType<typeof getDeliveryRun>>>;
type DeliveryRunProgress = Awaited<
    ReturnType<typeof getDeliveryRunExecutionProgress>
>;

export const deliveryRerouteRetryIntervalMs = deliveryRunRerouteLeaseMs;

export function deliveryRerouteRetryIsDue(
    rerouteRequiredAt: Date | null,
    rerouteAttemptedAt: Date | null,
    now = new Date(),
) {
    return Boolean(
        rerouteRequiredAt &&
            (!rerouteAttemptedAt ||
                now.getTime() - rerouteAttemptedAt.getTime() >=
                    deliveryRerouteRetryIntervalMs),
    );
}

type DeliveryRerouteLocation = {
    currentLatitude: number | null;
    currentLongitude: number | null;
    currentLocationReceivedAt: Date | null;
    rerouteRequiredAt: Date | null;
};

export function deliveryRerouteLocationIsFresh(
    location: DeliveryRerouteLocation,
): location is DeliveryRerouteLocation & {
    currentLatitude: number;
    currentLongitude: number;
    currentLocationReceivedAt: Date;
    rerouteRequiredAt: Date;
} {
    return Boolean(
        location.currentLatitude !== null &&
            location.currentLongitude !== null &&
            location.currentLocationReceivedAt &&
            location.rerouteRequiredAt &&
            location.currentLocationReceivedAt.getTime() >=
                location.rerouteRequiredAt.getTime(),
    );
}

export function deliveryRunHasActiveArrivedStop(
    stops: readonly { state: string; releasedAt: Date | null }[],
) {
    return stops.some(
        (stop) =>
            stop.state === DeliveryRunStopStates.ARRIVED &&
            stop.releasedAt === null,
    );
}

function rerouteError(
    code: DeliveryRunExecutionErrorCode,
    message: string,
): never {
    throw new DeliveryRunExecutionError(code, message);
}

function deliveryNodeKey({
    stopKey,
    stopId,
    retryLaneRank,
}: {
    stopKey: string | null;
    stopId: number;
    retryLaneRank?: number;
}) {
    const physicalKey = stopKey ?? `stop:${stopId}`;
    return retryLaneRank === undefined
        ? `delivery:${physicalKey}`
        : `retry:${retryLaneRank}:${physicalKey}`;
}

function pickupNodeKey(pickupNodeId: string) {
    return `pickup:${pickupNodeId}`;
}

function rerouteOrigin({
    run,
    originStopId,
}: {
    run: DeliveryRun;
    originStopId?: number;
}) {
    const explicitStop = originStopId
        ? run.stops.find((stop) => stop.id === originStopId)
        : undefined;
    if (explicitStop) {
        return {
            latitude: explicitStop.latitude,
            longitude: explicitStop.longitude,
        };
    }
    if (deliveryRerouteLocationIsFresh(run)) {
        return {
            latitude: run.currentLatitude,
            longitude: run.currentLongitude,
        };
    }
    rerouteError(
        DeliveryRunExecutionErrorCodes.RUN_MUTATION_INVALID,
        'Delivery reroute is waiting for a current driver location',
    );
}

function remainingRouteNodes({
    run,
    progress,
}: {
    run: DeliveryRun;
    progress: DeliveryRunProgress;
}) {
    const pickupNodesById = new Map(
        run.pickupNodes.map((node) => [node.id, node]),
    );
    const remainingPickupIds = new Set(
        progress.flatMap((step) =>
            step.kind === 'pickup' && step.state !== 'completed'
                ? [step.pickupNodeId]
                : [],
        ),
    );
    const nodes: RemainingDeliveryRouteNode[] = [];
    for (const pickupNodeId of remainingPickupIds) {
        const pickup = pickupNodesById.get(pickupNodeId);
        if (
            !pickup ||
            pickup.latitude === null ||
            pickup.longitude === null ||
            pickup.serviceDurationSeconds === null
        ) {
            rerouteError(
                DeliveryRunExecutionErrorCodes.RUN_MUTATION_INVALID,
                'Delivery pickup checkpoint cannot be rerouted',
            );
        }
        nodes.push({
            kind: 'pickup',
            nodeKey: pickupNodeKey(pickup.id),
            formattedAddress: pickup.formattedAddress,
            latitude: pickup.latitude,
            longitude: pickup.longitude,
            serviceDurationSeconds: pickup.serviceDurationSeconds,
        });
    }

    const stopIdsByNodeKey = new Map<string, number[]>();
    for (const step of progress) {
        if (step.kind !== 'delivery' || step.state === 'completed') continue;
        const stops = run.stops.filter(
            (stop) =>
                step.stopIds.includes(stop.id) &&
                !isDeliveryRunStopTerminal(stop.state),
        );
        const representative = stops[0];
        if (!representative) continue;
        const nodeKey = deliveryNodeKey({
            stopKey: step.stopKey,
            stopId: representative.id,
            retryLaneRank: step.retryLaneRank,
        });
        const runSlot = representative.runSlot;
        const legacyWindow =
            run.routePlanVersion < 2 ? run.timeSlot : undefined;
        const dependencySatisfied =
            run.routePlanVersion < 2 ||
            runSlot?.manifestState === DeliveryRunManifestStates.CONFIRMED;
        const requiredPickupKey = dependencySatisfied
            ? deliveryRerouteOriginNodeKey
            : runSlot?.pickupNodeId
              ? pickupNodeKey(runSlot.pickupNodeId)
              : null;
        if (!requiredPickupKey) {
            rerouteError(
                DeliveryRunExecutionErrorCodes.PICKUP_DEPENDENCY_PENDING,
                'Delivery pickup dependency cannot be rerouted',
            );
        }
        nodes.push({
            kind: 'customer',
            nodeKey,
            formattedAddress: representative.formattedAddress,
            deliveryRequestId: representative.deliveryRequestId,
            requiredPickupKey,
            latitude: representative.latitude,
            longitude: representative.longitude,
            serviceDurationSeconds:
                representative.serviceDurationSeconds ??
                deliveryNodeServiceSeconds,
            ...((runSlot?.windowStartAt ?? legacyWindow?.startAt)
                ? {
                      windowStartAt:
                          runSlot?.windowStartAt ?? legacyWindow?.startAt,
                  }
                : {}),
            ...((runSlot?.windowEndAt ?? legacyWindow?.endAt)
                ? {
                      windowEndAt: runSlot?.windowEndAt ?? legacyWindow?.endAt,
                  }
                : {}),
            ...(step.retryLaneRank !== undefined
                ? { retryLaneRank: step.retryLaneRank }
                : {}),
        });
        stopIdsByNodeKey.set(
            nodeKey,
            stops.map((stop) => stop.id),
        );
    }
    return { nodes, stopIdsByNodeKey };
}

export async function rerouteDeliveryRun({
    actorUserId,
    runId,
    expectedRouteRevision,
    allowAdmin = false,
    originStopId,
    departureTime = new Date(),
}: {
    actorUserId: string;
    runId: string;
    expectedRouteRevision: number;
    allowAdmin?: boolean;
    originStopId?: number;
    departureTime?: Date;
}) {
    const run = await getDeliveryRun(runId);
    if (
        !run ||
        run.state !== DeliveryRunStates.ACTIVE ||
        (!allowAdmin && run.driverUserId !== actorUserId)
    ) {
        rerouteError(
            DeliveryRunExecutionErrorCodes.ACTIVE_RUN_NOT_FOUND,
            'Active delivery run was not found',
        );
    }
    if (run.routeRevision !== expectedRouteRevision) {
        rerouteError(
            DeliveryRunExecutionErrorCodes.ROUTE_REVISION_CONFLICT,
            'Delivery route changed. Refresh the active run and retry.',
        );
    }
    if (run.rerouteRequiredAt === null) {
        return {
            applied: false,
            routeRevision: run.routeRevision,
            reroutePending: false,
        };
    }
    if (deliveryRunHasActiveArrivedStop(run.stops)) {
        return {
            applied: false,
            routeRevision: run.routeRevision,
            reroutePending: true,
        };
    }

    const initialProgress = await getDeliveryRunExecutionProgress(runId);
    rerouteOrigin({ run, originStopId });
    remainingRouteNodes({ run, progress: initialProgress });
    const claim = await claimDeliveryRunReroute({
        runId,
        expectedRouteRevision,
    });
    if (!claim) {
        return {
            applied: false,
            routeRevision: run.routeRevision,
            reroutePending: true,
        };
    }
    const claimedRun = await getDeliveryRun(runId);
    if (
        !claimedRun ||
        claimedRun.state !== DeliveryRunStates.ACTIVE ||
        claimedRun.routeRevision !== expectedRouteRevision ||
        claimedRun.rerouteAttemptedAt?.getTime() !==
            claim.rerouteClaimedAt.getTime() ||
        (!allowAdmin && claimedRun.driverUserId !== actorUserId)
    ) {
        rerouteError(
            DeliveryRunExecutionErrorCodes.ROUTE_REVISION_CONFLICT,
            'Delivery route changed. Refresh the active run and retry.',
        );
    }
    if (deliveryRunHasActiveArrivedStop(claimedRun.stops)) {
        rerouteError(
            DeliveryRunExecutionErrorCodes.ROUTE_REVISION_CONFLICT,
            'Delivery checkpoint changed while the reroute was claimed.',
        );
    }
    const progress = await getDeliveryRunExecutionProgress(runId);
    const origin = rerouteOrigin({ run: claimedRun, originStopId });
    const { nodes, stopIdsByNodeKey } = remainingRouteNodes({
        run: claimedRun,
        progress,
    });
    const plan = await recalculatePickupAwareDeliveryRoute({
        origin,
        nodes,
        departureTime,
    });
    const completedItineraryMaximum = Math.max(
        0,
        ...progress.flatMap((step) =>
            step.state === 'completed' ? [step.itinerarySequence] : [],
        ),
    );
    const pickupEstimates = plan.visits.flatMap((visit) => {
        if (visit.kind !== 'pickup') return [];
        const pickupNodeId = visit.nodeKey.startsWith('pickup:')
            ? visit.nodeKey.slice('pickup:'.length)
            : '';
        return pickupNodeId
            ? [
                  {
                      pickupNodeId,
                      itinerarySequence:
                          completedItineraryMaximum + visit.itinerarySequence,
                      estimatedArrivalAt: visit.estimatedArrivalAt,
                      incomingTravelSeconds: visit.incomingTravelSeconds,
                      incomingDistanceMeters: visit.incomingDistanceMeters,
                  },
              ]
            : [];
    });
    let legacyNextSequence =
        Math.max(
            0,
            ...claimedRun.stops.flatMap((stop) =>
                isDeliveryRunStopTerminal(stop.state) ? [stop.sequence] : [],
            ),
        ) + 1;
    const stopEstimates = plan.visits.flatMap((visit) => {
        if (visit.kind !== 'customer') return [];
        const stopIds = stopIdsByNodeKey.get(visit.nodeKey);
        if (!stopIds) return [];
        const itinerarySequence =
            claimedRun.routePlanVersion < 2
                ? legacyNextSequence
                : completedItineraryMaximum + visit.itinerarySequence;
        if (claimedRun.routePlanVersion < 2) {
            legacyNextSequence += stopIds.length;
        }
        return [
            {
                stopIds,
                itinerarySequence,
                estimatedArrivalAt: visit.estimatedArrivalAt,
                estimatedTravelSeconds: visit.incomingTravelSeconds,
                estimatedDistanceMeters: visit.incomingDistanceMeters,
            },
        ];
    });
    const applied = await applyDeliveryRunReroute({
        runId,
        expectedRouteRevision,
        rerouteClaimedAt: claim.rerouteClaimedAt,
        encodedPolyline: plan.encodedPolyline,
        estimateSource: plan.estimateSource,
        totalDistanceMeters: plan.totalDistanceMeters,
        totalDurationSeconds: plan.totalDurationSeconds,
        pickupEstimates,
        stopEstimates,
    });
    return { applied: true, ...applied };
}

export async function reconcileDeliveryRunReroute(
    input: Parameters<typeof rerouteDeliveryRun>[0],
) {
    try {
        return await rerouteDeliveryRun(input);
    } catch (error) {
        if (
            error instanceof DeliveryRunExecutionError &&
            error.code ===
                DeliveryRunExecutionErrorCodes.ROUTE_REVISION_CONFLICT
        ) {
            return {
                applied: false,
                routeRevision: input.expectedRouteRevision,
                reroutePending: true,
                conflict: true,
            };
        }
        console.warn('Delivery reroute remains pending', {
            runId: input.runId,
            routeRevision: input.expectedRouteRevision,
            code:
                error instanceof DeliveryRunExecutionError
                    ? error.code
                    : 'reroute-failed',
        });
        return {
            applied: false,
            routeRevision: input.expectedRouteRevision,
            reroutePending: true,
            conflict: false,
        };
    }
}
