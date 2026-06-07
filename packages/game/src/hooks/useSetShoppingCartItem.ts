import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getEffectiveEurPrice } from '../utils/sunflowerPricing';
import {
    currentAccountKeys,
    type useCurrentAccount,
} from './useCurrentAccount';
import {
    type ShoppingCartData,
    useShoppingCart,
    useShoppingCartQueryKey,
} from './useShoppingCart';

type SetShoppingCartItemInput = {
    id?: number;
    entityTypeName: string;
    entityId: string;
    amount: number;
    gardenId?: number;
    raisedBedId?: number;
    positionIndex?: number;
    additionalData?: string | null;
    currency?: string | null;
    outletOfferId?: number;
    forceCreate?: boolean;
};

type CurrentAccountData = ReturnType<typeof useCurrentAccount>['data'];

function cartItemPrice(item: ShoppingCartData['items'][number]) {
    return getEffectiveEurPrice({
        price: item.shopData.price,
        discountPrice: item.shopData.discountPrice,
    });
}

function isInsufficientSunflowersNote(note: string) {
    return note.startsWith('Nedovoljno suncokreta.');
}

function recalculateCartTotals(
    cart: ShoppingCartData,
    account: CurrentAccountData,
) {
    const total = cart.items
        .filter((item) => item.status !== 'paid' && item.currency === 'eur')
        .reduce((sum, item) => sum + cartItemPrice(item), 0);
    const totalSunflowers = Math.round(
        cart.items
            .filter(
                (item) =>
                    item.status !== 'paid' && item.currency === 'sunflower',
            )
            .reduce((sum, item) => sum + cartItemPrice(item), 0) * 1000,
    );
    const notes = cart.notes ?? [];
    const notesWithoutSunflowerBalance = notes.filter(
        (note) => !isInsufficientSunflowersNote(note),
    );
    const accountSunflowers = account?.sunflowers.amount;

    if (typeof accountSunflowers !== 'number') {
        return {
            ...cart,
            total,
            totalSunflowers,
        };
    }

    const hasEnoughSunflowers = totalSunflowers <= accountSunflowers;
    const cartInfoAllowsPurchase =
        cart.allowPurchase ||
        (notes.some(isInsufficientSunflowersNote) &&
            notesWithoutSunflowerBalance.length === 0);

    return {
        ...cart,
        total,
        totalSunflowers,
        notes: hasEnoughSunflowers
            ? notesWithoutSunflowerBalance
            : [
                  ...notesWithoutSunflowerBalance,
                  `Nedovoljno suncokreta. Potrebno je ${totalSunflowers} 🌻, a imaš samo ${accountSunflowers} 🌻.`,
              ],
        allowPurchase: cartInfoAllowsPurchase && hasEnoughSunflowers,
    };
}

function applyOptimisticShoppingCartItem(
    cart: ShoppingCartData,
    item: SetShoppingCartItemInput,
    account: CurrentAccountData,
) {
    if (item.id == null) {
        return cart;
    }

    let updatedExistingItem = false;
    const nextItems = cart.items.flatMap((cartItem) => {
        if (cartItem.id !== item.id) {
            return [cartItem];
        }

        updatedExistingItem = true;

        if (item.amount <= 0) {
            return [];
        }

        return [
            {
                ...cartItem,
                amount: item.amount,
                additionalData:
                    item.additionalData !== undefined
                        ? item.additionalData
                        : cartItem.additionalData,
                currency:
                    item.currency !== undefined && item.currency !== null
                        ? item.currency
                        : cartItem.currency,
                gardenId:
                    item.gardenId !== undefined
                        ? item.gardenId
                        : cartItem.gardenId,
                raisedBedId:
                    item.raisedBedId !== undefined
                        ? item.raisedBedId
                        : cartItem.raisedBedId,
                positionIndex:
                    item.positionIndex !== undefined
                        ? item.positionIndex
                        : cartItem.positionIndex,
            },
        ];
    });

    if (!updatedExistingItem) {
        return cart;
    }

    return recalculateCartTotals(
        {
            ...cart,
            items: nextItems,
        },
        account,
    );
}

export function useSetShoppingCartItem() {
    const queryClient = useQueryClient();
    const { data: cart } = useShoppingCart();
    return useMutation({
        mutationFn: async (item: SetShoppingCartItemInput) => {
            if (!cart) {
                throw new Error('Shopping cart is not available');
            }

            const response = await clientAuthenticated().api[
                'shopping-cart'
            ].$post({
                json: {
                    ...item,
                    cartId: cart.id,
                },
            });
            if (response.status !== 200) {
                throw new Error('Failed to set shopping cart item');
            }
        },
        onMutate: async (item) => {
            await queryClient.cancelQueries({
                queryKey: useShoppingCartQueryKey,
            });

            const previousCart =
                queryClient.getQueryData<ShoppingCartData | null>(
                    useShoppingCartQueryKey,
                );
            const currentAccount =
                queryClient.getQueryData<CurrentAccountData>(
                    currentAccountKeys,
                );

            if (previousCart) {
                queryClient.setQueryData<ShoppingCartData | null>(
                    useShoppingCartQueryKey,
                    applyOptimisticShoppingCartItem(
                        previousCart,
                        item,
                        currentAccount,
                    ),
                );
            }

            return { previousCart };
        },
        onError: (_error, _item, context) => {
            if (context?.previousCart) {
                queryClient.setQueryData(
                    useShoppingCartQueryKey,
                    context.previousCart,
                );
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({
                queryKey: useShoppingCartQueryKey,
            });
        },
        scope: {
            id: 'setShoppingCartItem',
        },
    });
}
