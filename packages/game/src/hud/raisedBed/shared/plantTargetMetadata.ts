export function isPlantTargetMetadataResolved(
    plantSortId: number | undefined,
    plantSort: unknown,
) {
    return plantSortId === undefined || plantSort !== undefined;
}
