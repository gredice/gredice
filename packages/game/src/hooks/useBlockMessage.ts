import { clientAuthenticated } from '@gredice/client';
import { normalizeWoodenSignMessage } from '@gredice/js/woodenSign';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { handleOptimisticUpdate } from '../helpers/queryHelpers';
import { persistLocalSandboxGarden } from '../localSandboxGarden';
import { useGameState } from '../useGameState';
import { updateBlockMessageInStacks } from './optimisticStackUpdates';
import { currentGardenKeys, useCurrentGarden } from './useCurrentGarden';

const mutationKey = ['gardens', 'current', 'blockMessage'];

function getErrorMessage(payload: unknown) {
    if (
        payload &&
        typeof payload === 'object' &&
        'error' in payload &&
        typeof payload.error === 'string'
    ) {
        return payload.error;
    }
    return 'Natpis se trenutno ne može spremiti. Pokušaj ponovno.';
}

export function useBlockMessage() {
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
            message,
        }: {
            blockId: string;
            message: string;
        }) => {
            if (!garden) {
                throw new Error('Nije odabran vrt.');
            }

            const normalizedMessage = normalizeWoodenSignMessage(message);
            if (localSandboxStorageKey) {
                return { message: normalizedMessage };
            }

            const response = await clientAuthenticated().api.gardens[
                ':gardenId'
            ].blocks[':blockId'].$put({
                param: {
                    gardenId: garden.id.toString(),
                    blockId,
                },
                json: { message: normalizedMessage },
            });
            const payload: unknown = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(getErrorMessage(payload));
            }

            return payload;
        },
        onMutate: async ({ blockId, message }) => {
            const currentGarden =
                queryClient.getQueryData<typeof garden>(gardenQueryKey) ??
                garden;
            if (!currentGarden) {
                return;
            }

            const normalizedMessage = normalizeWoodenSignMessage(message);
            const updatedStacks = updateBlockMessageInStacks({
                blockId,
                message: normalizedMessage,
                stacks: currentGarden.stacks,
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
            console.error('Error updating wooden sign message', error);
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
