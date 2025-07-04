import { client } from "@gredice/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { currentGardenKeys, useCurrentGarden } from "./useCurrentGarden";
import { handleOptimisticUpdate } from "../helpers/queryHelpers";

const mutationKey = ['gardens', 'current', 'blockRotate'];

export function useBlockRotate() {
    const queryClient = useQueryClient();
    const { data: garden } = useCurrentGarden();
    return useMutation({
        mutationFn: async ({ blockId, rotation }: { blockId: string, rotation: number }) => {
            if (!garden) {
                throw new Error('No garden selected');
            }
            const gardenId = garden.id;
            await client().api.gardens[":gardenId"].blocks[":blockId"].$put({
                param: {
                    gardenId: gardenId.toString(),
                    blockId: blockId
                },
                json: {
                    rotation: rotation
                }
            });
        },
        onMutate: async ({ blockId, rotation }) => {
            if (!garden) {
                return;
            }

            const updatedStacks = garden.stacks.map(stack => {
                const updatedBlocks = stack.blocks.map(block => {
                    if (block.id === blockId) {
                        return {
                            ...block,
                            rotation: rotation
                        }
                    }
                    return block;
                });
                return {
                    ...stack,
                    blocks: updatedBlocks
                }
            });

            const previousItem = await handleOptimisticUpdate(queryClient, currentGardenKeys, {
                stacks: [...updatedStacks]
            });

            return {
                previousItem
            };
        },
        onError: (error, _variables, context) => {
            console.error('Error creating block', error);
            if (context?.previousItem) {
                queryClient.setQueryData(currentGardenKeys, context.previousItem);
            }
        },
        onSettled: async () => {
            // Invalidate queries
            if (queryClient.isMutating({ mutationKey }) === 1) {
                await queryClient.invalidateQueries({ queryKey: currentGardenKeys });
            }
        }
    })
}
