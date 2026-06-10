import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { handleOptimisticUpdate } from '../helpers/queryHelpers';
import { persistLocalSandboxGarden } from '../localSandboxGarden';
import { useGameState } from '../useGameState';
import { currentAccountKeys } from './useCurrentAccount';
import { currentGardenKeys, useCurrentGarden } from './useCurrentGarden';

const mutationKey = ['gardens', 'current', 'blockDelete'];

type DeleteBlocksArgs = {
    blockIds: string[];
};

async function getBlockDeleteError(response: Response) {
    const responseText = await response.text();
    if (!responseText) {
        return 'Failed to delete block';
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

export function useBlockDelete() {
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
        mutationFn: async ({ blockIds }: DeleteBlocksArgs) => {
            if (!garden) {
                throw new Error('No garden selected');
            }

            if (localSandboxStorageKey) {
                return;
            }

            for (const blockId of [...new Set(blockIds)]) {
                const response = await clientAuthenticated().api.gardens[
                    ':gardenId'
                ].blocks[':blockId'].$delete({
                    param: {
                        gardenId: garden.id.toString(),
                        blockId,
                    },
                });

                if (!response.ok) {
                    throw new Error(await getBlockDeleteError(response));
                }
            }
        },
        onMutate: async ({ blockIds }) => {
            if (!garden) {
                return;
            }

            const blockIdSet = new Set(blockIds);
            const updatedStacks = garden.stacks.map((stack) => ({
                ...stack,
                blocks: stack.blocks.filter(
                    (block) => !blockIdSet.has(block.id),
                ),
            }));

            const previousItem = await handleOptimisticUpdate(
                queryClient,
                gardenQueryKey,
                {
                    stacks: updatedStacks,
                },
            );
            if (localSandboxStorageKey) {
                persistLocalSandboxGarden(localSandboxStorageKey, {
                    ...garden,
                    stacks: updatedStacks,
                });
            }

            return {
                previousItem,
            };
        },
        onError: (error, _variables, context) => {
            console.error('Error deleting block', error);
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
                await queryClient.invalidateQueries({
                    queryKey: currentAccountKeys,
                });
            }
        },
    });
}
