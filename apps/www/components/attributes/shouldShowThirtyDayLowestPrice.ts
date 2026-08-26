import { formatPrice } from '../../lib/formatPrice.ts';

export function shouldShowThirtyDayLowestPrice(
    currentPrice: number,
    lowestPrice: number,
) {
    return formatPrice(currentPrice) !== formatPrice(lowestPrice);
}
