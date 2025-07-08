import { client } from "@gredice/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { currentGardenKeys, useCurrentGarden } from "./useCurrentGarden";
import { handleOptimisticUpdate } from "../helpers/queryHelpers";
import { currentAccountKeys } from "./useCurrentAccount";

const mutationKey = ['gardens', 'current', 'useBlockRecycle'];

export function useBlockRecycle() {
    const queryClient = useQueryClient();
    const { data: garden } = useCurrentGarden();
    return useMutation({
        mutationKey,
        mutationFn: async ({ position, blockIndex }: { position: { x: number, z: number }, blockIndex: number }) => {
            console.debug('Recycling block', position, blockIndex);
            if (!garden) {
                throw new Error('No garden selected');
            }
            const gardenId = garden.id;
            await client().api.gardens[":gardenId"].stacks.$patch({
                param: {
                    gardenId: gardenId.toString()
                },
                json: [
                    {
                        op: 'remove',
                        path: `/${position.x}/${position.z}/${blockIndex}`
                    }
                ]
            });
        },
        onMutate: async ({ position, blockIndex }) => {
            if (!garden) {
                return;
            }

            // Finds the source stack based on position
            const sourceStack = garden.stacks.find(stack => stack.position.x === position.x && stack.position.z === position.z);
            if (!sourceStack) {
                return;
            }

            // Optimistically remove from source stack
            const updatedStacks = garden.stacks.map(stack => {
                if (stack.position.x === sourceStack.position.x && stack.position.z === sourceStack.position.z) {
                    return {
                        ...stack,
                        blocks: stack.blocks.filter((_, index) => index !== blockIndex)
                    }
                }
                return stack;
            });

            const previousItem = await handleOptimisticUpdate(queryClient, currentGardenKeys, {
                stacks: [...updatedStacks]
            });

            return {
                previousItem
            };
        },
        onError: (error, _variables, context) => {
            console.error('Error removing block', error);
            if (context?.previousItem) {
                queryClient.setQueryData(currentGardenKeys, context.previousItem);
            }
        },
        onSettled: async () => {
            // Invalidate queries only on last mutation
            if (queryClient.isMutating({ mutationKey }) === 1) {
                await queryClient.invalidateQueries({ queryKey: currentGardenKeys });
                queryClient.invalidateQueries({ queryKey: currentAccountKeys });
            }
        }
    })
}
