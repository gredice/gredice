import { anchorPriceLabel } from '@gredice/js/pricing';
import type { EntityPriceHistorySummary } from '@gredice/storage';
import { AnchorPrice } from '@gredice/ui/AnchorPrice';
import { shouldShowThirtyDayLowestPrice } from '../../components/attributes/shouldShowThirtyDayLowestPrice';
import { formatPrice } from '../../lib/formatPrice';

export function PricingHistoryReference({
    currentPrice,
    history,
}: {
    currentPrice: number;
    history: EntityPriceHistorySummary | undefined;
}) {
    const showAnchorPrice =
        anchorPriceLabel(currentPrice, history?.anchorPrice) !== null;
    const showThirtyDayLowestPrice =
        history !== undefined &&
        shouldShowThirtyDayLowestPrice(
            currentPrice,
            history.lowestPrice,
            history.anchorPrice?.price,
        );

    if (!showAnchorPrice && !showThirtyDayLowestPrice) {
        return null;
    }

    return (
        <span className="block">
            <AnchorPrice
                currentPrice={currentPrice}
                anchor={history?.anchorPrice}
            />
            {showThirtyDayLowestPrice && history ? (
                <span className="block text-xs font-normal text-muted-foreground">
                    Najniža u 30 dana: {formatPrice(history.lowestPrice)}
                </span>
            ) : null}
        </span>
    );
}
