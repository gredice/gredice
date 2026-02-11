import { client } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { handleOptimisticUpdate } from '../helpers/queryHelpers';
import { useGameState } from '../useGameState';
import { currentGardenKeys, useCurrentGarden } from './useCurrentGarden';

const mutationKey = ['gardens', 'current', 'blockRotate'];

export function useBlockRotate() {
    const queryClient = useQueryClient();
    const { data: garden } = useCurrentGarden();
    const winterMode = useGameState((state) => state.winterMode);
    const gardenQueryKey = currentGardenKeys(winterMode);

    return useMutation({
        mutationFn: async ({
            blockId,
            rotation,
            blockIds,
        }: {
            blockId: string;
            rotation: number;
            blockIds?: string[];
        }) => {
            if (!garden) {
                throw new Error('No garden selected');
            }
            const gardenId = garden.id;
            const targetBlockIds = Array.from(
                new Set(blockIds?.length ? blockIds : [blockId]),
            );
            await Promise.all(
                targetBlockIds.map(async (targetBlockId) => {
                    await client().api.gardens[':gardenId'].blocks[
                        ':blockId'
                    ].$put({
                        param: {
                            gardenId: gardenId.toString(),
                            blockId: targetBlockId,
                        },
                        json: {
                            rotation: rotation,
                        },
                    });
                }),
            );
        },
        onMutate: async ({ blockId, rotation, blockIds }) => {
            const currentGarden =
                queryClient.getQueryData<typeof garden>(gardenQueryKey);
            if (!currentGarden) {
                return;
            }

            const targetBlockIds = new Set(
                blockIds?.length ? blockIds : [blockId],
            );
            const updatedStacks = currentGarden.stacks.map((stack) => {
                const updatedBlocks = stack.blocks.map((candidate) => {
                    if (targetBlockIds.has(candidate.id)) {
                        return {
                            ...candidate,
                            rotation: rotation,
                        };
                    }
                    return candidate;
                });
                return {
                    ...stack,
                    blocks: updatedBlocks,
                };
            });

            const previousItem = await handleOptimisticUpdate(
                queryClient,
                gardenQueryKey,
                {
                    stacks: [...updatedStacks],
                },
            );

            return {
                previousItem,
            };
        },
        onError: (error, _variables, context) => {
            console.error('Error rotating block', error);
            if (context?.previousItem) {
                queryClient.setQueryData(gardenQueryKey, context.previousItem);
            }
        },
        onSettled: async () => {
            if (queryClient.isMutating({ mutationKey }) === 1) {
                await queryClient.invalidateQueries({
                    queryKey: gardenQueryKey,
                });
            }
        },
    });
}
