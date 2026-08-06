const visibleRaisedBedPlantStatuses = new Set([
    'sprouted',
    'firstFlowers',
    'firstFruitSet',
    'ready',
    'harvested',
]);

export function shouldRenderRaisedBedPlant({
    plantSowDate,
    plantStatus,
}: {
    plantSowDate?: string | null;
    plantStatus?: string | null;
}) {
    return Boolean(
        plantSowDate &&
            plantStatus &&
            visibleRaisedBedPlantStatuses.has(plantStatus),
    );
}
