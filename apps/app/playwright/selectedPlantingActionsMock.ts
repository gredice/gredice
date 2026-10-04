export async function updateSelectedPlantingLifecycleStatusAction(
    ...args: unknown[]
) {
    const error = document.documentElement.dataset.selectedPlantingUpdateError;
    if (error) throw new Error(error);
    document.documentElement.dataset.selectedPlantingUpdate =
        JSON.stringify(args);
    return { success: true };
}

export async function createSelectedPlantingOperationAction(
    ...args: unknown[]
) {
    document.documentElement.dataset.selectedPlantingOperation =
        JSON.stringify(args);
    return { operationId: 101, created: true };
}
