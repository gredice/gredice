import { Row } from '@signalco/ui-primitives/Row';
import { Skeleton } from '@signalco/ui-primitives/Skeleton';

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
        <Row spacing={4}>
            <SummaryItemSkeleton />
            <SummaryItemSkeleton />
            <SummaryItemSkeleton />
        </Row>
    );
}
