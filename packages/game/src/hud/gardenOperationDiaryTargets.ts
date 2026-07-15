import type { GardenOperationItem } from '../hooks/useGardenOperations';
import type { DiaryRescheduleTarget } from '../hooks/useRescheduleDiaryEntry';

export function buildGardenOperationDiaryTarget(
    operation: GardenOperationItem,
    positionIndex: number | undefined,
): DiaryRescheduleTarget | null {
    if (
        operation.entityTypeName === 'operation' &&
        typeof operation.taskVersionEventId === 'number' &&
        operation.taskVersionEventId >= 0
    ) {
        return {
            type: 'operation',
            expectedEntityId: operation.entityId,
            expectedTaskVersionEventId: operation.taskVersionEventId,
            operationId: operation.id,
            raisedBedId: operation.raisedBedId,
            raisedBedFieldId: operation.raisedBedFieldId,
            positionIndex,
            scheduledDate: operation.scheduledDate,
        };
    }

    if (
        operation.entityTypeName === 'plantSort' &&
        operation.id < 0 &&
        operation.raisedBedId &&
        typeof positionIndex === 'number' &&
        typeof operation.taskVersionEventId === 'number' &&
        operation.taskVersionEventId > 0
    ) {
        return {
            type: 'raisedBedFieldPlant',
            expectedPlantCycleEventId: -operation.id,
            expectedPlantCycleVersionEventId: operation.taskVersionEventId,
            expectedPlantSortId: operation.entityId,
            raisedBedId: operation.raisedBedId,
            positionIndex,
            scheduledDate: operation.scheduledDate,
        };
    }

    return null;
}
