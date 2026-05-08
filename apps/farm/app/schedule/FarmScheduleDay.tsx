import { Stack } from '@signalco/ui-primitives/Stack';
import { Suspense } from 'react';
import { FarmScheduleEmptyState } from './FarmScheduleEmptyState';
import { FarmScheduleOperationsSectionContent } from './FarmScheduleOperationsSectionContent';
import { FarmSchedulePlantingsSectionContent } from './FarmSchedulePlantingsSectionContent';
import { FarmScheduleSectionSkeleton } from './FarmScheduleSectionSkeleton';
import {
    type FarmScheduleDayData,
    getFarmSchedulePlantSorts,
} from './scheduleData';

interface FarmScheduleDayProps {
    dayDataPromise: Promise<FarmScheduleDayData>;
    operationsDataPromise: ReturnType<
        typeof import('./scheduleData').getFarmScheduleOperationsData
    >;
    userId: string;
}

export function FarmScheduleDay({
    dayDataPromise,
    operationsDataPromise,
    userId,
}: FarmScheduleDayProps) {
    const plantSortsPromise = getFarmSchedulePlantSorts();

    return (
        <Stack spacing={4}>
            <Suspense fallback={null}>
                <FarmScheduleEmptyState dayDataPromise={dayDataPromise} />
            </Suspense>
            <Suspense fallback={<FarmScheduleSectionSkeleton />}>
                <FarmSchedulePlantingsSectionContent
                    dayDataPromise={dayDataPromise}
                    plantSortsPromise={plantSortsPromise}
                    userId={userId}
                />
            </Suspense>
            <Suspense fallback={<FarmScheduleSectionSkeleton />}>
                <FarmScheduleOperationsSectionContent
                    dayDataPromise={dayDataPromise}
                    plantSortsPromise={plantSortsPromise}
                    operationsDataPromise={operationsDataPromise}
                    userId={userId}
                />
            </Suspense>
        </Stack>
    );
}
