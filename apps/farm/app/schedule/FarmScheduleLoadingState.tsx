import { Skeleton } from '@gredice/ui/Skeleton';
import { Stack } from '@gredice/ui/Stack';
import { FarmScheduleSectionSkeleton } from './FarmScheduleSectionSkeleton';
import { ScheduleDaySummarySkeleton } from './ScheduleDaySummarySkeleton';

export function FarmScheduleLoadingState() {
    return (
        <div
            className="max-w-5xl mx-auto w-full space-y-4 px-2 py-4 sm:p-4"
            aria-busy="true"
        >
            <div className="space-y-2">
                <div className="grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-start gap-1 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-2">
                    <Skeleton className="h-8 w-10 rounded-md sm:h-10 sm:w-12" />
                    <div className="grid justify-items-center gap-1">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-24" />
                    </div>
                    <div className="col-span-3 min-w-0 justify-self-stretch sm:col-span-1 sm:justify-self-end">
                        <ScheduleDaySummarySkeleton />
                    </div>
                </div>
                <div className="flex justify-end">
                    <Skeleton className="h-8 w-24 rounded-md" />
                </div>
            </div>
            <Stack spacing={8}>
                <FarmScheduleSectionSkeleton />
                <FarmScheduleSectionSkeleton />
                <FarmScheduleSectionSkeleton />
            </Stack>
        </div>
    );
}
