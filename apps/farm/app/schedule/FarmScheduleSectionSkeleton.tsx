import { Skeleton } from '@gredice/ui/Skeleton';
import { Stack } from '@gredice/ui/Stack';

export function FarmScheduleSectionSkeleton() {
    return (
        <Stack spacing={4} className="px-6 pb-6">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
        </Stack>
    );
}
