export type SchedulePlantingTaskIdentity = {
    expectedPlantCycleEventId: number;
    expectedPlantCycleVersionEventId: number;
    expectedPlantSortId: number;
};

type PlantingTaskIdentitySource = {
    plantCycles: readonly {
        active: boolean;
        endedEventId: number;
        plantPlaceEventId: number;
    }[];
    plantSortId?: number | null;
};

function isPositiveSafeInteger(value: unknown): value is number {
    return (
        typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    );
}

export function getSchedulePlantingTaskIdentity(
    field: PlantingTaskIdentitySource,
): SchedulePlantingTaskIdentity | null {
    const activePlantCycle = field.plantCycles.find(
        (plantCycle) => plantCycle.active,
    );
    if (
        !isPositiveSafeInteger(activePlantCycle?.plantPlaceEventId) ||
        !isPositiveSafeInteger(activePlantCycle.endedEventId) ||
        !isPositiveSafeInteger(field.plantSortId)
    ) {
        return null;
    }

    return {
        expectedPlantCycleEventId: activePlantCycle.plantPlaceEventId,
        expectedPlantCycleVersionEventId: activePlantCycle.endedEventId,
        expectedPlantSortId: field.plantSortId,
    };
}
