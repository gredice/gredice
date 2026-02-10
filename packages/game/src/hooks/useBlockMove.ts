import { client } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Vector3 } from 'three';
import { handleOptimisticUpdate } from '../helpers/queryHelpers';
import { useGameState } from '../useGameState';
import { currentGardenKeys, useCurrentGarden } from './useCurrentGarden';

const mutationKey = ['gardens', 'current', 'blockMove'];

export function useBlockMove() {
    const queryClient = useQueryClient();
    const { data: garden } = useCurrentGarden();
    const winterMode = useGameState((state) => state.winterMode);
    const gardenQueryKey = currentGardenKeys(winterMode, garden?.id);

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

            console.debug(
                'Optimistically moving block',
                sourcePosition,
                destinationPosition,
                blockIndex,
            );
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
            if (!destinationStack) {
                garden.stacks.push({
                    position: new Vector3(
                        destinationPosition.x,
                        0,
                        destinationPosition.z,
                    ),
                    blocks: [],
                });
            }

            // Ignore if source and destination are the same
            if (
                sourcePosition.x === destinationPosition.x &&
                sourcePosition.z === destinationPosition.z
            ) {
                return;
            }

            const updatedStacks = garden.stacks.map((stack) => {
                // Update source stack
                if (
                    stack.position.x === sourcePosition.x &&
                    stack.position.z === sourcePosition.z
                ) {
                    console.debug(
                        'Removing block from source stack',
                        stack,
                        sourceStack.blocks[blockIndex],
                    );
                    return {
                        ...stack,
                        blocks: stack.blocks.filter(
                            (_, index) => index !== blockIndex,
                        ),
                    };
                }

                // Update destination stack
                if (
                    stack.position.x === destinationPosition.x &&
                    stack.position.z === destinationPosition.z
                ) {
                    console.debug(
                        'Adding block to destination stack',
                        stack,
                        sourceStack.blocks[blockIndex],
                    );
                    return {
                        ...stack,
                        blocks: [
                            ...stack.blocks,
                            sourceStack.blocks[blockIndex],
                        ],
                    };
                }

                // No changes for other stacks
                return stack;
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
            console.error('Error moving block', error);
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
