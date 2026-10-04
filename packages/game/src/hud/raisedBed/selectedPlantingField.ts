import type { RaisedBedFieldPlantHistoryEntry } from '../../utils/raisedBedFields';
import type { AdvancedSowingGardenPlantingVisual } from './advancedSowingGardenVisuals';

/** Read-only HUD data. A planting never inherits a companion's field-cycle identity. */
export function selectedPlantingField(
    planting: AdvancedSowingGardenPlantingVisual,
    positionIndex: number,
): RaisedBedFieldPlantHistoryEntry {
    return {
        active: true,
        positionIndex,
        plantSortId: planting.plantSortId,
        plantStatus: planting.lifecycleStatus,
        plantScheduledDate: planting.selectedTask?.scheduledDate,
        plantSowDate: planting.sowedAt,
        sowingLocation: planting.selectedTask?.sowingLocation,
    };
}
