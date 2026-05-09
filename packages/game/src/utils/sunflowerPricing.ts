export function getEffectiveEurPrice({
    price,
    discountPrice,
}: {
    price: number | null | undefined;
    discountPrice?: number | null;
}): number {
    if (typeof discountPrice === 'number') {
        return discountPrice;
    }

    return price ?? 0;
}

export function calculateSunflowerAmountFromPrices({
    price,
    discountPrice,
}: {
    price: number | null | undefined;
    discountPrice?: number | null;
}): number {
    const effectivePrice = getEffectiveEurPrice({ price, discountPrice });
    return Math.round(effectivePrice * 1000);
}
