export type SelectedPlantingOperationTarget = {
    plantingId: number;
    expectedLifecycleVersionEventId: number;
    expectedPlantSortId: number;
};

/** Missing targets are legacy; malformed explicit targets must never fall back to a field. */
export function readSelectedPlantingOperationTarget(
    additionalData: unknown,
): SelectedPlantingOperationTarget | null {
    if (additionalData === '') return null;
    const data: unknown =
        typeof additionalData === 'string'
            ? JSON.parse(additionalData)
            : additionalData;
    if (!data || typeof data !== 'object' || !('plantingTarget' in data))
        return null;
    const target = data.plantingTarget;
    if (
        !target ||
        typeof target !== 'object' ||
        !('plantingId' in target) ||
        !('expectedLifecycleVersionEventId' in target) ||
        !('expectedPlantSortId' in target)
    )
        throw new Error('Neispravna sadnja za radnju.');
    const { plantingId, expectedLifecycleVersionEventId, expectedPlantSortId } =
        target;
    if (
        typeof plantingId !== 'number' ||
        !Number.isSafeInteger(plantingId) ||
        plantingId <= 0 ||
        typeof expectedLifecycleVersionEventId !== 'number' ||
        !Number.isSafeInteger(expectedLifecycleVersionEventId) ||
        expectedLifecycleVersionEventId <= 0 ||
        typeof expectedPlantSortId !== 'number' ||
        !Number.isSafeInteger(expectedPlantSortId) ||
        expectedPlantSortId <= 0
    )
        throw new Error('Neispravna sadnja za radnju.');
    return { plantingId, expectedLifecycleVersionEventId, expectedPlantSortId };
}
