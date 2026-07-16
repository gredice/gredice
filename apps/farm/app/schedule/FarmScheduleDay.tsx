import { Stack } from '@gredice/ui/Stack';
import { Suspense } from 'react';
import { FarmScheduleEmptyState } from './FarmScheduleEmptyState';
import { FarmScheduleOperationsSectionContent } from './FarmScheduleOperationsSectionContent';
import { FarmSchedulePlantingsSectionContent } from './FarmSchedulePlantingsSectionContent';
import { FarmScheduleSectionSkeleton } from './FarmScheduleSectionSkeleton';
import type {
    FarmScheduleDayData,
    FarmScheduleOperationsDayData,
    FarmSchedulePlantingsDayData,
    getFarmSchedulePlantSorts,
} from './scheduleData';
import { getFarmScheduleRaisedBedPhotoPreviewsForDay } from './scheduleData';

interface FarmScheduleDayProps {
    accountId: string;
    dayDataPromise: Promise<FarmScheduleDayData>;
    operationsDayDataPromise: Promise<FarmScheduleOperationsDayData>;
    plantingsDayDataPromise: Promise<FarmSchedulePlantingsDayData>;
    operationsDataPromise: ReturnType<
        typeof import('./scheduleData').getFarmScheduleOperationsData
    >;
    plantSortsPromise: ReturnType<typeof getFarmSchedulePlantSorts>;
    groupWateringOperations: boolean;
    selectedDateKey: string;
    sessionIncarnation: string;
    userId: string;
}

export function FarmScheduleDay({
    accountId,
    dayDataPromise,
    operationsDayDataPromise,
    operationsDataPromise,
    plantingsDayDataPromise,
    plantSortsPromise,
    groupWateringOperations,
    selectedDateKey,
    sessionIncarnation,
    userId,
}: FarmScheduleDayProps) {
    const raisedBedPhotoPreviewByIdPromise =
        getFarmScheduleRaisedBedPhotoPreviewsForDay(dayDataPromise);

    return (
        <Stack spacing={8}>
            <Suspense fallback={null}>
                <FarmScheduleEmptyState dayDataPromise={dayDataPromise} />
            </Suspense>
            {groupWateringOperations && (
                <Suspense fallback={<FarmScheduleSectionSkeleton />}>
                    <FarmScheduleOperationsSectionContent
                        accountId={accountId}
                        dayDataPromise={operationsDayDataPromise}
                        plantSortsPromise={plantSortsPromise}
                        operationsDataPromise={operationsDataPromise}
                        raisedBedPhotoPreviewByIdPromise={
                            raisedBedPhotoPreviewByIdPromise
                        }
                        mode="watering"
                        selectedDateKey={selectedDateKey}
                        sessionIncarnation={sessionIncarnation}
                        userId={userId}
                    />
                </Suspense>
            )}
            <Suspense fallback={<FarmScheduleSectionSkeleton />}>
                <FarmSchedulePlantingsSectionContent
                    dayDataPromise={plantingsDayDataPromise}
                    plantSortsPromise={plantSortsPromise}
                    raisedBedPhotoPreviewByIdPromise={
                        raisedBedPhotoPreviewByIdPromise
                    }
                    selectedDateKey={selectedDateKey}
                    userId={userId}
                />
            </Suspense>
            <Suspense fallback={<FarmScheduleSectionSkeleton />}>
                <FarmScheduleOperationsSectionContent
                    accountId={accountId}
                    dayDataPromise={operationsDayDataPromise}
                    plantSortsPromise={plantSortsPromise}
                    operationsDataPromise={operationsDataPromise}
                    raisedBedPhotoPreviewByIdPromise={
                        raisedBedPhotoPreviewByIdPromise
                    }
                    mode={groupWateringOperations ? 'withoutWatering' : 'all'}
                    selectedDateKey={selectedDateKey}
                    sessionIncarnation={sessionIncarnation}
                    userId={userId}
                />
            </Suspense>
        </Stack>
    );
}
