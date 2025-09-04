import { client } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { handleOptimisticUpdate } from '../helpers/queryHelpers';
import { currentAccountKeys } from './useCurrentAccount';
import { currentGardenKeys, useCurrentGarden } from './useCurrentGarden';
import {
    type ShoppingCartData,
    useShoppingCart,
    useShoppingCartQueryKey,
} from './useShoppingCart';

const mutationKey = ['gardens', 'current', 'useBlockRecycle'];

export function useBlockRecycle() {
    const queryClient = useQueryClient();
    const { data: garden } = useCurrentGarden();
    const { data: shoppingCart } = useShoppingCart();
    return useMutation({
        mutationKey,
        mutationFn: async ({
            position,
            blockIndex,
            raisedBedId,
        }: {
            position: { x: number; z: number };
            blockIndex: number;
            raisedBedId?: number;
        }) => {
            console.debug('Recycling block', position, blockIndex);
            if (!garden) {
                throw new Error('No garden selected');
            }
            const gardenId = garden.id;
            await client().api.gardens[':gardenId'].stacks.$patch({
                param: {
                    gardenId: gardenId.toString(),
                },
                json: [
                    {
                        op: 'remove',
                        path: `/${position.x}/${position.z}/${blockIndex}`,
                    },
                ],
            });

            if (raisedBedId && shoppingCart) {
                const cartId = shoppingCart.id;
                const itemsToRemove = shoppingCart.items.filter(
                    (item) => item.raisedBedId === raisedBedId,
                );
                for (const item of itemsToRemove) {
                    await client().api['shopping-cart'].$post({
                        json: {
                            id: item.id,
                            entityTypeName: item.entityTypeName,
                            entityId: item.entityId,
                            amount: 0,
                            cartId,
                        },
                    });
                }
            }
        },
        onMutate: async ({ position, blockIndex, raisedBedId }) => {
            if (!garden) {
                return;
            }

            // Finds the source stack based on position
            const sourceStack = garden.stacks.find(
                (stack) =>
                    stack.position.x === position.x &&
                    stack.position.z === position.z,
            );
            if (!sourceStack) {
                return;
            }

            // Optimistically remove from source stack
            const updatedStacks = garden.stacks.map((stack) => {
                if (
                    stack.position.x === sourceStack.position.x &&
                    stack.position.z === sourceStack.position.z
                ) {
                    return {
                        ...stack,
                        blocks: stack.blocks.filter(
                            (_, index) => index !== blockIndex,
                        ),
                    };
                }
                return stack;
            });

            const previousItem = await handleOptimisticUpdate(
                queryClient,
                currentGardenKeys,
                {
                    stacks: [...updatedStacks],
                },
            );

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
                queryClient.setQueryData(
                    currentGardenKeys,
                    context.previousItem,
                );
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
                    queryKey: currentGardenKeys,
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
