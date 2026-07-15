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

const mutableRaisedBedEventTypes = new Set<string>([
    knownEventTypes.raisedBeds.aiAnalysis,
]);
const mutableRaisedBedFieldEventTypes = new Set<string>([
    knownEventTypes.raisedBedFields.aiAnalysis,
]);

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
          reason: 'event_not_found' | 'event_read_only' | 'invalid_input';
      };

export function raisedBedEventMutationDecision(
    event: RaisedBedHistoryEvent,
    raisedBedId: number,
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
        return isCanonicalPositionIndex(positionIndex)
            ? { allowed: true }
            : { allowed: false, reason: 'event_not_found' };
    }

    return { allowed: false, reason: 'event_read_only' };
}

export function canMutateRaisedBedHistoryEvent(
    event: RaisedBedHistoryEvent,
    raisedBedId: number,
) {
    return raisedBedEventMutationDecision(event, raisedBedId).allowed;
}

export async function runRaisedBedEventMutation({
    eventId,
    getEvent,
    mutate,
    raisedBedId,
}: {
    eventId: number;
    getEvent: (eventId: number) => Promise<RaisedBedHistoryEvent | undefined>;
    mutate: () => Promise<unknown>;
    raisedBedId: number;
}): Promise<RaisedBedEventMutationDecision> {
    if (!isValidId(eventId) || !isValidId(raisedBedId)) {
        return { allowed: false, reason: 'invalid_input' };
    }

    const event = await getEvent(eventId);
    if (!event) {
        return { allowed: false, reason: 'event_not_found' };
    }

    const decision = raisedBedEventMutationDecision(event, raisedBedId);
    if (!decision.allowed) {
        return decision;
    }

    await mutate();
    return { allowed: true };
}
