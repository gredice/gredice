import { Skeleton } from '@gredice/ui/Skeleton';
import { Stack } from '@gredice/ui/Stack';

interface ScheduleDayHeaderSkeletonProps {
    compact?: boolean;
}

export function ScheduleDayHeaderSkeleton({
    compact,
}: ScheduleDayHeaderSkeletonProps) {
    if (compact) {
        return (
            <div className="flex items-center justify-end gap-2">
                <Skeleton className="h-7 w-7 rounded-md" />
                <Skeleton className="h-8 w-44 rounded-md" />
            </div>
        );
    }

    return (
        <Stack spacing={2}>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-10 w-full" />
        </Stack>
    );
}
