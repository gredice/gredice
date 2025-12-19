import type { ShoppingCartItemWithShopData } from './cartInfo';

/**
 * Calculate the sunflower amount for a cart item based on its shop data.
 * Returns the amount in sunflowers (multiplied by 1000 for precision).
 */
export function calculateSunflowerAmount(
    item: ShoppingCartItemWithShopData,
): number {
    const price =
        typeof item.shopData.discountPrice === 'number'
            ? item.shopData.discountPrice
            : (item.shopData.price ?? 0);
    return Math.round(price * 1000);
}
