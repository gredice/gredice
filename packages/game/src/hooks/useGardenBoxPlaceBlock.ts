import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryQueryKey } from './useInventory';

const mutationKey = ['inventory', 'gardenBoxPlaceBlock'];

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
            await queryClient.cancelQueries({ queryKey: inventoryQueryKey });
            const previousInventory =
                queryClient.getQueryData<InventoryData>(inventoryQueryKey);

            if (previousInventory) {
                queryClient.setQueryData(
                    inventoryQueryKey,
                    decrementGardenBoxInventoryItem(previousInventory, args),
                );
            }

            return { previousInventory };
        },
        onError: (error, _variables, context) => {
            console.error('Error placing block from garden box', error);
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
                    queryKey: inventoryQueryKey,
                });
                await queryClient.invalidateQueries({
                    queryKey: ['gardens', 'current'],
                });
            }
        },
    });
}
