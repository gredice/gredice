import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { handleOptimisticUpdate } from '../helpers/queryHelpers';
import { persistLocalSandboxGarden } from '../localSandboxGarden';
import { createGardenPosition, type GardenStack } from '../types/Stack';
import { useGameState } from '../useGameState';
import { getGardenStackPatchError } from './gardenStackPatchError';
import { currentGardenKeys, useCurrentGarden } from './useCurrentGarden';

const mutationKey = ['gardens', 'current', 'blockMove'];

type MoveBlockArgs = {
    sourcePosition: { x: number; z: number };
    destinationPosition: { x: number; z: number };
    blockIndex: number;
    sourceBlockId: string;
};

type MoveArgs = MoveBlockArgs & {
    additionalBlocks?: MoveBlockArgs[];
    onOptimisticUpdate?: () => void;
};

type MovePatchOperation =
    | {
          op: 'test';
          path: string;
          value: string;
      }
    | {
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
    ];
}

export function createMovePatchOperations(args: MoveArgs) {
    return getMoveBlocks(args).flatMap<MovePatchOperation>((moveBlock) => {
        const sourcePath = `/${moveBlock.sourcePosition.x}/${moveBlock.sourcePosition.z}/${moveBlock.blockIndex}`;
        return [
            {
                op: 'test',
                path: sourcePath,
                value: moveBlock.sourceBlockId,
            },
            {
                op: 'move',
                from: sourcePath,
                path: `/${moveBlock.destinationPosition.x}/${moveBlock.destinationPosition.z}/-`,
            },
        ];
    });
}

export function moveBlockOptimistically(
    stacks: GardenStack[],
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
                  position: createGardenPosition(
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
    const localSandboxStorageKey = useGameState(
        (state) => state.localSandboxStorageKey,
    );
    const winterMode = useGameState((state) => state.winterMode);
    const gardenQueryKey = currentGardenKeys(
        winterMode,
        garden?.id,
        undefined,
        localSandboxStorageKey,
    );

    return useMutation({
        mutationKey,
        mutationFn: async (args: MoveArgs) => {
            if (!garden) {
                throw new Error('No garden selected');
            }
            if (localSandboxStorageKey) {
                return;
            }
            const gardenId = garden.id;
            const operations = createMovePatchOperations(args);

            const response = await clientAuthenticated().api.gardens[
                ':gardenId'
            ].stacks.$patch({
                param: {
                    gardenId: gardenId.toString(),
                },
                json: operations,
            });
            if (!response.ok) {
                throw new Error(await getGardenStackPatchError(response));
            }
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
            if (localSandboxStorageKey) {
                persistLocalSandboxGarden(localSandboxStorageKey, {
                    ...garden,
                    stacks: updatedStacks,
                });
            }
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
            if (localSandboxStorageKey) {
                return;
            }

            if (queryClient.isMutating({ mutationKey }) === 1) {
                await queryClient.invalidateQueries({
                    queryKey: gardenQueryKey,
                });
            }
        },
    });
}
