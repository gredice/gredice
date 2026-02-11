import { client } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Vector3 } from 'three';
import { handleOptimisticUpdate } from '../helpers/queryHelpers';
import { useGameState } from '../useGameState';
import { currentGardenKeys, useCurrentGarden } from './useCurrentGarden';

const mutationKey = ['gardens', 'current', 'blockMove'];

type MoveArgs = {
    sourcePosition: { x: number; z: number };
    destinationPosition: { x: number; z: number };
    blockIndex: number;
    sourceBlockId?: string;
    attached?: {
        sourcePosition: { x: number; z: number };
        destinationPosition: { x: number; z: number };
        blockIndex: number;
        sourceBlockId?: string;
    };
};

function moveBlockOptimistically(
    stacks: { position: Vector3; blocks: { id: string }[] }[],
    sourcePosition: { x: number; z: number },
    destinationPosition: { x: number; z: number },
    blockIndex: number,
    sourceBlockId?: string,
) {
    const sourceStack = stacks.find(
        (stack) =>
            stack.position.x === sourcePosition.x &&
            stack.position.z === sourcePosition.z,
    );

    if (!sourceStack) {
        return stacks;
    }

    const sourceBlock =
        sourceBlockId !== undefined
            ? sourceStack.blocks.find(
                  (candidate) => candidate.id === sourceBlockId,
              )
            : sourceStack.blocks[blockIndex];

    if (!sourceBlock) {
        return stacks;
    }

    let hasDestinationStack = stacks.some(
        (stack) =>
            stack.position.x === destinationPosition.x &&
            stack.position.z === destinationPosition.z,
    );

    const mutableStacks = hasDestinationStack
        ? [...stacks]
        : [
              ...stacks,
              {
                  position: new Vector3(
                      destinationPosition.x,
                      0,
                      destinationPosition.z,
                  ),
                  blocks: [],
              },
          ];

    hasDestinationStack = true;
    if (!hasDestinationStack) {
        return mutableStacks;
    }

    return mutableStacks.map((stack) => {
        if (
            stack.position.x === sourcePosition.x &&
            stack.position.z === sourcePosition.z
        ) {
            return {
                ...stack,
                blocks: stack.blocks.filter(
                    (candidate) => candidate.id !== sourceBlock.id,
                ),
            };
        }

        if (
            stack.position.x === destinationPosition.x &&
            stack.position.z === destinationPosition.z
        ) {
            return {
                ...stack,
                blocks: [...stack.blocks, sourceBlock],
            };
        }

        return stack;
    });
}

export function useBlockMove() {
    const queryClient = useQueryClient();
    const { data: garden } = useCurrentGarden();
    const winterMode = useGameState((state) => state.winterMode);
    const gardenQueryKey = currentGardenKeys(winterMode);

    return useMutation({
        mutationKey,
        mutationFn: async ({
            sourcePosition,
            destinationPosition,
            blockIndex,
            attached,
        }: MoveArgs) => {
            if (!garden) {
                throw new Error('No garden selected');
            }
            const gardenId = garden.id;
            const operations = [
                {
                    op: 'move' as const,
                    from: `/${sourcePosition.x}/${sourcePosition.z}/${blockIndex}`,
                    path: `/${destinationPosition.x}/${destinationPosition.z}/-`,
                },
            ];

            if (attached) {
                operations.push({
                    op: 'move',
                    from: `/${attached.sourcePosition.x}/${attached.sourcePosition.z}/${attached.blockIndex}`,
                    path: `/${attached.destinationPosition.x}/${attached.destinationPosition.z}/-`,
                });
            }

            await client().api.gardens[':gardenId'].stacks.$patch({
                param: {
                    gardenId: gardenId.toString(),
                },
                json: operations,
            });
        },
        onMutate: async ({
            sourcePosition,
            destinationPosition,
            blockIndex,
            sourceBlockId,
            attached,
        }) => {
            if (!garden) {
                return;
            }

            if (
                sourcePosition.x === destinationPosition.x &&
                sourcePosition.z === destinationPosition.z
            ) {
                return;
            }

            let updatedStacks = moveBlockOptimistically(
                garden.stacks,
                sourcePosition,
                destinationPosition,
                blockIndex,
                sourceBlockId,
            );

            if (attached) {
                updatedStacks = moveBlockOptimistically(
                    updatedStacks,
                    attached.sourcePosition,
                    attached.destinationPosition,
                    attached.blockIndex,
                    attached.sourceBlockId,
                );
            }

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
            if (queryClient.isMutating({ mutationKey }) === 1) {
                await queryClient.invalidateQueries({
                    queryKey: gardenQueryKey,
                });
            }
        },
    });
}
