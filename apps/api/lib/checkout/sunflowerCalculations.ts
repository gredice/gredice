import type { ShoppingCartItemWithShopData } from './cartInfo';

type ShoppingCartItemForSunflowerCalculation = Pick<
    ShoppingCartItemWithShopData,
    'currency' | 'id' | 'shopData' | 'status'
>;

/**
 * Calculate the sunflower amount for a cart item based on its shop data.
 * Returns the amount in sunflowers (multiplied by 1000 for precision).
 */
export function calculateSunflowerAmount(
    item: Pick<ShoppingCartItemWithShopData, 'shopData'>,
): number {
    const price =
        typeof item.shopData.discountPrice === 'number'
            ? item.shopData.discountPrice
            : (item.shopData.price ?? 0);
    return Math.round(price * 1000);
}

/**
 * Reconstructs the candidate amount for a durable checkout replay. Paid cart
 * items are represented with a zero discount by getCartInfo, so their
 * checkout amount must come from the captured outlet price or the base price.
 * The durable spend event remains authoritative when one already exists.
 */
export function calculateSunflowerReplayAmount(item: {
    outlet?: { outletPrice: number };
    shopData: { discountPrice?: number; price?: number };
    status: string;
}): number {
    if (item.status !== 'paid') {
        return calculateSunflowerAmount(item);
    }

    const price = item.outlet?.outletPrice ?? item.shopData.price ?? 0;
    return Math.round(price * 1000);
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
