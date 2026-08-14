import { calculatePlantsPerField } from '@gredice/js/plants';
import type { EntityStandardized } from '@gredice/storage';

export function getRecommendedPlantCountPerField(
    plantSort: EntityStandardized | null | undefined,
) {
    const seedingDistance =
        plantSort?.information?.plant?.attributes?.seedingDistance;

    return typeof seedingDistance === 'number'
        ? calculatePlantsPerField(
              seedingDistance,
              plantSort?.information?.name ??
                  `Plant sort #${plantSort?.id.toString() ?? 'unknown'}`,
          ).totalPlants
        : null;
}

export function buildFarmSchedulePlantingLabel({
    plantName,
    recommendedPlantCount,
    sowingLocation,
}: {
    plantName?: string | null;
    recommendedPlantCount?: number | null;
    sowingLocation?: string | null;
}) {
    const taskName =
        sowingLocation === 'greenhouse' ? 'Sijanje u stakleniku' : 'Sijanje';
    const resolvedPlantName = plantName?.trim() || 'Nepoznato';
    const validRecommendedPlantCount =
        typeof recommendedPlantCount === 'number' &&
        Number.isSafeInteger(recommendedPlantCount) &&
        recommendedPlantCount > 0
            ? recommendedPlantCount
            : null;
    const plantCountNote = validRecommendedPlantCount
        ? `preporučeno ${validRecommendedPlantCount.toString()} ${getPlantCountNoun(validRecommendedPlantCount)} po polju`
        : 'broj biljaka nije zabilježen';

    return `${taskName}: ${resolvedPlantName} · ${plantCountNote}`;
}

export function buildFarmScheduleSelectedPlantingLabel({
    plantCount,
    plantName,
    plantsPerAxis,
    selectedSeedingDistanceCm,
    sowingLocation,
    spanColumns,
    spanRows,
}: {
    plantCount?: number | null;
    plantName?: string | null;
    plantsPerAxis?: number | null;
    selectedSeedingDistanceCm?: number | null;
    sowingLocation?: string | null;
    spanColumns: number;
    spanRows: number;
}) {
    const taskName =
        sowingLocation === 'greenhouse' ? 'Sijanje u stakleniku' : 'Sijanje';
    const resolvedPlantName = plantName?.trim() || 'Nepoznato';
    const spacingLabel =
        typeof selectedSeedingDistanceCm === 'number' &&
        Number.isFinite(selectedSeedingDistanceCm) &&
        selectedSeedingDistanceCm > 0
            ? `razmak ${selectedSeedingDistanceCm.toString()} cm`
            : 'razmak nije zabilježen';
    const validPlantsPerAxis =
        typeof plantsPerAxis === 'number' &&
        Number.isSafeInteger(plantsPerAxis) &&
        plantsPerAxis > 0
            ? plantsPerAxis
            : null;
    const densityLabel = validPlantsPerAxis
        ? `gustoća ${validPlantsPerAxis.toString()} × ${validPlantsPerAxis.toString()}`
        : 'gustoća nije zabilježena';
    const validPlantCount =
        typeof plantCount === 'number' &&
        Number.isSafeInteger(plantCount) &&
        plantCount > 0
            ? plantCount
            : null;
    const plantCountLabel = validPlantCount
        ? `ukupno ${validPlantCount.toString()} ${getPlantCountNoun(validPlantCount)}`
        : 'ukupan broj biljaka nije zabilježen';

    return `${taskName}: ${resolvedPlantName} · ${spanRows.toString()} × ${spanColumns.toString()} polja · ${densityLabel} · ${plantCountLabel} · ${spacingLabel}`;
}

function getPlantCountNoun(count: number) {
    if (count === 1) {
        return 'biljka';
    }
    if (count >= 2 && count <= 4) {
        return 'biljke';
    }
    return 'biljaka';
}
