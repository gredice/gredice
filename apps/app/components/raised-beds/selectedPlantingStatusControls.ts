import {
    getImageObservablePlantStatusTargets,
    plantFieldStatusLabel,
} from '@gredice/js/plants';
import type { RaisedBedPlantingWithFields } from '@gredice/storage';

export function getSelectedPlantingStatusControl(
    planting: Pick<
        RaisedBedPlantingWithFields,
        | 'configurationSource'
        | 'isActive'
        | 'lifecycleStatus'
        | 'lifecycleStartedAt'
        | 'lifecycleStatusChanges'
        | 'selectedTask'
    > | null,
) {
    const status = planting?.lifecycleStatus;
    const task = planting?.selectedTask;
    if (
        planting?.configurationSource !== 'selected' ||
        !planting.isActive ||
        task?.status !== 'completed' ||
        !status ||
        status === 'removed' ||
        status === 'cancelled' ||
        status === 'pendingVerification' ||
        status === 'planned'
    )
        return null;
    const targets = new Set([
        status,
        ...getImageObservablePlantStatusTargets(status),
    ]);
    const statuses = [
        'sowed',
        'sprouted',
        'firstFlowers',
        'firstFruitSet',
        'notSprouted',
        'died',
        'ready',
        'harvested',
        'removed',
    ] as const;
    return {
        identity: task.identity,
        status,
        options: statuses
            .filter((target) => targets.has(target))
            .map((target) => {
                const preceding = planting.lifecycleStatusChanges.findLast(
                    (change) => target !== status || change.status !== target,
                );
                const minimumDate =
                    preceding &&
                    preceding.occurredAt > planting.lifecycleStartedAt
                        ? preceding.occurredAt
                        : planting.lifecycleStartedAt;
                return {
                    value: target,
                    label: plantFieldStatusLabel(target).shortLabel,
                    minimumDate: minimumDate.toISOString(),
                };
            }),
        statusDate: (
            planting.lifecycleStatusChanges.at(-1)?.occurredAt ??
            planting.lifecycleStartedAt
        ).toISOString(),
    };
}

export type SelectedPlantingStatusControlModel = NonNullable<
    ReturnType<typeof getSelectedPlantingStatusControl>
>;
