import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Vector3 } from 'three';
import { handleOptimisticUpdate } from '../helpers/queryHelpers';
import type { Stack } from '../types/Stack';
import { useGameState } from '../useGameState';
import { currentGardenKeys, useCurrentGarden } from './useCurrentGarden';

const mutationKey = ['gardens', 'current', 'blockMove'];

type MoveBlockArgs = {
    sourcePosition: { x: number; z: number };
    destinationPosition: { x: number; z: number };
    blockIndex: number;
    sourceBlockId?: string;
};

type MoveArgs = MoveBlockArgs & {
    additionalBlocks?: MoveBlockArgs[];
    attached?: MoveBlockArgs;
    onOptimisticUpdate?: () => void;
};

type MovePatchOperation = {
    op: 'move';
    from: string;
    path: string;
};

function getMoveBlocks(args: MoveArgs): MoveBlockArgs[] {
    return [
        {
            sourcePosition: args.sourcePosition,
            destinationPosition: args.destinationPosition,
            blockIndex: args.blockIndex,
            sourceBlockId: args.sourceBlockId,
        },
        ...(args.additionalBlocks ?? []),
        ...(args.attached ? [args.attached] : []),
    ];
}

function moveBlockOptimistically(
    stacks: Stack[],
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
    const gardenQueryKey = currentGardenKeys(winterMode, garden?.id);

    return useMutation({
        mutationKey,
        mutationFn: async (args: MoveArgs) => {
            if (!garden) {
                throw new Error('No garden selected');
            }
            const gardenId = garden.id;
            const operations: MovePatchOperation[] = getMoveBlocks(args).map(
                (moveBlock) => ({
                    op: 'move',
                    from: `/${moveBlock.sourcePosition.x}/${moveBlock.sourcePosition.z}/${moveBlock.blockIndex}`,
                    path: `/${moveBlock.destinationPosition.x}/${moveBlock.destinationPosition.z}/-`,
                }),
            );

            await clientAuthenticated().api.gardens[':gardenId'].stacks.$patch({
                param: {
                    gardenId: gardenId.toString(),
                },
                json: operations,
            });
        },
        onMutate: async (args) => {
            if (!garden) {
                return;
            }

            if (
                args.sourcePosition.x === args.destinationPosition.x &&
                args.sourcePosition.z === args.destinationPosition.z
            ) {
                return;
            }

            let updatedStacks = garden.stacks;
            for (const moveBlock of getMoveBlocks(args)) {
                updatedStacks = moveBlockOptimistically(
                    updatedStacks,
                    moveBlock.sourcePosition,
                    moveBlock.destinationPosition,
                    moveBlock.blockIndex,
                    moveBlock.sourceBlockId,
                );
            }

            const previousItem = await handleOptimisticUpdate(
                queryClient,
                gardenQueryKey,
                {
                    stacks: [...updatedStacks],
                },
            );
            if (previousItem) {
                args.onOptimisticUpdate?.();
            }

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
