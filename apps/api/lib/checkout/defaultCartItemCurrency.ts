import {
    getShoppingCart,
    getSunflowers,
    upsertOrRemoveCartItem,
} from '@gredice/storage';
import { getCartInfo, type ShoppingCartItemWithShopData } from './cartInfo';
import { getDefaultCartItemCurrency } from './sunflowerCalculations';

type CartItemMutation = {
    additionalData?: string | null;
    amount: number;
    cartId: number;
    entityId: string;
    entityTypeName: string;
    gardenId?: number;
    positionIndex?: number;
    raisedBedId?: number;
};

type DefaultCartItemCurrencyDependencies = {
    getAvailableSunflowers: (accountId: string) => Promise<number>;
    getCartItems: (
        cartId: number,
        accountId: string,
    ) => Promise<readonly ShoppingCartItemWithShopData[] | null>;
    setCartItemCurrency: (
        cartItemId: number,
        mutation: CartItemMutation,
        currency: 'sunflower',
    ) => Promise<void>;
};

const realDependencies: DefaultCartItemCurrencyDependencies = {
    getAvailableSunflowers: getSunflowers,
    getCartItems: async (cartId, accountId) => {
        const cart = await getShoppingCart(cartId);
        if (!cart) return null;

        return (await getCartInfo(cart.items, accountId)).items;
    },
    setCartItemCurrency: async (cartItemId, mutation, currency) => {
        await upsertOrRemoveCartItem(
            cartItemId,
            mutation.cartId,
            mutation.entityId,
            mutation.entityTypeName,
            mutation.amount,
            mutation.gardenId,
            mutation.raisedBedId,
            mutation.positionIndex,
            mutation.additionalData,
            currency,
        );
    },
};

/**
 * Applies the standard sunflower default to a newly-created cart item. Existing
 * items keep the payment method the user already selected.
 */
export async function applyDefaultNewCartItemCurrency({
    accountId,
    cartItemId,
    dependencies = realDependencies,
    existingCartItemIds,
    mutation,
}: {
    accountId: string;
    cartItemId: number | null;
    dependencies?: DefaultCartItemCurrencyDependencies;
    existingCartItemIds: readonly number[];
    mutation: CartItemMutation;
}): Promise<'eur' | 'sunflower' | undefined> {
    if (
        cartItemId === null ||
        existingCartItemIds.includes(cartItemId) ||
        mutation.amount <= 0
    ) {
        return undefined;
    }

    const items = await dependencies.getCartItems(mutation.cartId, accountId);
    if (!items) return undefined;

    const appliedCurrency = getDefaultCartItemCurrency({
        availableSunflowers:
            await dependencies.getAvailableSunflowers(accountId),
        items,
        newCartItemId: cartItemId,
    });

    if (appliedCurrency === 'sunflower') {
        await dependencies.setCartItemCurrency(
            cartItemId,
            mutation,
            appliedCurrency,
        );
    }

    return appliedCurrency;
}
