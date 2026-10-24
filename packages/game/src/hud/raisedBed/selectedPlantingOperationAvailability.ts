import type { OperationData } from '@gredice/client';
import type { AdvancedSowingGardenPlantingVisual } from './advancedSowingGardenVisuals';

export function isSelectedPlantingOperationAvailable(
    operation: OperationData,
    planting: AdvancedSowingGardenPlantingVisual,
) {
    if (operation.attributes.application !== 'plant') return false;
    if (operation.id === 346)
        return ['died', 'notSprouted', 'harvested'].includes(
            planting.lifecycleStatus ?? '',
        );
    if (
        ['died', 'notSprouted', 'harvested', 'removed'].includes(
            planting.lifecycleStatus ?? '',
        )
    )
        return false;
    if (operation.id === 593)
        return (
            planting.selectedTask?.sowingLocation === 'greenhouse' &&
            planting.lifecycleStatus === 'sprouted'
        );
    return true;
}
