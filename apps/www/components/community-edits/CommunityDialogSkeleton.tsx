import { Skeleton } from '@gredice/ui/Skeleton';

/** Placeholder for a community dialog form while its fields load. */
export function CommunityDialogSkeleton() {
    return (
        <div className="flex flex-col gap-4" data-community-dialog-skeleton>
            <span className="sr-only" role="status">
                Učitavanje obrasca
            </span>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-28 w-full" />
            <div className="grid gap-3 md:grid-cols-2">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
            </div>
            <Skeleton className="h-10 w-full" />
        </div>
    );
}
