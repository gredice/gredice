import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { handleOptimisticUpdate } from '../helpers/queryHelpers';
import { persistLocalSandboxGarden } from '../localSandboxGarden';
import { useGameState } from '../useGameState';
import { updateBlockVariantInStacks } from './optimisticStackUpdates';
import { currentGardenKeys, useCurrentGarden } from './useCurrentGarden';

const mutationKey = ['gardens', 'current', 'blockVariant'];

export function useBlockVariant() {
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
        mutationFn: async ({
            blockId,
            variant,
        }: {
            blockId: string;
            variant: number | null;
        }) => {
            if (!garden) {
                throw new Error('Nije odabran vrt.');
            }
            if (localSandboxStorageKey) {
                return;
            }

            const response = await clientAuthenticated().api.gardens[
                ':gardenId'
            ].blocks[':blockId'].$put({
                param: {
                    gardenId: garden.id.toString(),
                    blockId,
                },
                json: { variant },
            });
            if (!response.ok) {
                throw new Error(
                    'Stanje vrtnih vrata trenutačno se ne može spremiti.',
                );
            }
        },
        onMutate: async ({ blockId, variant }) => {
            const currentGarden =
                queryClient.getQueryData<typeof garden>(gardenQueryKey) ??
                garden;
            if (!currentGarden) {
                return;
            }

            const updatedStacks = updateBlockVariantInStacks({
                blockId,
                stacks: currentGarden.stacks,
                variant,
            });
            const previousItem = await handleOptimisticUpdate(
                queryClient,
                gardenQueryKey,
                { stacks: updatedStacks },
            );

            if (localSandboxStorageKey) {
                persistLocalSandboxGarden(localSandboxStorageKey, {
                    ...currentGarden,
                    stacks: updatedStacks,
                });
            }

            return { previousItem };
        },
        onError: (error, _variables, context) => {
            console.error('Error updating fence gate state', error);
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
