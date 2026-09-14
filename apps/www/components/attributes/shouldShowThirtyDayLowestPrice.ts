import { formatPrice } from '../../lib/formatPrice.ts';

export function shouldShowThirtyDayLowestPrice(
    currentPrice: number,
    lowestPrice: number,
    anchorPrice?: number | null,
) {
    if (
        typeof anchorPrice === 'number' &&
        formatPrice(currentPrice) === formatPrice(anchorPrice)
    ) {
        return false;
    }
    return formatPrice(currentPrice) !== formatPrice(lowestPrice);
}
