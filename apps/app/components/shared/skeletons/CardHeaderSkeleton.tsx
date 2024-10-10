import { CardHeader, CardTitle } from "@signalco/ui-primitives/Card";
import { Skeleton } from "@signalco/ui-primitives/Skeleton";

export function CardHeaderSkeleton() {
    return (
        <CardHeader>
            <CardTitle>
                <Skeleton className="w-32 h-6" />
            </CardTitle>
        </CardHeader>
    );
}
