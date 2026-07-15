import { Skeleton } from '@gredice/ui/Skeleton';

function SummaryItemSkeleton() {
    return (
        <div className="min-w-0 space-y-1 text-center">
            <Skeleton className="mx-auto h-3 w-6 sm:h-4 sm:w-8" />
            <Skeleton className="mx-auto h-3 w-10 sm:h-4 sm:w-14" />
        </div>
    );
}

export function ScheduleDaySummarySkeleton() {
    return (
        <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(4.5rem,1fr))] items-start gap-2 sm:flex sm:w-auto sm:justify-end">
            <SummaryItemSkeleton />
            <SummaryItemSkeleton />
            <SummaryItemSkeleton />
            <SummaryItemSkeleton />
        </div>
    );
}
