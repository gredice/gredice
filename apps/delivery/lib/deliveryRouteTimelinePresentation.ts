import type { DeliveryRouteStepSummary } from './deliveryDashboardTypes';
import type { DeliveryMapSelection } from './deliveryMapData';

export type DriverRouteTimelineState =
    | 'completed'
    | 'syncing'
    | 'current'
    | 'next'
    | 'upcoming'
    | 'retry'
    | 'exception'
    | 'locked';

export type DriverRouteTimelineItem = {
    id: string;
    sequence: number;
    kind: 'pickup' | 'delivery';
    state: DriverRouteTimelineState;
    title: string;
    destination: string;
    deliveryCount: number;
    estimatedArrivalAt: string | null;
    estimatedTravelSeconds: number | null;
    mapSelection?: DeliveryMapSelection | null;
    statusMessage?: string | null;
};

export function deliveryRouteStepIdentity(step: DeliveryRouteStepSummary) {
    return step.kind === 'pickup'
        ? `pickup:${step.pickup.id}`
        : `delivery:${step.stop.id ?? step.stop.requestId}`;
}

function deliveryRouteTimelineState(
    step: DeliveryRouteStepSummary,
    stepIndex: number,
    nextStepIndex: number,
    syncingStepIds: ReadonlySet<string>,
): DriverRouteTimelineState {
    if (
        step.kind === 'delivery' &&
        (step.stop.stopState === 'failed' ||
            step.stop.stopState === 'cancelled')
    ) {
        return 'exception';
    }
    if (
        step.kind === 'delivery' &&
        (step.retryLaneRank !== null || step.stop.stopState === 'deferred')
    ) {
        return 'retry';
    }
    if (syncingStepIds.has(deliveryRouteStepIdentity(step))) return 'syncing';
    if (step.actionState === 'completed') return 'completed';
    if (step.actionState === 'current') return 'current';
    if (stepIndex === nextStepIndex) return 'next';
    if (step.actionState === 'locked') return 'locked';
    return 'upcoming';
}

export function deliveryRouteTimelineItems(
    steps: readonly DeliveryRouteStepSummary[],
    syncingStepIds: ReadonlySet<string> = new Set(),
): DriverRouteTimelineItem[] {
    const currentStepIndex = steps.findIndex(
        (step) => step.actionState === 'current',
    );
    const nextStepIndex = steps.findIndex(
        (step, index) =>
            index > currentStepIndex && step.actionState !== 'completed',
    );
    return steps.map((step, stepIndex) => {
        if (step.kind === 'pickup') {
            const mapSelection = {
                kind: 'pickup' as const,
                id: step.pickup.id,
            };
            return {
                id: deliveryRouteStepIdentity(step),
                sequence: step.itinerarySequence,
                kind: step.kind,
                state: deliveryRouteTimelineState(
                    step,
                    stepIndex,
                    nextStepIndex,
                    syncingStepIds,
                ),
                title: step.pickup.name,
                destination: step.pickup.address,
                deliveryCount: step.pickup.expectedCount,
                estimatedArrivalAt: step.pickup.estimatedArrivalAt,
                estimatedTravelSeconds: step.pickup.estimatedTravelSeconds,
                mapSelection,
            };
        }
        return {
            id: deliveryRouteStepIdentity(step),
            sequence: step.itinerarySequence,
            kind: step.kind,
            state: deliveryRouteTimelineState(
                step,
                stepIndex,
                nextStepIndex,
                syncingStepIds,
            ),
            title: step.stop.addressLabel ?? step.stop.contactName,
            destination: step.stop.address,
            deliveryCount: step.stop.deliveryCount,
            estimatedArrivalAt: step.stop.estimatedArrivalAt,
            estimatedTravelSeconds: step.stop.estimatedTravelSeconds,
            mapSelection: !step.mapNodeId
                ? null
                : {
                      kind: 'delivery' as const,
                      id: step.mapNodeId,
                  },
        };
    });
}
