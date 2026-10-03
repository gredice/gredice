import type { ShoppingCartItemWithShopData } from './cartInfo';

type ShoppingCartItemForSunflowerCalculation = Pick<
    ShoppingCartItemWithShopData,
    'amount' | 'currency' | 'id' | 'shopData' | 'status'
>;

/**
 * Calculate the sunflower amount for every unit of a cart item.
 * Returns the amount in sunflowers (multiplied by 1000 for precision).
 */
export function calculateSunflowerAmount(
    item: Pick<ShoppingCartItemWithShopData, 'amount' | 'shopData'>,
): number {
    const price =
        typeof item.shopData.discountPrice === 'number'
            ? item.shopData.discountPrice
            : (item.shopData.price ?? 0);
    return Math.round(price * 1000) * item.amount;
}

export function getDefaultCartItemCurrency({
    availableSunflowers,
    items,
    newCartItemId,
}: {
    availableSunflowers: number;
    items: readonly ShoppingCartItemForSunflowerCalculation[];
    newCartItemId: number;
}): 'eur' | 'sunflower' {
    const newItem = items.find((item) => item.id === newCartItemId);
    if (!newItem || newItem.status === 'paid') {
        return 'eur';
    }

    const newItemSunflowers = calculateSunflowerAmount(newItem);
    if (newItemSunflowers <= 0) {
        return 'eur';
    }

    const committedSunflowers = items
        .filter(
            (item) =>
                item.id !== newCartItemId &&
                item.status !== 'paid' &&
                item.currency === 'sunflower',
        )
        .reduce((total, item) => total + calculateSunflowerAmount(item), 0);

    return committedSunflowers + newItemSunflowers <= availableSunflowers
        ? 'sunflower'
        : 'eur';
}
