import type { getAllRaisedBeds } from '@gredice/storage';
import type { AdminApprovalTask } from './approvalTasks';

type Bed = Awaited<ReturnType<typeof getAllRaisedBeds>>[number];

export function buildSelectedPlantingApprovalTasks(raisedBeds: readonly Bed[]) {
    return raisedBeds.flatMap((bed) =>
        (bed.plantings ?? []).flatMap(
            (
                planting,
            ): Extract<
                AdminApprovalTask,
                { kind: 'selectedPlantingVerification' }
            >[] => {
                const task = planting.selectedTask;
                if (
                    bed.status === 'abandoned' ||
                    planting.configurationSource !== 'selected' ||
                    !planting.isActive ||
                    planting.isDeleted ||
                    task?.status !== 'pendingVerification'
                )
                    return [];
                const positions = planting.memberships
                    .filter((m) => !m.isDeleted && !m.raisedBedField.isDeleted)
                    .map((m) => m.raisedBedField.positionIndex + 1)
                    .sort((a, b) => a - b);
                if (!positions.length || !task.completion) return [];
                return [
                    {
                        id: `selected-planting:${planting.id}`,
                        kind: 'selectedPlantingVerification',
                        identity: task.identity,
                        title: 'Verifikacija sijanja',
                        description: `${positions.length === 1 ? 'Polje' : 'Polja'} ${positions.join(', ')}`,
                        receivedAt: new Date(task.completion.completedAt),
                        accountId: bed.accountId,
                        gardenId: bed.gardenId,
                        raisedBedId: bed.id,
                        raisedBedPhysicalId: bed.physicalId,
                        positionIndex: planting.anchorPositionIndex,
                    },
                ];
            },
        ),
    );
}
