export async function updateSelectedPlantingLifecycleStatusAction(
    ...args: unknown[]
) {
    const error = document.documentElement.dataset.selectedPlantingUpdateError;
    if (error) throw new Error(error);
    document.documentElement.dataset.selectedPlantingUpdate =
        JSON.stringify(args);
    return { success: true };
}
