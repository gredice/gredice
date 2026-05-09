import { Skeleton } from '@signalco/ui-primitives/Skeleton';
import { Stack } from '@signalco/ui-primitives/Stack';

export function FarmScheduleSectionSkeleton() {
    return (
        <Stack spacing={2} className="px-6 pb-6">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
        </Stack>
    );
}
