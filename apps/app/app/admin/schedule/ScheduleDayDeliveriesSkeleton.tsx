import { Skeleton } from '@signalco/ui-primitives/Skeleton';
import { Stack } from '@signalco/ui-primitives/Stack';

export function ScheduleDayDeliveriesSkeleton() {
    return (
        <Stack spacing={1}>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-10 w-full" />
        </Stack>
    );
}
