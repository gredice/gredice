import { getImageObservablePlantStatusTargets } from '@gredice/js/plants';
import type {
    ApprovalRequest,
    RaisedBedPlantOccupancy,
} from '@gredice/storage';

export function getSelectedPlantStateRequestIdentity(
    plant: RaisedBedPlantOccupancy,
) {
    const planting = plant.planting;
    if (
        !planting?.isActive ||
        planting.isDeleted ||
        planting.selectedTask?.status !== 'completed' ||
        plant.plantStatus === 'removed' ||
        !getImageObservablePlantStatusTargets(plant.plantStatus).length
    )
        return undefined;
    return planting.selectedTask.identity;
}

type Planting = NonNullable<RaisedBedPlantOccupancy['planting']>;
type LegacyField = NonNullable<RaisedBedPlantOccupancy['legacyField']>;
type RequestPlant = Pick<
    RaisedBedPlantOccupancy,
    'plantSortId' | 'plantStatus' | 'positionIndex'
> & {
    planting: Pick<Planting, 'id' | 'lifecycleVersionEventId'> | null;
    legacyField: {
        id: LegacyField['id'];
        plantCycles: Pick<
            LegacyField['plantCycles'][number],
            'active' | 'plantPlaceEventId' | 'endedEventId'
        >[];
    } | null;
};

export function getPendingPlantStateRequestStatus(
    requests: ApprovalRequest[],
    raisedBedId: number,
    plant: RequestPlant,
) {
    const cycle = plant.legacyField?.plantCycles.find((cycle) => cycle.active);
    return requests.find((request) => {
        const target = request.target;
        if (
            request.status !== 'pending' ||
            target.raisedBedId !== raisedBedId ||
            target.plantSortId !== plant.plantSortId ||
            target.currentStatus !== plant.plantStatus
        )
            return false;
        if (target.kind === 'raisedBedPlanting.plantStatus') {
            return (
                target.plantingId === plant.planting?.id &&
                target.lifecycleVersionEventId ===
                    plant.planting?.lifecycleVersionEventId
            );
        }
        return Boolean(
            cycle &&
                target.positionIndex === plant.positionIndex &&
                target.raisedBedFieldId === plant.legacyField?.id &&
                target.plantCycleEventId === cycle.plantPlaceEventId &&
                target.plantCycleVersionEventId === cycle.endedEventId,
        );
    })?.target.requestedStatus;
}
