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
    dayDataPromise: Promise<FarmScheduleDayData>;
    operationsDayDataPromise: Promise<FarmScheduleOperationsDayData>;
    plantingsDayDataPromise: Promise<FarmSchedulePlantingsDayData>;
    operationsDataPromise: ReturnType<
        typeof import('./scheduleData').getFarmScheduleOperationsData
    >;
    plantSortsPromise: ReturnType<typeof getFarmSchedulePlantSorts>;
    userId: string;
}

export function FarmScheduleDay({
    dayDataPromise,
    operationsDayDataPromise,
    operationsDataPromise,
    plantingsDayDataPromise,
    plantSortsPromise,
    userId,
}: FarmScheduleDayProps) {
    const raisedBedPhotoPreviewByIdPromise =
        getFarmScheduleRaisedBedPhotoPreviewsForDay(dayDataPromise);

    return (
        <Stack spacing={8}>
            <Suspense fallback={null}>
                <FarmScheduleEmptyState dayDataPromise={dayDataPromise} />
            </Suspense>
            <Suspense fallback={<FarmScheduleSectionSkeleton />}>
                <FarmSchedulePlantingsSectionContent
                    dayDataPromise={plantingsDayDataPromise}
                    plantSortsPromise={plantSortsPromise}
                    raisedBedPhotoPreviewByIdPromise={
                        raisedBedPhotoPreviewByIdPromise
                    }
                    userId={userId}
                />
            </Suspense>
            <Suspense fallback={<FarmScheduleSectionSkeleton />}>
                <FarmScheduleOperationsSectionContent
                    dayDataPromise={operationsDayDataPromise}
                    plantSortsPromise={plantSortsPromise}
                    operationsDataPromise={operationsDataPromise}
                    raisedBedPhotoPreviewByIdPromise={
                        raisedBedPhotoPreviewByIdPromise
                    }
                    userId={userId}
                />
            </Suspense>
        </Stack>
    );
}
