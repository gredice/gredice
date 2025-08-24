import { client } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { handleOptimisticUpdate } from '../helpers/queryHelpers';
import { currentGardenKeys, useCurrentGarden } from './useCurrentGarden';

const mutationKey = ['gardens', 'current', 'blockMove'];

export function useBlockMove() {
    const queryClient = useQueryClient();
    const { data: garden } = useCurrentGarden();
    return useMutation({
        mutationKey,
        mutationFn: async ({
            sourcePosition,
            destinationPosition,
            blockIndex,
        }: {
            sourcePosition: { x: number; z: number };
            destinationPosition: { x: number; z: number };
            blockIndex: number;
        }) => {
            if (!garden) {
                throw new Error('No garden selected');
            }
            const gardenId = garden.id;
            await client().api.gardens[':gardenId'].stacks.$patch({
                param: {
                    gardenId: gardenId.toString(),
                },
                json: [
                    {
                        op: 'move',
                        from: `/${sourcePosition.x}/${sourcePosition.z}/${blockIndex}`,
                        path: `/${destinationPosition.x}/${destinationPosition.z}/-`,
                    },
                ],
            });
        },
        onMutate: async ({
            sourcePosition,
            destinationPosition,
            blockIndex,
        }) => {
            if (!garden) {
                return;
            }

            const sourceStack = garden.stacks.find(
                (stack) =>
                    stack.position.x === sourcePosition.x &&
                    stack.position.z === sourcePosition.z,
            );
            if (!sourceStack) {
                return;
            }
            const destinationStack = garden.stacks.find(
                (stack) =>
                    stack.position.x === destinationPosition.x &&
                    stack.position.z === destinationPosition.z,
            );
            const updatedStacks = destinationStack
                ? garden.stacks.map((stack) => {
                      if (
                          stack.position.x === sourcePosition.x &&
                          stack.position.z === sourcePosition.z
                      ) {
                          return {
                              ...stack,
                              blocks: stack.blocks.filter(
                                  (_, index) => index !== blockIndex,
                              ),
                          };
                      } else if (
                          stack.position.x === destinationPosition.x &&
                          stack.position.z === destinationPosition.z
                      ) {
                          return {
                              ...stack,
                              blocks: [
                                  ...stack.blocks,
                                  sourceStack.blocks[blockIndex],
                              ],
                          };
                      }
                      return stack;
                  })
                : garden.stacks.map((stack) => {
                      if (
                          stack.position.x === sourcePosition.x &&
                          stack.position.z === sourcePosition.z
                      ) {
                          return {
                              ...stack,
                              blocks: stack.blocks.filter(
                                  (_, index) => index !== blockIndex,
                              ),
                          };
                      }
                      return stack;
                  });

            const previousItem = await handleOptimisticUpdate(
                queryClient,
                currentGardenKeys,
                {
                    stacks: [...updatedStacks],
                },
            );

            return {
                previousItem,
            };
        },
        onError: (error, _variables, context) => {
            console.error('Error moving block', error);
            if (context?.previousItem) {
                queryClient.setQueryData(
                    currentGardenKeys,
                    context.previousItem,
                );
            }
        },
        onSettled: async () => {
            // Invalidate queries
            if (queryClient.isMutating({ mutationKey }) === 1) {
                await queryClient.invalidateQueries({
                    queryKey: currentGardenKeys,
                });
            }
        },
    });
}
