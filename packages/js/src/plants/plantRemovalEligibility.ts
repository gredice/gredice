/**
 * Garden owners can clear a field without paying for plant removal only when
 * there is nothing grown to pull out: the cycle never sprouted, or harvest
 * itself removed the plant (clean harvest).
 */
const sproutedOrLaterPlantStatuses = new Set([
    'sprouted',
    'firstFlowers',
    'firstFruitSet',
    'ready',
    'harvested',
    'died',
]);

export type PlantStatusChangeLike = {
    status?: string | null;
};

export type PlantCycleStatusHistoryLike = {
    active?: boolean | null;
    statusChanges?: readonly PlantStatusChangeLike[] | null;
};

export const plantRemovalRequiresOperationError =
    'Plant cannot be removed without scheduling the plant removal operation. Only harvested plants with clean harvest, or fields that never sprouted, can be removed directly.';

export function isCleanHarvestAttribute(value: unknown) {
    return value === true;
}

export function getActivePlantCycleStatusChanges(
    plantCycles?: readonly PlantCycleStatusHistoryLike[] | null,
) {
    return plantCycles?.find((plantCycle) => plantCycle.active)?.statusChanges;
}

export function plantCycleHasSprouted({
    plantStatus,
    statusChanges,
}: {
    plantStatus?: string | null;
    statusChanges?: readonly PlantStatusChangeLike[] | null;
}) {
    if (plantStatus && sproutedOrLaterPlantStatuses.has(plantStatus)) {
        return true;
    }

    return Boolean(
        statusChanges?.some(
            (change) =>
                typeof change.status === 'string' &&
                sproutedOrLaterPlantStatuses.has(change.status),
        ),
    );
}

export function canRemovePlantWithoutOperation({
    plantStatus,
    statusChanges,
    cleanHarvest,
}: {
    plantStatus?: string | null;
    statusChanges?: readonly PlantStatusChangeLike[] | null;
    cleanHarvest?: unknown;
}) {
    if (plantStatus === 'notSprouted') {
        return !plantCycleHasSprouted({ plantStatus, statusChanges });
    }

    return plantStatus === 'harvested' && isCleanHarvestAttribute(cleanHarvest);
}
