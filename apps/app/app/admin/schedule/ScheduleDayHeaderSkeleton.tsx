import { Skeleton } from '@signalco/ui-primitives/Skeleton';
import { Stack } from '@signalco/ui-primitives/Stack';

export function ScheduleDayHeaderSkeleton() {
    return (
        <Stack spacing={1}>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-10 w-full" />
        </Stack>
    );
}
