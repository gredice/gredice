import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { handleOptimisticUpdate } from '../helpers/queryHelpers';
import { useGameState } from '../useGameState';
import { currentAccountKeys } from './useCurrentAccount';
import { currentGardenKeys, useCurrentGarden } from './useCurrentGarden';
import {
    type ShoppingCartData,
    useShoppingCart,
    useShoppingCartQueryKey,
} from './useShoppingCart';

const mutationKey = ['gardens', 'current', 'useBlockRecycle'];

async function removeShoppingCartItems(
    shoppingCart: ShoppingCartData,
    raisedBedId: number,
) {
    const cartId = shoppingCart.id;
    const itemsToRemove = shoppingCart.items.filter(
        (item) => item.raisedBedId === raisedBedId,
    );
    await Promise.all(
        itemsToRemove.map((item) =>
            clientAuthenticated().api['shopping-cart'].$post({
                json: {
                    id: item.id,
                    entityTypeName: item.entityTypeName,
                    entityId: item.entityId,
                    amount: 0,
                    cartId,
                },
            }),
        ),
    );
}

export function useBlockRecycle() {
    const queryClient = useQueryClient();
    const { data: garden } = useCurrentGarden();
    const { data: shoppingCart } = useShoppingCart();
    const winterMode = useGameState((state) => state.winterMode);
    const gardenQueryKey = currentGardenKeys(winterMode, garden?.id);

    return useMutation({
        mutationKey,
        mutationFn: async ({
            position,
            blockIndex,
            raisedBedId,
            attached,
        }: {
            position: { x: number; z: number };
            blockIndex: number;
            raisedBedId?: number;
            attached?: {
                position: { x: number; z: number };
                blockIndex: number;
            };
        }) => {
            console.debug('Recycling block', position, blockIndex);
            if (!garden) {
                throw new Error('No garden selected');
            }
            const gardenId = garden.id;
            await clientAuthenticated().api.gardens[':gardenId'].stacks.$patch({
                param: {
                    gardenId: gardenId.toString(),
                },
                json: [
                    {
                        op: 'remove',
                        path: `/${position.x}/${position.z}/${blockIndex}`,
                    },
                    ...(attached
                        ? [
                              {
                                  op: 'remove' as const,
                                  path: `/${attached.position.x}/${attached.position.z}/${attached.blockIndex}`,
                              },
                          ]
                        : []),
                ],
            });

            if (shoppingCart && raisedBedId) {
                await removeShoppingCartItems(shoppingCart, raisedBedId);
            }
        },
        onMutate: async ({ position, blockIndex, raisedBedId, attached }) => {
            if (!garden) {
                return;
            }

            // Optimistically remove from source stack
            const updatedStacks = garden.stacks.map((stack) => {
                const isSourceStack =
                    stack.position.x === position.x &&
                    stack.position.z === position.z;
                const isAttachedStack =
                    attached !== undefined &&
                    stack.position.x === attached.position.x &&
                    stack.position.z === attached.position.z;

                if (isSourceStack || isAttachedStack) {
                    return {
                        ...stack,
                        blocks: stack.blocks.filter((_, index) => {
                            if (isSourceStack && index === blockIndex) {
                                return false;
                            }
                            if (
                                isAttachedStack &&
                                attached &&
                                index === attached.blockIndex
                            ) {
                                return false;
                            }
                            return true;
                        }),
                    };
                }
                return stack;
            });

            const previousItem = await handleOptimisticUpdate(
                queryClient,
                gardenQueryKey,
                {
                    stacks: [...updatedStacks],
                },
            );

            // Optimistically remove from shopping cart if raisedBedId is provided
            let previousShoppingCart: ShoppingCartData | undefined;
            if (raisedBedId) {
                previousShoppingCart =
                    queryClient.getQueryData<ShoppingCartData>(
                        useShoppingCartQueryKey,
                    );
                if (previousShoppingCart) {
                    queryClient.setQueryData(useShoppingCartQueryKey, {
                        ...previousShoppingCart,
                        items: previousShoppingCart.items.filter(
                            (item) => item.raisedBedId !== raisedBedId,
                        ),
                    });
                }
            }

            return {
                previousItem,
                previousShoppingCart,
            };
        },
        onError: (error, _variables, context) => {
            console.error('Error removing block', error);
            if (context?.previousItem) {
                queryClient.setQueryData(gardenQueryKey, context.previousItem);
            }
            if (context?.previousShoppingCart) {
                queryClient.setQueryData(
                    useShoppingCartQueryKey,
                    context.previousShoppingCart,
                );
            }
        },
        onSettled: async (_data, _error, variables) => {
            // Invalidate queries only on last mutation
            if (queryClient.isMutating({ mutationKey }) === 1) {
                await queryClient.invalidateQueries({
                    queryKey: gardenQueryKey,
                });
                queryClient.invalidateQueries({ queryKey: currentAccountKeys });
                if (variables.raisedBedId) {
                    queryClient.invalidateQueries({
                        queryKey: useShoppingCartQueryKey,
                    });
                }
            }
        },
    });
}
