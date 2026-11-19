import { Skeleton } from '@gredice/ui/Skeleton';

export function MySuggestionsSkeleton() {
    return (
        <div className="space-y-3">
            <span className="sr-only" role="status">
                Učitavanje prijedloga
            </span>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
        </div>
    );
}
