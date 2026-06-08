import { Row } from '@gredice/ui/Row';
import { Skeleton } from '@gredice/ui/Skeleton';

function SummaryItemSkeleton() {
    return (
        <div className="text-center space-y-1">
            <Skeleton className="mx-auto h-4 w-8" />
            <Skeleton className="mx-auto h-4 w-14" />
        </div>
    );
}

export function ScheduleDaySummarySkeleton() {
    return (
        <Row spacing={2}>
            <SummaryItemSkeleton />
            <SummaryItemSkeleton />
        </Row>
    );
}
