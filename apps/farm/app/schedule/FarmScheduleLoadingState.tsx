import { Skeleton } from '@gredice/ui/Skeleton';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { FarmScheduleSectionSkeleton } from './FarmScheduleSectionSkeleton';
import { ScheduleDaySummarySkeleton } from './ScheduleDaySummarySkeleton';

export function FarmScheduleLoadingState() {
    return (
        <div
            className="max-w-5xl mx-auto w-full space-y-4 px-2 py-4 sm:p-4"
            aria-busy="true"
        >
            <div className="space-y-2">
                <Typography component="h1" level="h5" semiBold>
                    Raspored
                </Typography>
                <div className="grid min-w-0 items-start gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="min-w-0 justify-self-center sm:justify-self-start">
                        <div className="grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-1 sm:gap-2">
                            <Skeleton className="h-8 w-10 rounded-md sm:h-10" />
                            <div className="grid justify-items-center gap-1">
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                            <Skeleton className="h-8 w-10 rounded-md sm:h-10" />
                        </div>
                    </div>
                    <div className="min-w-0 justify-self-stretch sm:justify-self-end">
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
