import {
    getHistoryDotClassName,
    getStatusLabel,
} from '../lib/status/statusDisplay';
import type { CheckHistoryItem } from '../lib/status/types';

type ServiceHistoryProps = {
    history: CheckHistoryItem[];
};

export function ServiceHistory({ history }: ServiceHistoryProps) {
    if (history.length === 0) {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-3 w-3 animate-pulse rounded-full bg-[#c5cbc0] dark:bg-[#59616b]" />
                Povijest će se prikazati nakon prvih provjera.
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1.5">
            {history.map((item) => (
                <span
                    key={item.id}
                    className={`h-7 w-3 rounded-full ${getHistoryDotClassName(item.status)}`}
                    title={getStatusLabel(item.status)}
                />
            ))}
        </div>
    );
}
