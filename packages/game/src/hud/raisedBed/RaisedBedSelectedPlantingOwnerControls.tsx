'use client';

import { NoDataPlaceholder } from '@gredice/ui/NoDataPlaceholder';
import type { GardenOperationItem } from '../../hooks/useGardenOperations';
import { useLiveTime } from '../../hooks/useLiveTime';
import { usePlantSort } from '../../hooks/usePlantSorts';
import type { SelectedPlantingDiaryTarget } from '../../hooks/useSelectedPlantingOwnerAction';
import { GardenOperationCard } from '../GardenOperationsHud';
import type { AdvancedSowingGardenPlantingVisual } from './advancedSowingGardenVisuals';
import { advancedSowingPlantingFieldsHeading } from './RaisedBedAdvancedSowingPlantingDetails';
import { RaisedBedDiaryCancelAction } from './RaisedBedDiaryCancelAction';
import { RaisedBedDiaryRescheduleAction } from './RaisedBedDiaryRescheduleAction';
import { getSelectedPlantingOwnerActionModel } from './selectedPlantingOwnerActions';

export function RaisedBedSelectedPlantingOwnerControls({
    gardenId,
    planting,
    raisedBedId,
    readOnly = false,
}: {
    gardenId: number;
    planting: AdvancedSowingGardenPlantingVisual;
    raisedBedId: number;
    readOnly?: boolean;
}) {
    const referenceDate = useLiveTime();
    const { data: plantSort } = usePlantSort(planting.plantSortId);
    const actionModel = getSelectedPlantingOwnerActionModel(planting);
    const task = planting.selectedTask;
    if (!task)
        return <NoDataPlaceholder>Nema zabilježenih radnji</NoDataPlaceholder>;

    const status =
        task.status === 'pendingVerification'
            ? 'confirmed'
            : task.status === 'cancelled'
              ? 'canceled'
              : task.status;
    const operation: GardenOperationItem = {
        id: planting.id,
        entityId: planting.plantSortId,
        taskVersionEventId: planting.expectedLifecycleVersionEventId,
        entityTypeName: 'plantSort',
        raisedBedId,
        raisedBedFieldId: null,
        status,
        createdAt: planting.lifecycleStartedAt ?? '',
        scheduledDate: task.scheduledDate,
        scheduledAt: task.scheduledDate,
        completedAt: planting.sowedAt ?? null,
        verifiedAt: null,
        canceledAt: null,
        cancellationReason: null,
        blockedAt: null,
        blockReasonLabel: null,
        blockNote: null,
        blockImageUrls: [],
        imageUrls: [],
        completionNotes: null,
        targetLabel: `${advancedSowingPlantingFieldsHeading(planting)} · ${task.sowingLocation === 'greenhouse' ? 'Staklenik' : 'Izravno u gredicu'}`,
        statusHistory: [],
    };
    const target: SelectedPlantingDiaryTarget | null =
        !readOnly &&
        actionModel.canReschedule &&
        planting.expectedLifecycleVersionEventId !== null
            ? {
                  type: 'selectedPlanting',
                  plantingId: planting.id,
                  raisedBedId,
                  expectedPlantSortId: planting.plantSortId,
                  expectedLifecycleVersionEventId:
                      planting.expectedLifecycleVersionEventId,
                  scheduledDate: task.scheduledDate,
                  sowingLocation: task.sowingLocation,
              }
            : null;
    const entryName = `sijanje ${plantSort?.information.name ?? ''}`.trim();

    return (
        <GardenOperationCard
            operation={operation}
            plantSortData={plantSort ?? undefined}
            referenceDate={referenceDate}
            scheduleAction={
                target ? (
                    <RaisedBedDiaryRescheduleAction
                        entryName={entryName}
                        gardenId={gardenId}
                        target={target}
                    />
                ) : undefined
            }
            cancelAction={
                target ? (
                    <RaisedBedDiaryCancelAction
                        disabledReason={actionModel.cancelDisabledReason}
                        entryName={entryName}
                        gardenId={gardenId}
                        target={target}
                    />
                ) : undefined
            }
        />
    );
}
