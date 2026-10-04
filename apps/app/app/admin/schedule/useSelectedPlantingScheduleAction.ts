'use client';

import type { SelectedRaisedBedPlantingTaskCommandIdentity } from '@gredice/storage';
import { useOptimisticScheduleActions } from './useOptimisticScheduleActions';

export function useSelectedPlantingScheduleAction(
    identity: SelectedRaisedBedPlantingTaskCommandIdentity,
) {
    const { runScheduleAction } = useOptimisticScheduleActions();
    return <T>(
        action: (
            currentIdentity: SelectedRaisedBedPlantingTaskCommandIdentity,
        ) => Promise<T>,
    ) =>
        runScheduleAction(
            [`selectedPlanting:${identity.plantingId}`],
            (getVersion) =>
                action({
                    ...identity,
                    expectedLifecycleVersionEventId: getVersion(
                        `selectedPlanting:${identity.plantingId}`,
                        identity.expectedLifecycleVersionEventId,
                    ),
                }),
        );
}
