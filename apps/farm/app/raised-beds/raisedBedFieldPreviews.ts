import {
    getRaisedBedFieldGroups,
    plantFieldStatusLabel,
} from '@gredice/js/plants';
import {
    type EntityStandardized,
    type getFarmUserRaisedBeds,
    getRaisedBedPlantOccupancy,
} from '@gredice/storage';
import { getRaisedBedPositionIndexesDescending } from './raisedBedPositionOrder';

type FarmRaisedBed = Awaited<ReturnType<typeof getFarmUserRaisedBeds>>[number];

export function getFieldPreviews(
    raisedBed: FarmRaisedBed,
    sorts: EntityStandardized[] | null | undefined,
) {
    const plantSortsById = new Map<number, EntityStandardized>();
    if (sorts) {
        for (const sort of sorts) {
            plantSortsById.set(sort.id, sort);
        }
    }

    const plants = getRaisedBedPlantOccupancy(raisedBed);
    const positions = getRaisedBedPositionIndexesDescending([
        ...raisedBed.fields.map((field) => field.positionIndex),
        ...plants.flatMap((plant) =>
            plant.positionNumbers.map((position) => position - 1),
        ),
    ]);
    return getRaisedBedFieldGroups(positions, plants).map((group) => {
        const occupants = plants.filter((plant) =>
            plant.positionNumbers.some((position) =>
                group.positionNumbers.includes(position),
            ),
        );
        const fieldLabel = `${group.positionNumbers.length === 1 ? 'Polje' : 'Polja'} ${group.positionNumbers.join(', ')}`;
        return {
            ...group,
            key: `positions-${group.positionNumbers.join('-')}`,
            hasPlant: occupants.length > 0,
            label: occupants.length
                ? `${fieldLabel} · ${occupants
                      .map((plant) => {
                          const sort = plantSortsById.get(plant.plantSortId);
                          return (
                              sort?.information?.label ??
                              sort?.information?.name ??
                              `Sorta #${plant.plantSortId}`
                          );
                      })
                      .join(', ')}`
                : `${fieldLabel} prazno`,
            plants: occupants.map((plant) => ({
                key: plant.key,
                plantSort: plantSortsById.get(plant.plantSortId),
                positionNumbers: plant.positionNumbers,
                plantCount: plant.planting?.plantCount,
                status: plant.plantStatus,
                statusLabel: plant.plantStatus
                    ? plantFieldStatusLabel(plant.plantStatus).shortLabel
                    : null,
            })),
        };
    });
}
