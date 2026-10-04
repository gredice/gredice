type HarvestLabelField = {
    plantStatus?: string | null;
};

type HarvestLabelScope = 'explicitField' | 'raisedBed';
type HarvestLabelPlantCycle = {
    startedAt: Date;
};

export function isHarvestLabelEligible(
    field: HarvestLabelField,
    scope: HarvestLabelScope,
) {
    return scope === 'explicitField' || field.plantStatus === 'ready';
}

export function findHarvestLabelPlantCycleAtDate<
    T extends HarvestLabelPlantCycle,
>(plantCycles: readonly T[] | null | undefined, operationDate: Date) {
    return plantCycles
        ?.filter((plantCycle) => plantCycle.startedAt <= operationDate)
        .toSorted(
            (left, right) =>
                left.startedAt.getTime() - right.startedAt.getTime(),
        )
        .at(-1);
}
