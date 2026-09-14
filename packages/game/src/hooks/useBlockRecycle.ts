import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { handleOptimisticUpdate } from '../helpers/queryHelpers';
import { persistLocalSandboxGarden } from '../localSandboxGarden';
import { useGameState } from '../useGameState';
import { getGardenStackPatchError } from './gardenStackPatchError';
import { currentAccountKeys } from './useCurrentAccount';
import { currentGardenKeys, useCurrentGarden } from './useCurrentGarden';
import {
    type ShoppingCartData,
    useShoppingCart,
    useShoppingCartQueryKey,
} from './useShoppingCart';
import { tutorialChecklistKeys } from './useTutorialChecklist';

const mutationKey = ['gardens', 'current', 'useBlockRecycle'];

type RecycleBlockArgs = {
    position: { x: number; z: number };
    blockId: string;
    blockIndex: number;
    raisedBedId?: number;
    onOptimisticUpdate?: () => void;
};

type RecyclePatchOperation =
    | {
          op: 'test';
          path: string;
          value: string;
      }
    | {
          op: 'remove';
          path: string;
      };

export function createRecyclePatchOperations({
    blockId,
    blockIndex,
    position,
}: Pick<
    RecycleBlockArgs,
    'blockId' | 'blockIndex' | 'position'
>): RecyclePatchOperation[] {
    const path = `/${position.x}/${position.z}/${blockIndex}`;
    return [
        { op: 'test', path, value: blockId },
        { op: 'remove', path },
    ];
}

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
    const localSandboxStorageKey = useGameState(
        (state) => state.localSandboxStorageKey,
    );
    const { data: shoppingCart } = useShoppingCart(!localSandboxStorageKey);
    const winterMode = useGameState((state) => state.winterMode);
    const gardenQueryKey = currentGardenKeys(
        winterMode,
        garden?.id,
        undefined,
        localSandboxStorageKey,
    );

    return useMutation({
        mutationKey,
        mutationFn: async ({
            position,
            blockId,
            blockIndex,
            raisedBedId,
        }: RecycleBlockArgs) => {
            console.debug('Recycling block', position, blockIndex);
            if (!garden) {
                throw new Error('No garden selected');
            }
            if (localSandboxStorageKey) {
                return;
            }
            const gardenId = garden.id;
            const response = await clientAuthenticated().api.gardens[
                ':gardenId'
            ].stacks.$patch({
                param: {
                    gardenId: gardenId.toString(),
                },
                json: createRecyclePatchOperations({
                    blockId,
                    blockIndex,
                    position,
                }),
            });
            if (!response.ok) {
                throw new Error(await getGardenStackPatchError(response));
            }

            if (shoppingCart && raisedBedId) {
                await removeShoppingCartItems(shoppingCart, raisedBedId);
            }
        },
        onMutate: async ({
            position,
            blockIndex,
            raisedBedId,
            onOptimisticUpdate,
        }) => {
            if (!garden) {
                return;
            }

            // Optimistically remove from source stack
            const updatedStacks = garden.stacks.map((stack) => {
                const isSourceStack =
                    stack.position.x === position.x &&
                    stack.position.z === position.z;
                if (isSourceStack) {
                    return {
                        ...stack,
                        blocks: stack.blocks.filter((_, index) => {
                            if (isSourceStack && index === blockIndex) {
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
            if (localSandboxStorageKey) {
                persistLocalSandboxGarden(localSandboxStorageKey, {
                    ...garden,
                    stacks: updatedStacks,
                });
            }
            if (previousItem) {
                onOptimisticUpdate?.();
            }

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
            if (localSandboxStorageKey) {
                return;
            }

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
                queryClient.invalidateQueries({
                    queryKey: tutorialChecklistKeys,
                });
            }
        },
    });
}
