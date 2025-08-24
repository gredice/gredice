import { Skeleton } from '@signalco/ui-primitives/Skeleton';

export function OperationListItemSkeleton() {
    return (
        <div className="p-2 flex flex-row gap-2">
            <Skeleton className="w-12 h-12" />
            <div className="flex flex-col gap-1">
                <Skeleton className="w-32 h-6" />
                <Skeleton className="w-44 h-5" />
            </div>
        </div>
    );
}
