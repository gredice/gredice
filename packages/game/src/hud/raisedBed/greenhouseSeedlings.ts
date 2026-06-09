import type { OperationData } from '@gredice/client';
import { useOperations } from '../../hooks/useOperations';
import { useSnapshotTime } from '../../hooks/useSnapshotTime';
import type { RaisedBedFieldPlantHistoryEntry } from '../../utils/raisedBedFields';
import type { PlantLifecycleAttributes } from './PlantLifecycleProgress';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const FALLBACK_GREENHOUSE_REPLANTING_DAYS = 21;

export const SEEDLING_TRANSPLANTING_OPERATION_ID = 593;
export const SEEDLING_TRANSPLANTING_OPERATION_NAMES = [
    'seedlingTranslanting',
    'seedlingTransplanting',
];

export type GreenhouseSeedlingProgressData = {
    germinationValue: number;
    germinationPercentage: number;
    germinatingDays: number;
    seedlingValue: number;
    seedlingPercentage: number;
    seedlingDays: number;
    replantingWindowDays: number;
    expectedReplantingDate: Date | null;
};

const greenhouseSeedlingStatuses = new Set([
    'pendingVerification',
    'sowed',
    'sprouted',
    'readyForTransplanting',
]);

export function isGreenhouseSeedlingField(
    field: RaisedBedFieldPlantHistoryEntry | null | undefined,
) {
    return Boolean(
        field &&
            field.active !== false &&
            field.sowingLocation === 'greenhouse' &&
            greenhouseSeedlingStatuses.has(field.plantStatus ?? '') &&
            !field.plantDeadDate &&
            !field.plantHarvestedDate &&
            !field.plantRemovedDate,
    );
}

export function isSeedlingTransplantingOperation(operation: OperationData) {
    return (
        operation.id === SEEDLING_TRANSPLANTING_OPERATION_ID ||
        SEEDLING_TRANSPLANTING_OPERATION_NAMES.includes(
            operation.information.name,
        )
    );
}

export function getGreenhouseSeedlingReplantingWindowDays(
    transplantOperation: OperationData | null | undefined,
) {
    const relativeDays = transplantOperation?.attributes.relativeDays;
    return typeof relativeDays === 'number' && relativeDays > 0
        ? Math.ceil(relativeDays)
        : FALLBACK_GREENHOUSE_REPLANTING_DAYS;
}

export function useGreenhouseSeedlingProgressData(
    field: RaisedBedFieldPlantHistoryEntry | null | undefined,
    plantAttributes: PlantLifecycleAttributes | null | undefined,
) {
    const { data: operations } = useOperations();
    const now = useSnapshotTime();
    const transplantOperation = operations?.find(
        isSeedlingTransplantingOperation,
    );

    return getGreenhouseSeedlingProgressData({
        field,
        now,
        plantAttributes,
        transplantOperation,
    });
}

export function getGreenhouseSeedlingProgressData({
    field,
    plantAttributes,
    transplantOperation,
    now = new Date(),
}: {
    field: RaisedBedFieldPlantHistoryEntry | null | undefined;
    plantAttributes: PlantLifecycleAttributes | null | undefined;
    transplantOperation?: OperationData | null;
    now?: Date;
}): GreenhouseSeedlingProgressData {
    const replantingWindowDays =
        getGreenhouseSeedlingReplantingWindowDays(transplantOperation);
    const result: GreenhouseSeedlingProgressData = {
        germinationValue: 0,
        germinationPercentage: 50,
        germinatingDays: 0,
        seedlingValue: 0,
        seedlingPercentage: 50,
        seedlingDays: 0,
        replantingWindowDays,
        expectedReplantingDate: null,
    };

    const germinationWindowDays = plantAttributes?.germinationWindowMax ?? 0;
    const totalWindowDays = germinationWindowDays + replantingWindowDays;
    if (totalWindowDays > 0) {
        const germinationPercentage =
            germinationWindowDays > 0
                ? (germinationWindowDays / totalWindowDays) * 100
                : 50;
        result.germinationPercentage = Math.max(
            20,
            Math.min(80, germinationPercentage),
        );
        result.seedlingPercentage = 100 - result.germinationPercentage;
    }

    if (!field) {
        return result;
    }

    const targetDateNow = getDateTime(field.stoppedDate) ?? now.getTime();
    const plantSowTime = getDateTime(field.plantSowDate);
    const plantGrowthTime = getDateTime(field.plantGrowthDate);
    const plantReadyTime = getDateTime(field.plantReadyDate);

    result.germinationValue = plantGrowthTime
        ? 100
        : plantSowTime
          ? Math.min(
                100,
                ((targetDateNow - plantSowTime) /
                    ((germinationWindowDays || 1) * MS_PER_DAY)) *
                    100,
            )
          : 0;
    result.germinatingDays = plantSowTime
        ? daysBetween(plantSowTime, plantGrowthTime ?? targetDateNow)
        : 0;

    result.seedlingValue = plantReadyTime
        ? 100
        : plantGrowthTime
          ? Math.min(
                100,
                ((targetDateNow - plantGrowthTime) /
                    (replantingWindowDays * MS_PER_DAY)) *
                    100,
            )
          : 0;
    result.seedlingDays = plantGrowthTime
        ? daysBetween(plantGrowthTime, plantReadyTime ?? targetDateNow)
        : 0;
    result.expectedReplantingDate = plantGrowthTime
        ? new Date(plantGrowthTime + replantingWindowDays * MS_PER_DAY)
        : null;

    return result;
}

function getDateTime(value: Date | string | null | undefined) {
    if (!value) {
        return null;
    }

    const time = new Date(value).getTime();
    return Number.isNaN(time) ? null : time;
}

function daysBetween(startTime: number, endTime: number) {
    return Math.max(0, Math.round((endTime - startTime) / MS_PER_DAY));
}
