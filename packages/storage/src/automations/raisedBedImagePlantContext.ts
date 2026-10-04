import type { EntityStandardized } from '../@types/EntityStandardized';

function plantSortName(sort: EntityStandardized | undefined, fallback: string) {
    return sort?.information?.name ?? sort?.information?.label ?? fallback;
}

function plantSortNameForId(
    plantSortsById: Map<number, EntityStandardized>,
    plantSortId: number | string,
) {
    const numericPlantSortId = Number(plantSortId);

    return Number.isFinite(numericPlantSortId)
        ? plantSortName(
              plantSortsById.get(numericPlantSortId),
              `Sorta #${plantSortId}`,
          )
        : String(plantSortId);
}

export function buildPreviousPlantNames(
    field: {
        plantCycles: Array<{
            plantSortId?: number | string | null;
            active?: boolean | null;
        }>;
    },
    plantSortsById: Map<number, EntityStandardized>,
) {
    const plantNames: string[] = [];
    const seenPlantNames = new Set<string>();

    for (const cycle of field.plantCycles) {
        if (cycle.active !== false || !cycle.plantSortId) {
            continue;
        }

        const plantName = plantSortNameForId(plantSortsById, cycle.plantSortId);
        if (seenPlantNames.has(plantName)) {
            continue;
        }

        seenPlantNames.add(plantName);
        plantNames.push(plantName);
    }

    return plantNames;
}
