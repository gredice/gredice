import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useGameState } from '../useGameState';
import { ensureBlockPlaceOperationId } from './blockPlaceOperation';
import {
    createOptimisticBlockPlacement,
    replaceOptimisticBlockId,
} from './optimisticBlockPlacement';
import { useBlockData } from './useBlockData';
import { useCurrentAccount } from './useCurrentAccount';
import { currentGardenKeys, useCurrentGarden } from './useCurrentGarden';
import { inventoryQueryKey } from './useInventory';
import { tutorialChecklistKeys } from './useTutorialChecklist';

const mutationKey = ['inventory', 'gardenBoxPlaceBlock'];
const optimisticBlockIdPrefix = 'optimistic-garden-box-block';

type CurrentGardenData = NonNullable<
    ReturnType<typeof useCurrentGarden>['data']
>;

type InventoryItemData = {
    entityTypeName: string;
    entityId: string;
    amount: number;
    packUnit?: { purchaseId: string; lineId: string; unitOrdinal: number };
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
    operationId?: string;
    accountId?: string | null;
    packUnit?: { purchaseId: string; lineId: string; unitOrdinal: number };
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
                        item.entityId === args.entityId &&
                        (args.packUnit
                            ? item.packUnit?.purchaseId ===
                                  args.packUnit.purchaseId &&
                              item.packUnit.lineId === args.packUnit.lineId &&
                              item.packUnit.unitOrdinal ===
                                  args.packUnit.unitOrdinal
                            : !item.packUnit);
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

class GardenBoxRequestError extends Error {
    constructor(
        readonly status: number,
        message: string,
    ) {
        super(message);
    }
}
export function useGardenBoxPlaceBlock() {
    const pendingOperations = useRef(new Map<string, string>());
    const queryClient = useQueryClient();
    const { data: currentGarden } = useCurrentGarden();
    const { data: currentAccount } = useCurrentAccount();
    const authority = useRef({
        accountId: currentAccount?.id ?? null,
        gardenId: currentGarden?.id,
    });
    authority.current = {
        accountId: currentAccount?.id ?? null,
        gardenId: currentGarden?.id,
    };
    const { data: blockData } = useBlockData();
    const winterMode = useGameState((state) => state.winterMode);
    const queueBlockPlacementDropAnimation = useGameState(
        (state) => state.queueBlockPlacementDropAnimation,
    );
    const confirmBlockPlacementDropAnimation = useGameState(
        (state) => state.confirmBlockPlacementDropAnimation,
    );
    const cancelBlockPlacementDropAnimation = useGameState(
        (state) => state.cancelBlockPlacementDropAnimation,
    );

    return useMutation({
        mutationKey,
        mutationFn: async (variables: GardenBoxPlaceBlockArgs) => {
            const operationId = ensureBlockPlaceOperationId(variables);
            const { entityId, gardenBoxBlockId, gardenId } = variables;
            if (
                variables.accountId !== authority.current.accountId ||
                (variables.packUnit &&
                    variables.gardenId !== authority.current.gardenId)
            )
                throw new GardenBoxRequestError(
                    409,
                    'Račun ili odabrani vrt promijenio se. Pokušaj ponovno.',
                );
            if (variables.packUnit) {
                const unit = variables.packUnit;
                const response =
                    await clientAuthenticated().api.accounts.current[
                        'garden-packs'
                    ][':purchaseId'].units[':lineId'][
                        ':unitOrdinal'
                    ].retrieve.$post({
                        param: {
                            purchaseId: unit.purchaseId,
                            lineId: unit.lineId,
                            unitOrdinal: unit.unitOrdinal.toString(),
                        },
                        json: { operationId, gardenId, gardenBoxBlockId },
                    });
                const result = await response.json();
                if (!response.ok || !('blockId' in result))
                    throw new GardenBoxRequestError(
                        response.status,
                        'error' in result
                            ? result.error
                            : 'Postavljanje predmeta nije uspjelo.',
                    );
                return {
                    id: result.blockId,
                    position: result.position,
                    item: { entityTypeName: 'block', entityId, amount: 1 },
                };
            }
            const response = await clientAuthenticated().api.inventory[
                'garden-boxes'
            ][':gardenId'][':blockId'].items.block[':entityId'].place.$post({
                param: {
                    gardenId: gardenId.toString(),
                    blockId: gardenBoxBlockId,
                    entityId,
                },
                json: { operationId },
            });

            if (!response.ok) {
                throw new GardenBoxRequestError(
                    response.status,
                    await getGardenBoxPlaceBlockError(response),
                );
            }

            return await response.json();
        },
        onMutate: async (args) => {
            args.accountId ??= authority.current.accountId;
            const key = JSON.stringify({
                accountId: args.accountId,
                gardenId: args.gardenId,
                gardenBoxBlockId: args.gardenBoxBlockId,
                entityId: args.entityId,
                packUnit: args.packUnit,
            });
            args.operationId ??= pendingOperations.current.get(key);
            pendingOperations.current.set(
                key,
                ensureBlockPlaceOperationId(args),
            );
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
            const optimisticBlockId =
                !args.packUnit && blockName
                    ? `${optimisticBlockIdPrefix}:${blockName}:${Date.now().toString(36)}`
                    : null;
            const optimisticPlacement =
                !args.packUnit && garden && blockName && optimisticBlockId
                    ? createOptimisticBlockPlacement(
                          garden,
                          blockData,
                          blockName,
                          optimisticBlockId,
                      )
                    : null;

            if (garden && optimisticBlockId && optimisticPlacement) {
                queueBlockPlacementDropAnimation(optimisticBlockId);
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
        onSuccess: (data, variables, context) => {
            pendingOperations.current.delete(
                JSON.stringify({
                    accountId: variables.accountId,
                    gardenId: variables.gardenId,
                    gardenBoxBlockId: variables.gardenBoxBlockId,
                    entityId: variables.entityId,
                    packUnit: variables.packUnit,
                }),
            );
            if (!context?.optimisticBlockId) {
                return;
            }

            const optimisticBlockId = context.optimisticBlockId;
            confirmBlockPlacementDropAnimation(optimisticBlockId, data.id);
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
        onError: (error, variables, context) => {
            if (
                error instanceof GardenBoxRequestError &&
                error.status >= 400 &&
                error.status < 500
            )
                pendingOperations.current.delete(
                    JSON.stringify({
                        accountId: variables.accountId,
                        gardenId: variables.gardenId,
                        gardenBoxBlockId: variables.gardenBoxBlockId,
                        entityId: variables.entityId,
                        packUnit: variables.packUnit,
                    }),
                );
            if (variables.accountId !== authority.current.accountId) return;
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
            if (context?.optimisticBlockId) {
                cancelBlockPlacementDropAnimation(context.optimisticBlockId);
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
                await queryClient.invalidateQueries({
                    queryKey: tutorialChecklistKeys,
                });
            }
        },
    });
}
