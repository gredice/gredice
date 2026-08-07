export type PlantCycleRepairEvent = {
    aggregateId: string;
    createdAt: Date;
    data: unknown;
    id: number;
    type: string;
};

export type SupersededPlantCycleRepair = {
    aggregateId: string;
    nextPlantPlaceEventId: number;
    positionIndex: number;
    raisedBedId: number;
    repairCreatedAt: Date;
    repairKey: string;
    supersededPlantPlaceEventId: number;
};

export type UnsafeSupersededPlantCycleRepair = {
    aggregateId: string;
    nextPlantPlaceEventId: number;
    reason: string;
    supersededPlantPlaceEventId: number;
};

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

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function compareEvents(
    left: PlantCycleRepairEvent,
    right: PlantCycleRepairEvent,
) {
    const timeDifference = left.createdAt.getTime() - right.createdAt.getTime();
    return timeDifference === 0 ? left.id - right.id : timeDifference;
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
    if (
        !Number.isSafeInteger(raisedBedId) ||
        raisedBedId <= 0 ||
        !Number.isSafeInteger(positionIndex) ||
        positionIndex < 0
    ) {
        return null;
    }

    return { positionIndex, raisedBedId };
}

function plantCycleIsActive(events: PlantCycleRepairEvent[]) {
    let active = true;

    for (const event of events) {
        if (event.type === 'raisedBedField.delete') {
            active = false;
            continue;
        }
        if (event.type !== 'raisedBedField.plantUpdate') {
            continue;
        }

        const status = isRecord(event.data) ? event.data.status : undefined;
        if (status === 'removed') {
            active = false;
        } else if (
            typeof status === 'string' &&
            activePlantStatuses.has(status)
        ) {
            active = true;
        }
    }

    return active;
}

export function planSupersededPlantCycleRepairs(
    events: PlantCycleRepairEvent[],
) {
    const eventsByAggregateId = new Map<string, PlantCycleRepairEvent[]>();
    for (const event of events) {
        const aggregateEvents = eventsByAggregateId.get(event.aggregateId);
        if (aggregateEvents) {
            aggregateEvents.push(event);
        } else {
            eventsByAggregateId.set(event.aggregateId, [event]);
        }
    }

    const repairs: SupersededPlantCycleRepair[] = [];
    const unsafe: UnsafeSupersededPlantCycleRepair[] = [];

    for (const [aggregateId, aggregateEvents] of eventsByAggregateId) {
        const aggregate = parseAggregateId(aggregateId);
        if (!aggregate) {
            continue;
        }

        const sortedEvents = [...aggregateEvents].sort(compareEvents);
        const plantPlaceIndexes = sortedEvents.flatMap((event, index) =>
            event.type === 'raisedBedField.plantPlace' ? [index] : [],
        );

        for (let index = 0; index < plantPlaceIndexes.length - 1; index += 1) {
            const cycleStartIndex = plantPlaceIndexes[index];
            const nextCycleStartIndex = plantPlaceIndexes[index + 1];
            if (
                cycleStartIndex === undefined ||
                nextCycleStartIndex === undefined
            ) {
                continue;
            }

            const cycleEvents = sortedEvents.slice(
                cycleStartIndex,
                nextCycleStartIndex,
            );
            if (!plantCycleIsActive(cycleEvents)) {
                continue;
            }

            const plantPlaceEvent = sortedEvents[cycleStartIndex];
            const nextPlantPlaceEvent = sortedEvents[nextCycleStartIndex];
            const previousEvent = sortedEvents[nextCycleStartIndex - 1];
            if (!plantPlaceEvent || !nextPlantPlaceEvent || !previousEvent) {
                continue;
            }

            const repairCreatedAt = new Date(
                nextPlantPlaceEvent.createdAt.getTime() - 1,
            );
            if (
                repairCreatedAt.getTime() <= previousEvent.createdAt.getTime()
            ) {
                unsafe.push({
                    aggregateId,
                    nextPlantPlaceEventId: nextPlantPlaceEvent.id,
                    reason: 'No safe millisecond exists before the next placement event.',
                    supersededPlantPlaceEventId: plantPlaceEvent.id,
                });
                continue;
            }

            repairs.push({
                aggregateId,
                nextPlantPlaceEventId: nextPlantPlaceEvent.id,
                positionIndex: aggregate.positionIndex,
                raisedBedId: aggregate.raisedBedId,
                repairCreatedAt,
                repairKey: `superseded-plant-cycle:${plantPlaceEvent.id.toString()}:${nextPlantPlaceEvent.id.toString()}`,
                supersededPlantPlaceEventId: plantPlaceEvent.id,
            });
        }
    }

    return {
        repairs: repairs.sort((left, right) =>
            left.aggregateId.localeCompare(right.aggregateId),
        ),
        unsafe: unsafe.sort((left, right) =>
            left.aggregateId.localeCompare(right.aggregateId),
        ),
    };
}
