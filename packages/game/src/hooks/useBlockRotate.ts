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
    const gardenQueryKey = currentGardenKeys(winterMode, garden?.id);

    return useMutation({
        mutationFn: async ({
            blockId,
            rotation,
        }: {
            blockId: string;
            rotation: number;
        }) => {
            if (!garden) {
                throw new Error('No garden selected');
            }
            const gardenId = garden.id;
            await client().api.gardens[':gardenId'].blocks[':blockId'].$put({
                param: {
                    gardenId: gardenId.toString(),
                    blockId: blockId,
                },
                json: {
                    rotation: rotation,
                },
            });
        },
        onMutate: async ({ blockId, rotation }) => {
            // Get fresh garden data from query cache, not from closure
            const currentGarden =
                queryClient.getQueryData<typeof garden>(gardenQueryKey);
            if (!currentGarden) {
                return;
            }

            const updatedStacks = currentGarden.stacks.map((stack) => {
                const updatedBlocks = stack.blocks.map((block) => {
                    if (block.id === blockId) {
                        return {
                            ...block,
                            rotation: rotation,
                        };
                    }
                    return block;
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
            // Invalidate queries
            if (queryClient.isMutating({ mutationKey }) === 1) {
                await queryClient.invalidateQueries({
                    queryKey: gardenQueryKey,
                });
            }
        },
    });
}
