import type {
    OperationStatus,
    RaisedBedFieldPlantCycle,
} from '@gredice/storage';

export type GreenhouseFieldCycleContext = {
    id: number;
    plantCycles?: RaisedBedFieldPlantCycle[] | null;
    plantGrowthDate?: Date | null;
    plantReadyDate?: Date | null;
};

export type GreenhouseOperationCycleCandidate = {
    timestamp: Date;
    status: OperationStatus;
};

export function getActivePlantCycle(field: GreenhouseFieldCycleContext) {
    return field.plantCycles?.find((plantCycle) => plantCycle.active) ?? null;
}

export function isOperationInActivePlantCycle(
    operation: GreenhouseOperationCycleCandidate,
    field: GreenhouseFieldCycleContext,
) {
    if (operation.status === 'canceled') {
        return false;
    }

    const activePlantCycle = getActivePlantCycle(field);
    if (!activePlantCycle) {
        return false;
    }

    return (
        operation.timestamp.getTime() >= activePlantCycle.startedAt.getTime()
    );
}

export function getSeedlingTransplantingOperationTimestamp(
    field: GreenhouseFieldCycleContext,
    now = new Date(),
) {
    return (
        field.plantReadyDate ??
        getActivePlantCycle(field)?.plantReadyDate ??
        field.plantGrowthDate ??
        getActivePlantCycle(field)?.plantGrowthDate ??
        now
    );
}
