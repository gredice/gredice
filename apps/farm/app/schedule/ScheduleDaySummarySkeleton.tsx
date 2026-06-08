import { Row } from '@gredice/ui/Row';
import { Skeleton } from '@gredice/ui/Skeleton';

function SummaryItemSkeleton() {
    return (
        <div className="space-y-1 text-center">
            <Skeleton className="mx-auto h-3 w-6 sm:h-4 sm:w-8" />
            <Skeleton className="mx-auto h-3 w-10 sm:h-4 sm:w-14" />
        </div>
    );
}

export function ScheduleDaySummarySkeleton() {
    return (
        <Row className="gap-1 sm:gap-2">
            <SummaryItemSkeleton />
            <SummaryItemSkeleton />
        </Row>
    );
}
