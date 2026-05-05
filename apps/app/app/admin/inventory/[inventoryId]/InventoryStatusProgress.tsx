import { Typography } from '@signalco/ui-primitives/Typography';

type InventoryStatusProgressProps = {
    items: {
        quantity: number;
        lowCountThreshold: number | null;
    }[];
    defaultLowCountThreshold: number | null;
    compact?: boolean;
};

function formatItemsCount(count: number) {
    return count === 1 ? '1 stavka' : `${count} stavki`;
}

function getInventoryStatusCounts({
    items,
    defaultLowCountThreshold,
}: InventoryStatusProgressProps) {
    return items.reduce(
        (counts, item) => {
            const minimumQuantity =
                item.lowCountThreshold ?? defaultLowCountThreshold;

            if (item.quantity === 0) {
                counts.empty += 1;
            } else if (
                minimumQuantity !== null &&
                item.quantity <= minimumQuantity
            ) {
                counts.low += 1;
            } else {
                counts.normal += 1;
            }

            return counts;
        },
        {
            empty: 0,
            low: 0,
            normal: 0,
        },
    );
}

export function InventoryStatusProgress({
    items,
    defaultLowCountThreshold,
    compact = false,
}: InventoryStatusProgressProps) {
    const counts = getInventoryStatusCounts({
        items,
        defaultLowCountThreshold,
    });
    const totalItems = items.length;
    const statuses = [
        {
            label: 'Prazno',
            description: 'Količina je 0',
            count: counts.empty,
            barClassName: 'bg-red-500',
            dotClassName: 'bg-red-500',
        },
        {
            label: 'Nisko',
            description: 'Količina je na ili ispod minimuma',
            count: counts.low,
            barClassName: 'bg-amber-400',
            dotClassName: 'bg-amber-400',
        },
        {
            label: 'Uredno',
            description: 'Količina je iznad minimuma',
            count: counts.normal,
            barClassName: 'bg-green-500',
            dotClassName: 'bg-green-500',
        },
    ];

    return (
        <div className={compact ? undefined : 'space-y-3'}>
            <div
                className={`flex overflow-hidden rounded-full bg-muted ${compact ? 'h-2' : 'h-3'}`}
                aria-label={`Status zalihe: ${statuses
                    .map((status) => `${status.label} ${status.count}`)
                    .join(', ')}`}
                role="img"
            >
                {statuses.map((status) => {
                    const width =
                        totalItems > 0 ? (status.count / totalItems) * 100 : 0;

                    return status.count > 0 ? (
                        <div
                            key={status.label}
                            className={status.barClassName}
                            style={{ width: `${width}%` }}
                            title={`${status.label}: ${formatItemsCount(
                                status.count,
                            )}`}
                        />
                    ) : null;
                })}
            </div>

            {!compact && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {statuses.map((status) => {
                        const percentage =
                            totalItems > 0
                                ? Math.round((status.count / totalItems) * 100)
                                : 0;

                        return (
                            <div key={status.label} className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`size-2 rounded-full ${status.dotClassName}`}
                                        aria-hidden
                                    />
                                    <Typography level="body2" semiBold>
                                        {status.label}
                                    </Typography>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <Typography level="body1" semiBold>
                                        {status.count}
                                    </Typography>
                                    <Typography level="body2" secondary>
                                        {percentage}%
                                    </Typography>
                                </div>
                                <Typography level="body2" secondary>
                                    {status.description}
                                </Typography>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
