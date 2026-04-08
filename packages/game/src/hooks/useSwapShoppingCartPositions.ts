import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    type ShoppingCartData,
    type ShoppingCartItemData,
    useShoppingCart,
    useShoppingCartQueryKey,
} from './useShoppingCart';

export function useSwapShoppingCartPositions() {
    const queryClient = useQueryClient();
    const { data: cart } = useShoppingCart();

    return useMutation({
        mutationFn: async ({
            itemA,
            itemB,
            targetPositionIndex,
        }: {
            itemA: ShoppingCartItemData;
            itemB?: ShoppingCartItemData;
            targetPositionIndex: number;
        }) => {
            if (!cart) {
                throw new Error('Shopping cart is not available');
            }

            // Update item A to the target position
            await clientAuthenticated().api['shopping-cart'].$post({
                json: {
                    id: itemA.id,
                    cartId: cart.id,
                    entityTypeName: itemA.entityTypeName,
                    entityId: itemA.entityId,
                    amount: itemA.amount,
                    gardenId: itemA.gardenId ?? undefined,
                    raisedBedId: itemA.raisedBedId ?? undefined,
                    positionIndex: targetPositionIndex,
                    additionalData: itemA.additionalData,
                    currency: itemA.currency,
                },
            });

            // If swapping with an existing item, update item B to item A's position
            if (itemB) {
                await clientAuthenticated().api['shopping-cart'].$post({
                    json: {
                        id: itemB.id,
                        cartId: cart.id,
                        entityTypeName: itemB.entityTypeName,
                        entityId: itemB.entityId,
                        amount: itemB.amount,
                        gardenId: itemB.gardenId ?? undefined,
                        raisedBedId: itemB.raisedBedId ?? undefined,
                        positionIndex: itemA.positionIndex ?? undefined,
                        additionalData: itemB.additionalData,
                        currency: itemB.currency,
                    },
                });
            }
        },
        onMutate: async ({ itemA, itemB, targetPositionIndex }) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({
                queryKey: useShoppingCartQueryKey,
            });

            // Snapshot the previous value
            const previousCart = queryClient.getQueryData<ShoppingCartData>(
                useShoppingCartQueryKey,
            );

            // Optimistically update the cache by swapping positions
            if (previousCart) {
                queryClient.setQueryData<ShoppingCartData>(
                    useShoppingCartQueryKey,
                    {
                        ...previousCart,
                        items: previousCart.items.map((item) => {
                            if (item.id === itemA.id) {
                                return {
                                    ...item,
                                    positionIndex: targetPositionIndex,
                                };
                            }
                            if (itemB && item.id === itemB.id) {
                                return {
                                    ...item,
                                    positionIndex: itemA.positionIndex,
                                };
                            }
                            return item;
                        }),
                    },
                );
            }

            return { previousCart };
        },
        onError: (_err, _variables, context) => {
            // Roll back to the previous value on error
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
            id: 'swapShoppingCartPositions',
        },
    });
}
