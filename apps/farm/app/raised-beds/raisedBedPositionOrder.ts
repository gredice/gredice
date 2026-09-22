import {
    ADVANCED_SOWING_BED_COLUMN_COUNT,
    ADVANCED_SOWING_DEFAULT_BED_FIELD_COUNT,
} from '@gredice/js/plants';

export function getRaisedBedPositionIndexesDescending(
    positionIndexes: number[],
) {
    // Missing records still occupy physical spaces in the full raised bed.
    const positionCount =
        Math.ceil(
            Math.max(
                ADVANCED_SOWING_DEFAULT_BED_FIELD_COUNT,
                ...positionIndexes.map((position) => position + 1),
            ) / ADVANCED_SOWING_BED_COLUMN_COUNT,
        ) * ADVANCED_SOWING_BED_COLUMN_COUNT;

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
