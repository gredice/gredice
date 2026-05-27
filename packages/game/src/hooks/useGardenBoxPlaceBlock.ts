import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGameState } from '../useGameState';
import {
    createOptimisticBlockPlacement,
    replaceOptimisticBlockId,
} from './optimisticBlockPlacement';
import { useBlockData } from './useBlockData';
import { currentGardenKeys, useCurrentGarden } from './useCurrentGarden';
import { inventoryQueryKey } from './useInventory';

const mutationKey = ['inventory', 'gardenBoxPlaceBlock'];
const optimisticBlockIdPrefix = 'optimistic-garden-box-block';

type CurrentGardenData = NonNullable<
    ReturnType<typeof useCurrentGarden>['data']
>;

type InventoryItemData = {
    entityTypeName: string;
    entityId: string;
    amount: number;
    name?: string;
    image?: string;
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

export type GardenBoxPlaceBlockArgs = {
    gardenId: number;
    gardenBoxBlockId: string;
    entityId: string;
};

function decrementGardenBoxInventoryItem(
    inventory: InventoryData,
    args: GardenBoxPlaceBlockArgs,
): InventoryData {
    return {
        ...inventory,
        gardenBoxes: inventory.gardenBoxes?.map((gardenBox) => {
            const isTargetGardenBox =
                gardenBox.gardenId === args.gardenId &&
                gardenBox.blockId === args.gardenBoxBlockId;

            if (!isTargetGardenBox) {
                return gardenBox;
            }

            return {
                ...gardenBox,
                items: gardenBox.items.flatMap((item) => {
                    const isTargetItem =
                        item.entityTypeName === 'block' &&
                        item.entityId === args.entityId;
                    if (!isTargetItem) {
                        return [item];
                    }

                    const nextAmount = item.amount - 1;
                    return nextAmount > 0
                        ? [{ ...item, amount: nextAmount }]
                        : [];
                }),
            };
        }),
    };
}

async function getGardenBoxPlaceBlockError(response: Response) {
    const errorBody = await response.json().catch(() => null);
    if (
        errorBody &&
        typeof errorBody === 'object' &&
        'error' in errorBody &&
        typeof errorBody.error === 'string'
    ) {
        return errorBody.error;
    }

    return 'Failed to place block from garden box';
}

export function useGardenBoxPlaceBlock() {
    const queryClient = useQueryClient();
    const { data: currentGarden } = useCurrentGarden();
    const { data: blockData } = useBlockData();
    const winterMode = useGameState((state) => state.winterMode);

    return useMutation({
        mutationKey,
        mutationFn: async ({
            entityId,
            gardenBoxBlockId,
            gardenId,
        }: GardenBoxPlaceBlockArgs) => {
            const response = await clientAuthenticated().api.inventory[
                'garden-boxes'
            ][':gardenId'][':blockId'].items.block[':entityId'].place.$post({
                param: {
                    gardenId: gardenId.toString(),
                    blockId: gardenBoxBlockId,
                    entityId,
                },
            });

            if (!response.ok) {
                throw new Error(await getGardenBoxPlaceBlockError(response));
            }

            return await response.json();
        },
        onMutate: async (args) => {
            const gardenQueryKey = currentGardenKeys(winterMode, args.gardenId);
            await Promise.all([
                queryClient.cancelQueries({ queryKey: inventoryQueryKey }),
                queryClient.cancelQueries({ queryKey: gardenQueryKey }),
            ]);
            const previousInventory =
                queryClient.getQueryData<InventoryData>(inventoryQueryKey);
            const previousGarden =
                queryClient.getQueryData<CurrentGardenData>(gardenQueryKey) ??
                (currentGarden?.id === args.gardenId
                    ? currentGarden
                    : undefined);

            if (previousInventory) {
                queryClient.setQueryData(
                    inventoryQueryKey,
                    decrementGardenBoxInventoryItem(previousInventory, args),
                );
            }

            const targetBlockData = blockData?.find(
                (block) => block.id.toString() === args.entityId,
            );
            const blockName = targetBlockData?.information.name;
            const garden = previousGarden ?? currentGarden;
            const optimisticBlockId = blockName
                ? `${optimisticBlockIdPrefix}:${blockName}:${Date.now().toString(36)}`
                : null;
            const optimisticPlacement =
                garden && blockName && optimisticBlockId
                    ? createOptimisticBlockPlacement(
                          garden,
                          blockData,
                          blockName,
                          optimisticBlockId,
                      )
                    : null;

            if (garden && optimisticPlacement) {
                queryClient.setQueryData<CurrentGardenData>(gardenQueryKey, {
                    ...garden,
                    stacks: optimisticPlacement.stacks,
                });
            }

            return {
                gardenQueryKey,
                optimisticBlockId,
                previousGarden,
                previousInventory,
            };
        },
        onSuccess: (data, _variables, context) => {
            if (!context?.optimisticBlockId) {
                return;
            }

            const optimisticBlockId = context.optimisticBlockId;
            queryClient.setQueryData<CurrentGardenData | null>(
                context.gardenQueryKey,
                (garden) =>
                    garden
                        ? replaceOptimisticBlockId(
                              garden,
                              optimisticBlockId,
                              data.id,
                          )
                        : garden,
            );
        },
        onError: (error, _variables, context) => {
            console.error('Error placing block from garden box', error);
            if (context?.previousInventory) {
                queryClient.setQueryData(
                    inventoryQueryKey,
                    context.previousInventory,
                );
            }
            if (context?.previousGarden) {
                queryClient.setQueryData(
                    context.gardenQueryKey,
                    context.previousGarden,
                );
            }
        },
        onSettled: async (_data, _error, variables) => {
            const gardenQueryKey = currentGardenKeys(
                winterMode,
                variables.gardenId,
            );
            if (queryClient.isMutating({ mutationKey }) === 1) {
                await queryClient.invalidateQueries({
                    queryKey: inventoryQueryKey,
                });
                await queryClient.invalidateQueries({
                    queryKey: gardenQueryKey,
                });
            }
        },
    });
}
