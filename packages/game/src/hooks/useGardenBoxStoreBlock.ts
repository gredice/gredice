import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { canAddBlockToGardenBox } from '../gardenBoxInventoryLimits';
import { handleOptimisticUpdate } from '../helpers/queryHelpers';
import { useGameState } from '../useGameState';
import { currentGardenKeys, useCurrentGarden } from './useCurrentGarden';
import { inventoryQueryKey } from './useInventory';
import { tutorialChecklistKeys } from './useTutorialChecklist';

const mutationKey = ['gardens', 'current', 'gardenBoxStoreBlock'];

type InventoryItemData = {
    entityTypeName: string;
    entityId: string;
    amount: number;
    name?: string;
};

type GardenBoxInventoryData = {
    blockId: string;
    gardenId: number;
    gardenName?: string | null;
    items: InventoryItemData[];
};

type InventoryData = {
    items: InventoryItemData[];
    gardenBoxes?: GardenBoxInventoryData[];
};

type StoreBlockArgs = {
    sourcePosition: { x: number; z: number };
    blockIndex: number;
    sourceBlockId: string;
    blockName: string;
    blockEntityId?: string;
    blockLabel?: string;
    gardenBoxBlockId: string;
    onOptimisticUpdate?: () => void;
};

function incrementInventoryItem(
    items: InventoryItemData[],
    args: StoreBlockArgs,
) {
    const entityId = args.blockEntityId ?? args.blockName;
    if (!canAddBlockToGardenBox(items, entityId)) {
        return items;
    }

    const existingItemIndex = items.findIndex(
        (item) => item.entityTypeName === 'block' && item.entityId === entityId,
    );

    if (existingItemIndex < 0) {
        return [
            ...items,
            {
                entityTypeName: 'block',
                entityId,
                amount: 1,
                name: args.blockLabel ?? args.blockName,
            },
        ];
    }

    return items.map((item, index) =>
        index === existingItemIndex
            ? { ...item, amount: item.amount + 1 }
            : item,
    );
}

function addBlockToGardenBoxInventory(
    inventory: InventoryData,
    gardenId: number,
    args: StoreBlockArgs,
) {
    return {
        ...inventory,
        gardenBoxes: inventory.gardenBoxes?.map((gardenBox) =>
            gardenBox.gardenId === gardenId &&
            gardenBox.blockId === args.gardenBoxBlockId
                ? {
                      ...gardenBox,
                      items: incrementInventoryItem(gardenBox.items, args),
                  }
                : gardenBox,
        ),
    };
}

export function useGardenBoxStoreBlock() {
    const queryClient = useQueryClient();
    const { data: garden } = useCurrentGarden();
    const winterMode = useGameState((state) => state.winterMode);
    const gardenQueryKey = currentGardenKeys(winterMode, garden?.id);

    return useMutation({
        mutationKey,
        mutationFn: async ({
            blockIndex,
            gardenBoxBlockId,
            sourceBlockId,
            sourcePosition,
        }: StoreBlockArgs) => {
            if (!garden) {
                throw new Error('No garden selected');
            }

            const response = await clientAuthenticated().api.gardens[
                ':gardenId'
            ].blocks[':blockId']['store-in-garden-box'].$post({
                param: {
                    gardenId: garden.id.toString(),
                    blockId: sourceBlockId,
                },
                json: {
                    blockIndex,
                    gardenBoxBlockId,
                    sourcePosition,
                },
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => null);
                const errorMessage =
                    errorBody &&
                    typeof errorBody === 'object' &&
                    'error' in errorBody &&
                    typeof errorBody.error === 'string'
                        ? errorBody.error
                        : 'Failed to store block in garden box';
                throw new Error(errorMessage);
            }
        },
        onMutate: async (args) => {
            if (!garden) {
                return;
            }

            const updatedStacks = garden.stacks.map((stack) => {
                const isSourceStack =
                    stack.position.x === args.sourcePosition.x &&
                    stack.position.z === args.sourcePosition.z;

                if (!isSourceStack) {
                    return stack;
                }

                return {
                    ...stack,
                    blocks: stack.blocks.filter(
                        (candidate) => candidate.id !== args.sourceBlockId,
                    ),
                };
            });

            const previousGarden = await handleOptimisticUpdate(
                queryClient,
                gardenQueryKey,
                {
                    stacks: updatedStacks,
                },
            );
            if (previousGarden) {
                args.onOptimisticUpdate?.();
            }

            await queryClient.cancelQueries({ queryKey: inventoryQueryKey });
            const previousInventory =
                queryClient.getQueryData<InventoryData>(inventoryQueryKey);
            if (previousInventory) {
                queryClient.setQueryData(
                    inventoryQueryKey,
                    addBlockToGardenBoxInventory(
                        previousInventory,
                        garden.id,
                        args,
                    ),
                );
            }

            return {
                previousGarden,
                previousInventory,
            };
        },
        onError: (error, _variables, context) => {
            console.error('Error storing block in garden box', error);
            if (context?.previousGarden) {
                queryClient.setQueryData(
                    gardenQueryKey,
                    context.previousGarden,
                );
            }
            if (context?.previousInventory) {
                queryClient.setQueryData(
                    inventoryQueryKey,
                    context.previousInventory,
                );
            }
        },
        onSettled: async () => {
            if (queryClient.isMutating({ mutationKey }) === 1) {
                await queryClient.invalidateQueries({
                    queryKey: gardenQueryKey,
                });
                await queryClient.invalidateQueries({
                    queryKey: inventoryQueryKey,
                });
                await queryClient.invalidateQueries({
                    queryKey: tutorialChecklistKeys,
                });
            }
        },
    });
}
