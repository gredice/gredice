import type { OperationData } from '@gredice/client';
import { Stack } from '@gredice/ui/Stack';
import { useCallback } from 'react';
import type { AdvancedSowingGardenPlantingVisual } from './advancedSowingGardenVisuals';
import { RaisedBedSelectedPlantingOwnerControls } from './RaisedBedSelectedPlantingOwnerControls';
import { OperationsList } from './shared/OperationsList';

export function SelectedPlantingOperations({
    gardenId,
    raisedBedId,
    planting,
}: {
    gardenId: number;
    raisedBedId: number;
    planting: AdvancedSowingGardenPlantingVisual;
}) {
    const filter = useCallback(
        (operation: OperationData) => {
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
        },
        [planting.lifecycleStatus, planting.selectedTask?.sowingLocation],
    );
    return (
        <Stack spacing={3}>
            <RaisedBedSelectedPlantingOwnerControls
                gardenId={gardenId}
                raisedBedId={raisedBedId}
                planting={planting}
            />
            {planting.selectedTask?.status === 'completed' &&
                planting.expectedLifecycleVersionEventId != null &&
                planting.lifecycleStatus !== 'removed' && (
                    <OperationsList
                        gardenId={gardenId}
                        raisedBedId={raisedBedId}
                        plantSortId={planting.plantSortId}
                        plantingTarget={{
                            plantingId: planting.id,
                            expectedPlantSortId: planting.plantSortId,
                            expectedLifecycleVersionEventId:
                                planting.expectedLifecycleVersionEventId,
                        }}
                        filterFunc={filter}
                    />
                )}
        </Stack>
    );
}
