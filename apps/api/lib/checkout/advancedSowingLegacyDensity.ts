import {
    type AdvancedSowingLegacyDensitySnapshotV1,
    resolveLegacySowingDensityLayoutKey,
} from '@gredice/js/plants';

type LegacyPlantingSource = {
    configurationSource: string;
    id: number;
    isActive: boolean;
    isDeleted?: boolean;
    plantSortId: number;
};

/**
 * Captures the density currently used by the legacy Garden renderer. Missing
 * catalogue rows stay absent so every downstream boundary fails closed; a
 * missing spacing attribute uses the renderer's established one-plant default.
 */
export function buildAdvancedSowingLegacyDensitySnapshots({
    plantings,
    seedingDistanceByPlantSortId,
}: {
    plantings: readonly LegacyPlantingSource[];
    seedingDistanceByPlantSortId: ReadonlyMap<
        number,
        number | null | undefined
    >;
}): AdvancedSowingLegacyDensitySnapshotV1[] {
    return plantings.flatMap((planting) => {
        if (
            planting.configurationSource !== 'legacy' ||
            !planting.isActive ||
            planting.isDeleted === true ||
            !Number.isSafeInteger(planting.id) ||
            planting.id <= 0 ||
            !Number.isSafeInteger(planting.plantSortId) ||
            planting.plantSortId <= 0 ||
            !seedingDistanceByPlantSortId.has(planting.plantSortId)
        ) {
            return [];
        }

        try {
            return [
                {
                    layoutKey: resolveLegacySowingDensityLayoutKey(
                        seedingDistanceByPlantSortId.get(planting.plantSortId),
                    ),
                    plantingId: planting.id,
                    plantSortId: planting.plantSortId,
                },
            ];
        } catch {
            return [];
        }
    });
}
