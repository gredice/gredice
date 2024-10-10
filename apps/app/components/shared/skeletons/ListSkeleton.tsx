import { Skeleton } from "@signalco/ui-primitives/Skeleton";
import { Stack } from "@signalco/ui-primitives/Stack";

export function ListSkeleton() {
    return (
        <Stack spacing={1}>
            {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-48" />
            ))}
        </Stack>
    );
}
