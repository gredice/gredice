import { knownEventTypes } from '@gredice/storage';

type RaisedBedHistoryEvent = {
    aggregateId: string;
    type: string;
};

export const raisedBedHistoryEventTypes = [
    knownEventTypes.raisedBeds.create,
    knownEventTypes.raisedBeds.place,
    knownEventTypes.raisedBeds.delete,
    knownEventTypes.raisedBeds.abandon,
    knownEventTypes.raisedBeds.aiAnalysis,
];

export const raisedBedFieldHistoryEventTypes = [
    knownEventTypes.raisedBedFields.create,
    knownEventTypes.raisedBedFields.delete,
    knownEventTypes.raisedBedFields.plantPlace,
    knownEventTypes.raisedBedFields.plantSchedule,
    knownEventTypes.raisedBedFields.plantUpdate,
    knownEventTypes.raisedBedFields.plantBlock,
    knownEventTypes.raisedBedFields.plantReplaceSort,
    knownEventTypes.raisedBedFields.aiAnalysis,
];

const mutableRaisedBedEventTypes = new Set<string>(raisedBedHistoryEventTypes);
const mutableRaisedBedFieldEventTypes = new Set<string>(
    raisedBedFieldHistoryEventTypes,
);

function isValidId(value: number) {
    return Number.isSafeInteger(value) && value > 0;
}

function isCanonicalPositionIndex(value: string) {
    if (!/^\d+$/.test(value)) {
        return false;
    }

    const parsed = Number(value);
    return (
        Number.isSafeInteger(parsed) &&
        parsed >= 0 &&
        parsed.toString() === value
    );
}

export type RaisedBedEventMutationDecision =
    | { allowed: true }
    | {
          allowed: false;
          reason:
              | 'event_not_found'
              | 'event_read_only'
              | 'invalid_input'
              | 'selected_planting_conflict';
      };

type RaisedBedEventMutationContext = {
    activeSelectedPlantingPositionIndices?: ReadonlySet<number>;
};

type RaisedBedPlantingHistoryAvailability = {
    configurationSource: string;
    isActive: boolean;
    isDeleted?: boolean;
    memberships: Array<{
        isDeleted?: boolean;
        raisedBedField: { positionIndex: number };
    }>;
};

export function activeSelectedPlantingPositionIndices(
    plantings: readonly RaisedBedPlantingHistoryAvailability[],
) {
    return new Set(
        plantings.flatMap((planting) => {
            if (
                planting.configurationSource !== 'selected' ||
                !planting.isActive ||
                planting.isDeleted
            ) {
                return [];
            }
            return planting.memberships.flatMap((membership) =>
                membership.isDeleted
                    ? []
                    : [membership.raisedBedField.positionIndex],
            );
        }),
    );
}

export function raisedBedEventMutationDecision(
    event: RaisedBedHistoryEvent,
    raisedBedId: number,
    context?: RaisedBedEventMutationContext,
): RaisedBedEventMutationDecision {
    if (!isValidId(raisedBedId)) {
        return { allowed: false, reason: 'invalid_input' };
    }

    if (mutableRaisedBedEventTypes.has(event.type)) {
        return event.aggregateId === raisedBedId.toString()
            ? { allowed: true }
            : { allowed: false, reason: 'event_not_found' };
    }

    if (mutableRaisedBedFieldEventTypes.has(event.type)) {
        const prefix = `${raisedBedId.toString()}|`;
        const positionIndex = event.aggregateId.startsWith(prefix)
            ? event.aggregateId.slice(prefix.length)
            : '';
        if (!isCanonicalPositionIndex(positionIndex)) {
            return { allowed: false, reason: 'event_not_found' };
        }
        return context?.activeSelectedPlantingPositionIndices?.has(
            Number(positionIndex),
        )
            ? { allowed: false, reason: 'selected_planting_conflict' }
            : { allowed: true };
    }

    return { allowed: false, reason: 'event_read_only' };
}

export function canMutateRaisedBedHistoryEvent(
    event: RaisedBedHistoryEvent,
    raisedBedId: number,
    context?: RaisedBedEventMutationContext,
) {
    return raisedBedEventMutationDecision(event, raisedBedId, context).allowed;
}

export async function runRaisedBedEventMutation({
    eventId,
    getEvent,
    mutate,
    raisedBedId,
    context,
}: {
    eventId: number;
    getEvent: (eventId: number) => Promise<RaisedBedHistoryEvent | undefined>;
    mutate: (event: RaisedBedHistoryEvent) => Promise<unknown>;
    raisedBedId: number;
    context?: RaisedBedEventMutationContext;
}): Promise<RaisedBedEventMutationDecision> {
    if (!isValidId(eventId) || !isValidId(raisedBedId)) {
        return { allowed: false, reason: 'invalid_input' };
    }

    const event = await getEvent(eventId);
    if (!event) {
        return { allowed: false, reason: 'event_not_found' };
    }

    const decision = raisedBedEventMutationDecision(
        event,
        raisedBedId,
        context,
    );
    if (!decision.allowed) {
        return decision;
    }

    await mutate(event);
    return { allowed: true };
}
