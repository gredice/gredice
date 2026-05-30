import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGameState } from '../useGameState';
import { currentGardenKeys, useCurrentGarden } from './useCurrentGarden';

const mutationKey = ['gardens', 'current', 'sandboxClearField'];

/**
 * Clear a plant from a sandbox raised bed field. Only valid for sandbox gardens.
 */
export function useSandboxClearField() {
    const queryClient = useQueryClient();
    const { data: garden } = useCurrentGarden();
    const winterMode = useGameState((state) => state.winterMode);
    const gardenQueryKey = currentGardenKeys(winterMode, garden?.id);

    return useMutation({
        mutationKey,
        mutationFn: async ({
            raisedBedId,
            positionIndex,
        }: {
            raisedBedId: number;
            positionIndex: number;
        }) => {
            if (!garden) {
                throw new Error('No garden selected');
            }

            const response = await clientAuthenticated().api.gardens[
                ':gardenId'
            ]['raised-beds'][':raisedBedId'].fields[':positionIndex'].$delete({
                param: {
                    gardenId: garden.id.toString(),
                    raisedBedId: raisedBedId.toString(),
                    positionIndex: positionIndex.toString(),
                },
            });

            if (response.status !== 200) {
                const errorData = await response.text();
                throw new Error(`Failed to clear field: ${errorData}`);
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
