import { Skeleton } from '@signalco/ui-primitives/Skeleton';
import { Stack } from '@signalco/ui-primitives/Stack';

export function ScheduleDayPlantingsSkeleton() {
    return (
        <Stack spacing={1}>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
        </Stack>
    );
}
