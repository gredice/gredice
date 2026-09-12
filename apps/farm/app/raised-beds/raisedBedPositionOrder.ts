export function getRaisedBedPositionIndexesDescending(
    positionIndexes: number[],
) {
    const positionCount =
        Math.ceil((Math.max(8, ...positionIndexes) + 1) / 3) * 3;

    return Array.from(
        { length: positionCount },
        (_, displayIndex) => positionCount - 1 - displayIndex,
    );
}

export function getPlantDetailsPositionIndex(plant: {
    positionIndex: number;
    planting?: { anchorPositionIndex: number } | null;
}) {
    return plant.planting?.anchorPositionIndex ?? plant.positionIndex;
}
