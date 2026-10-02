import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { canAddBlockToGardenBox } from '../gardenBoxInventoryLimits';
import { handleOptimisticUpdate } from '../helpers/queryHelpers';
import { useGameState } from '../useGameState';
import { ensureBlockPlaceOperationId } from './blockPlaceOperation';
import { resolveExplicitGarden } from './gardenSelection';
import { currentAccountKeys, useCurrentAccount } from './useCurrentAccount';
import { currentGardenKeys, useCurrentGarden } from './useCurrentGarden';
import {
    type GardenAccountGroups,
    gardenAccountGroupsKeys,
} from './useGardenAccountGroups';
import { inventoryQueryKey } from './useInventory';
import { tutorialChecklistKeys } from './useTutorialChecklist';

const mutationKey = ['gardens', 'current', 'gardenBoxStoreBlock'];

type InventoryItemData = {
    entityTypeName: string;
    entityId: string;
    amount: number;
    name?: string;
    packUnit?: { purchaseId: string; lineId: string; unitOrdinal: number };
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
    operationId?: string;
    accountId?: string | null;
    gardenId?: number;
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
        (item) =>
            item.entityTypeName === 'block' &&
            item.entityId === entityId &&
            !item.packUnit,
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

class GardenBoxRequestError extends Error {
    constructor(
        readonly status: number,
        message: string,
    ) {
        super(message);
    }
}
export function useGardenBoxStoreBlock() {
    const pendingOperations = useRef(new Map<string, string>());
    const queryClient = useQueryClient();
    const { data: garden } = useCurrentGarden();
    const { data: currentAccount } = useCurrentAccount();
    const authority = useRef({
        accountId: currentAccount?.id ?? null,
        gardenId: garden?.id,
    });
    authority.current = {
        accountId: currentAccount?.id ?? null,
        gardenId: garden?.id,
    };
    const winterMode = useGameState((state) => state.winterMode);
    const showGardenBoxTooltip = useGameState(
        (state) => state.showGardenBoxTooltip,
    );
    const clearGardenBoxTooltip = useGameState(
        (state) => state.clearGardenBoxTooltip,
    );
    const gardenQueryKey = currentGardenKeys(winterMode, garden?.id);

    return useMutation({
        mutationKey,
        mutationFn: async ({
            blockEntityId,
            blockIndex,
            gardenBoxBlockId,
            sourceBlockId,
            sourcePosition,
            operationId,
            accountId,
            gardenId,
        }: StoreBlockArgs) => {
            const cachedAccount = queryClient.getQueryData<{ id: string }>(
                currentAccountKeys,
            );
            const cachedGroups = queryClient.getQueryData<GardenAccountGroups>(
                gardenAccountGroupsKeys,
            );
            const cachedGarden = gardenId
                ? resolveExplicitGarden(cachedGroups, gardenId)
                : null;
            if (
                cachedAccount?.id !== accountId ||
                (cachedGroups &&
                    (!cachedGarden?.isCurrent ||
                        cachedGarden.accountId !== accountId)) ||
                !gardenId ||
                accountId !== authority.current.accountId ||
                gardenId !== authority.current.gardenId
            ) {
                throw new GardenBoxRequestError(
                    409,
                    'Račun ili odabrani vrt promijenio se. Pokušaj ponovno.',
                );
            }

            const response = await clientAuthenticated().api.gardens[
                ':gardenId'
            ].blocks[':blockId']['store-in-garden-box'].$post({
                param: {
                    gardenId: gardenId.toString(),
                    blockId: sourceBlockId,
                },
                json: {
                    blockIndex,
                    entityId: blockEntityId,
                    gardenBoxBlockId,
                    sourcePosition,
                    operationId,
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
                throw new GardenBoxRequestError(response.status, errorMessage);
            }
        },
        onMutate: async (args) => {
            args.accountId ??= authority.current.accountId;
            args.gardenId ??= authority.current.gardenId;
            const key = JSON.stringify({
                accountId: args.accountId,
                gardenId: args.gardenId,
                sourceBlockId: args.sourceBlockId,
                gardenBoxBlockId: args.gardenBoxBlockId,
                sourcePosition: args.sourcePosition,
                blockIndex: args.blockIndex,
            });
            args.operationId ??= pendingOperations.current.get(key);
            pendingOperations.current.set(
                key,
                ensureBlockPlaceOperationId(args),
            );
            if (!garden) {
                return;
            }

            clearGardenBoxTooltip();

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
                gardenQueryKey,
                previousGarden,
                previousInventory,
            };
        },
        onSuccess: (_data, variables) => {
            pendingOperations.current.delete(
                JSON.stringify({
                    accountId: variables.accountId,
                    gardenId: variables.gardenId,
                    sourceBlockId: variables.sourceBlockId,
                    gardenBoxBlockId: variables.gardenBoxBlockId,
                    sourcePosition: variables.sourcePosition,
                    blockIndex: variables.blockIndex,
                }),
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
                        sourceBlockId: variables.sourceBlockId,
                        gardenBoxBlockId: variables.gardenBoxBlockId,
                        sourcePosition: variables.sourcePosition,
                        blockIndex: variables.blockIndex,
                    }),
                );
            if (variables.accountId !== authority.current.accountId) return;
            console.error('Error storing block in garden box', error);
            showGardenBoxTooltip({
                blockId: variables.gardenBoxBlockId,
                message:
                    error instanceof Error
                        ? error.message
                        : 'Failed to store block in garden box',
            });
            if (context?.previousGarden) {
                queryClient.setQueryData(
                    context.gardenQueryKey,
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
        onSettled: async (_data, _error, variables) => {
            const gardenQueryKey = currentGardenKeys(
                winterMode,
                variables.gardenId,
            );
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
