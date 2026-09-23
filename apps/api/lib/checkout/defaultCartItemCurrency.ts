import {
    getShoppingCart,
    getSunflowers,
    upsertOrRemoveCartItem,
    withShoppingCartDefaultCurrencyLock,
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

type LockedCartDependencies = {
    getAvailableSunflowers: () => Promise<number>;
    getCartItemIds: () => Promise<readonly number[] | null>;
    getCartItems: () => Promise<readonly ShoppingCartItemWithShopData[] | null>;
    setCartItemCurrency: (
        cartItemId: number,
        mutation: CartItemMutation,
        currency: 'sunflower',
    ) => Promise<void>;
    upsertCartItem: (mutation: CartItemMutation) => Promise<number | null>;
};

type DefaultCartItemCurrencyDependencies = {
    withLockedCart: <Result>(
        accountId: string,
        cartId: number,
        operation: (dependencies: LockedCartDependencies) => Promise<Result>,
    ) => Promise<Result>;
};

const realDependencies: DefaultCartItemCurrencyDependencies = {
    withLockedCart: (accountId, cartId, operation) =>
        withShoppingCartDefaultCurrencyLock(cartId, async (transaction) => {
            const getCart = () => getShoppingCart(cartId, transaction);
            return operation({
                getAvailableSunflowers: () =>
                    getSunflowers(accountId, transaction),
                getCartItemIds: async () => {
                    const cart = await getCart();
                    return cart?.items.map((item) => item.id) ?? null;
                },
                getCartItems: async () => {
                    const cart = await getCart();
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
                        undefined,
                        false,
                        transaction,
                    );
                },
                upsertCartItem: (mutation) =>
                    upsertOrRemoveCartItem(
                        null,
                        mutation.cartId,
                        mutation.entityId,
                        mutation.entityTypeName,
                        mutation.amount,
                        mutation.gardenId,
                        mutation.raisedBedId,
                        mutation.positionIndex,
                        mutation.additionalData,
                        undefined,
                        undefined,
                        false,
                        transaction,
                    ),
            });
        }),
};

async function applyDefaultNewCartItemCurrencyWhileLocked({
    cartItemId,
    dependencies,
    existingCartItemIds,
    mutation,
}: {
    cartItemId: number | null;
    dependencies: LockedCartDependencies;
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

    const items = await dependencies.getCartItems();
    if (!items) return undefined;

    const appliedCurrency = getDefaultCartItemCurrency({
        availableSunflowers: await dependencies.getAvailableSunflowers(),
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

/**
 * Applies the standard sunflower default to a newly-created cart item. Existing
 * items keep the payment method the user already selected. Affordability reads
 * and the currency update are serialized per cart.
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

    return dependencies.withLockedCart(
        accountId,
        mutation.cartId,
        (lockedDependencies) =>
            applyDefaultNewCartItemCurrencyWhileLocked({
                cartItemId,
                dependencies: lockedDependencies,
                existingCartItemIds,
                mutation,
            }),
    );
}

/**
 * Creates or updates an ordinary cart item and applies the sunflower default
 * in the same transaction. A failed affordability read or currency write rolls
 * back the item mutation so an AI-tool retry can make the same decision again.
 */
export async function upsertCartItemWithDefaultCurrency({
    accountId,
    dependencies = realDependencies,
    mutation,
}: {
    accountId: string;
    dependencies?: DefaultCartItemCurrencyDependencies;
    mutation: CartItemMutation;
}): Promise<{
    appliedCurrency: 'eur' | 'sunflower' | undefined;
    cartItemId: number | null;
}> {
    return dependencies.withLockedCart(
        accountId,
        mutation.cartId,
        async (lockedDependencies) => {
            const existingCartItemIds =
                await lockedDependencies.getCartItemIds();
            if (!existingCartItemIds) {
                throw new Error('Shopping cart not found');
            }

            const cartItemId =
                await lockedDependencies.upsertCartItem(mutation);
            const appliedCurrency =
                await applyDefaultNewCartItemCurrencyWhileLocked({
                    cartItemId,
                    dependencies: lockedDependencies,
                    existingCartItemIds,
                    mutation,
                });

            return { appliedCurrency, cartItemId };
        },
    );
}
