import type { EntityPriceHistorySummary } from '@gredice/storage';
import { formatPrice } from '../../lib/formatPrice';

const changeDateFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Zagreb',
});

export function ThirtyDayMinimumPrice({
    currentPrice,
    history,
}: {
    currentPrice: number;
    history: EntityPriceHistorySummary | undefined;
}) {
    const lowestPrice = history?.lowestPrice ?? currentPrice;

    return (
        <span className="block whitespace-nowrap">
            <span className="block font-medium">
                {formatPrice(lowestPrice)}
            </span>
            {history?.lastChangedAt && (
                <span className="block text-xs font-normal text-muted-foreground">
                    Promjena:{' '}
                    <time dateTime={history.lastChangedAt.toISOString()}>
                        {changeDateFormatter.format(history.lastChangedAt)}
                    </time>
                </span>
            )}
        </span>
    );
}
