import { Skeleton } from '@gredice/ui/Skeleton';
import { Stack } from '@gredice/ui/Stack';

export function ScheduleDayOperationsSkeleton() {
    return (
        <Stack spacing={2}>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
        </Stack>
    );
}
