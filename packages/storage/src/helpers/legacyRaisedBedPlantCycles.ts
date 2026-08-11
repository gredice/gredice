export const legacyRaisedBedPlantCycleEventTypes = [
    'raisedBedField.delete',
    'raisedBedField.plantBlock',
    'raisedBedField.plantPlace',
    'raisedBedField.plantReplaceSort',
    'raisedBedField.plantSchedule',
    'raisedBedField.plantUpdate',
] as const;

const legacyRaisedBedPlantCycleEventTypeSet = new Set<string>(
    legacyRaisedBedPlantCycleEventTypes,
);
const plantPlaceEventType = 'raisedBedField.plantPlace';
const plantReplaceSortEventType = 'raisedBedField.plantReplaceSort';
const plantUpdateEventType = 'raisedBedField.plantUpdate';
const fieldDeleteEventType = 'raisedBedField.delete';
const activePlantStatuses = new Set([
    'firstFlowers',
    'firstFruitSet',
    'new',
    'pendingVerification',
    'planned',
    'ready',
    'sowed',
    'sprouted',
]);
const stoppedButActivePlantStatuses = new Set([
    'died',
    'harvested',
    'notSprouted',
]);

export type LegacyRaisedBedPlantCycleEvent = {
    id: number;
    type: string;
    version: number;
    aggregateId: string;
    data: unknown;
    createdAt: Date;
};

export type LegacyRaisedBedPlantCycleProjection = {
    sourceEventId: number;
    aggregateId: string;
    raisedBedId: number;
    positionIndex: number;
    plantSortId: number;
    isActive: boolean;
    startedAt: Date;
    stoppedAt: Date | null;
    versionEventId: number;
};

export type LegacyRaisedBedPlantCycleProjectionErrorCode =
    | 'duplicate_event_id'
    | 'malformed_aggregate'
    | 'malformed_sort'
    | 'unsupported_event_version';

export class LegacyRaisedBedPlantCycleProjectionError extends Error {
    override readonly name = 'LegacyRaisedBedPlantCycleProjectionError';

    constructor(
        readonly code: LegacyRaisedBedPlantCycleProjectionErrorCode,
        readonly eventId: number,
    ) {
        super(
            `Legacy raised-bed plant cycle projection failed for event ${eventId.toString()}: ${code}.`,
        );
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function compareEvents(
    left: LegacyRaisedBedPlantCycleEvent,
    right: LegacyRaisedBedPlantCycleEvent,
) {
    const timestampDifference =
        left.createdAt.getTime() - right.createdAt.getTime();
    return timestampDifference === 0 ? left.id - right.id : timestampDifference;
}

function parseAggregateId(aggregateId: string) {
    const match =
        /^(?<raisedBedId>[1-9]\d*)\|(?<positionIndex>0|[1-9]\d*)$/u.exec(
            aggregateId,
        );
    if (!match?.groups) {
        return null;
    }

    const raisedBedId = Number.parseInt(match.groups.raisedBedId ?? '', 10);
    const positionIndex = Number.parseInt(match.groups.positionIndex ?? '', 10);
    return Number.isSafeInteger(raisedBedId) &&
        raisedBedId > 0 &&
        Number.isSafeInteger(positionIndex) &&
        positionIndex >= 0
        ? { raisedBedId, positionIndex }
        : null;
}

function parsePlantSortId(value: unknown) {
    if (typeof value === 'number') {
        return Number.isSafeInteger(value) && value > 0 ? value : null;
    }
    if (typeof value !== 'string' || !/^[1-9]\d*$/u.test(value)) {
        return null;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function requirePlantSortId(event: LegacyRaisedBedPlantCycleEvent) {
    const plantSortId = parsePlantSortId(
        isRecord(event.data) ? event.data.plantSortId : undefined,
    );
    if (plantSortId === null) {
        throw new LegacyRaisedBedPlantCycleProjectionError(
            'malformed_sort',
            event.id,
        );
    }
    return plantSortId;
}

function effectiveEventDate(event: LegacyRaisedBedPlantCycleEvent) {
    const effectiveDate = isRecord(event.data)
        ? event.data.effectiveDate
        : undefined;
    if (typeof effectiveDate !== 'string') {
        return event.createdAt;
    }
    const parsed = new Date(effectiveDate);
    return Number.isNaN(parsed.getTime()) ? event.createdAt : parsed;
}

/**
 * Projects legacy field-event cycles into the lifecycle values that may change
 * after their planting rows were backfilled. Events are sorted deterministically,
 * and a later placement always terminates the preceding cycle.
 */
export function projectLegacyRaisedBedPlantCycles(
    sourceEvents: readonly LegacyRaisedBedPlantCycleEvent[],
) {
    const eventIds = new Set<number>();
    const eventsByAggregateId = new Map<
        string,
        LegacyRaisedBedPlantCycleEvent[]
    >();

    for (const event of sourceEvents) {
        if (!legacyRaisedBedPlantCycleEventTypeSet.has(event.type)) {
            continue;
        }
        if (eventIds.has(event.id)) {
            throw new LegacyRaisedBedPlantCycleProjectionError(
                'duplicate_event_id',
                event.id,
            );
        }
        eventIds.add(event.id);
        if (event.version !== 1) {
            throw new LegacyRaisedBedPlantCycleProjectionError(
                'unsupported_event_version',
                event.id,
            );
        }

        const aggregateEvents = eventsByAggregateId.get(event.aggregateId);
        if (aggregateEvents) {
            aggregateEvents.push(event);
        } else {
            eventsByAggregateId.set(event.aggregateId, [event]);
        }
    }

    const projections: LegacyRaisedBedPlantCycleProjection[] = [];
    for (const [aggregateId, aggregateEvents] of eventsByAggregateId) {
        const sortedEvents = [...aggregateEvents].sort(compareEvents);
        const firstPlaceEvent = sortedEvents.find(
            (event) => event.type === plantPlaceEventType,
        );
        if (!firstPlaceEvent) {
            continue;
        }
        const aggregate = parseAggregateId(aggregateId);
        if (!aggregate) {
            throw new LegacyRaisedBedPlantCycleProjectionError(
                'malformed_aggregate',
                firstPlaceEvent.id,
            );
        }

        let currentProjection: LegacyRaisedBedPlantCycleProjection | null =
            null;
        for (const event of sortedEvents) {
            if (event.type === plantPlaceEventType) {
                if (currentProjection) {
                    projections.push({
                        ...currentProjection,
                        isActive: false,
                        stoppedAt: event.createdAt,
                        versionEventId: event.id,
                    });
                }
                currentProjection = {
                    sourceEventId: event.id,
                    aggregateId,
                    raisedBedId: aggregate.raisedBedId,
                    positionIndex: aggregate.positionIndex,
                    plantSortId: requirePlantSortId(event),
                    isActive: true,
                    startedAt: event.createdAt,
                    stoppedAt: null,
                    versionEventId: event.id,
                };
                continue;
            }
            if (!currentProjection) {
                continue;
            }
            currentProjection.versionEventId = event.id;
            if (event.type === plantReplaceSortEventType) {
                currentProjection.plantSortId = requirePlantSortId(event);
                continue;
            }
            if (event.type === fieldDeleteEventType) {
                currentProjection.isActive = false;
                currentProjection.stoppedAt = effectiveEventDate(event);
                continue;
            }
            if (event.type !== plantUpdateEventType) {
                continue;
            }

            const status = isRecord(event.data) ? event.data.status : undefined;
            if (status === 'removed') {
                currentProjection.isActive = false;
                currentProjection.stoppedAt = effectiveEventDate(event);
            } else if (
                typeof status === 'string' &&
                stoppedButActivePlantStatuses.has(status)
            ) {
                // Legacy field semantics keep these cycles active so their
                // follow-up removal tasks remain addressable, while recording
                // the terminal crop timestamp.
                currentProjection.stoppedAt = effectiveEventDate(event);
            } else if (
                typeof status === 'string' &&
                activePlantStatuses.has(status)
            ) {
                currentProjection.isActive = true;
                currentProjection.stoppedAt = null;
            }
        }
        if (currentProjection) {
            projections.push(currentProjection);
        }
    }

    return projections.sort(
        (left, right) => left.sourceEventId - right.sourceEventId,
    );
}
