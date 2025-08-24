import { CardContent } from '@signalco/ui-primitives/Card';
import { ListSkeleton } from './ListSkeleton';

export function CardContentListSkeleton() {
    return (
        <CardContent>
            <ListSkeleton />
        </CardContent>
    );
}
