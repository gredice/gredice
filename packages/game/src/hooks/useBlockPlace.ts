import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGameState } from '../useGameState';
import {
    createOptimisticBlockPlacement,
    removeOptimisticBlockId,
    replaceOptimisticBlockId,
} from './optimisticBlockPlacement';
import { useBlockData } from './useBlockData';
import { currentAccountKeys } from './useCurrentAccount';
import { currentGardenKeys, useCurrentGarden } from './useCurrentGarden';

const mutationKey = ['gardens', 'current', 'blockPlace'];
const optimisticBlockIdPrefix = 'optimistic-block';

type CurrentGardenData = NonNullable<
    ReturnType<typeof useCurrentGarden>['data']
>;

async function getBlockPlacementError(response: Response) {
    const responseText = await response.text();
    if (!responseText) {
        return 'Failed to place block';
    }

    try {
        const parsedResponse = JSON.parse(responseText) as {
            error?: string;
        };
        return parsedResponse.error ?? responseText;
    } catch {
        return responseText;
    }
}

function createOptimisticBlockId(blockName: string) {
    const timestamp = Date.now().toString(36);
    const randomSuffix = Math.random().toString(36).slice(2);
    return `${optimisticBlockIdPrefix}:${blockName}:${timestamp}:${randomSuffix}`;
}

export function useBlockPlace() {
    const queryClient = useQueryClient();
    const { data: garden } = useCurrentGarden();
    const { data: blockData } = useBlockData();
    const winterMode = useGameState((state) => state.winterMode);
    const queuePlacedBlockEffect = useGameState(
        (state) => state.queuePlacedBlockEffect,
    );
    const gardenQueryKey = currentGardenKeys(winterMode, garden?.id);

    return useMutation({
        mutationKey,
        mutationFn: async ({ blockName }: { blockName: string }) => {
            if (!garden) {
                throw new Error('No garden selected');
            }
            const response = await clientAuthenticated().api.gardens[
                ':gardenId'
            ].blocks.$post({
                param: {
                    gardenId: garden.id.toString(),
                },
                json: {
                    blockName,
                },
            });
            if (!response.ok) {
                throw new Error(await getBlockPlacementError(response));
            }

            return await response.json();
        },
        onMutate: async ({ blockName }) => {
            if (!garden) {
                return;
            }

            await queryClient.cancelQueries({ queryKey: gardenQueryKey });
            const currentGarden =
                queryClient.getQueryData<CurrentGardenData>(gardenQueryKey) ??
                garden;
            const optimisticBlockId = createOptimisticBlockId(blockName);
            const optimisticPlacement = createOptimisticBlockPlacement(
                currentGarden,
                blockData,
                blockName,
                optimisticBlockId,
            );
            if (!optimisticPlacement) {
                return;
            }

            queryClient.setQueryData<CurrentGardenData>(gardenQueryKey, {
                ...currentGarden,
                stacks: optimisticPlacement.stacks,
            });

            const placedBlockData = blockData?.find(
                (block) => block.information.name === blockName,
            );
            // Sandbox gardens build for free — no sunflowers are spent.
            const amount = garden.isSandbox
                ? 0
                : (placedBlockData?.prices.sunflowers ?? 0);
            if (amount > 0) {
                queuePlacedBlockEffect(optimisticBlockId, {
                    kind: 'sunflowers',
                    amount,
                });
            }

            return {
                optimisticBlockId,
            };
        },
        onSuccess: (data, _variables, context) => {
            if (!context?.optimisticBlockId) {
                return;
            }

            queryClient.setQueryData<CurrentGardenData | null>(
                gardenQueryKey,
                (currentGarden) =>
                    currentGarden
                        ? replaceOptimisticBlockId(
                              currentGarden,
                              context.optimisticBlockId,
                              data.id,
                          )
                        : currentGarden,
            );
        },
        onError: (error, _variables, context) => {
            console.error('Error creating block', error);
            if (context?.optimisticBlockId) {
                queryClient.setQueryData<CurrentGardenData | null>(
                    gardenQueryKey,
                    (currentGarden) =>
                        currentGarden
                            ? removeOptimisticBlockId(
                                  currentGarden,
                                  context.optimisticBlockId,
                              )
                            : currentGarden,
                );
            }
        },
        onSettled: async () => {
            await queryClient.invalidateQueries({
                queryKey: currentAccountKeys,
            });
            if (queryClient.isMutating({ mutationKey }) === 1) {
                await queryClient.invalidateQueries({
                    queryKey: gardenQueryKey,
                });
            }
        },
    });
}
