import { Skeleton } from '@gredice/ui/Skeleton';
import { Stack } from '@gredice/ui/Stack';

export function ScheduleDayHeaderSkeleton() {
    return (
        <Stack spacing={2}>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-10 w-full" />
        </Stack>
    );
}
