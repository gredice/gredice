import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGardensKeys } from './useGardens';

const mutationKey = ['gardens', 'current', 'sandboxClearField'];

/**
 * Clear a plant from a sandbox raised bed field. Only valid for sandbox gardens.
 * Context-free (takes the gardenId per call).
 */
export function useSandboxClearField() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey,
        mutationFn: async ({
            gardenId,
            raisedBedId,
            positionIndex,
        }: {
            gardenId: number;
            raisedBedId: number;
            positionIndex: number;
        }) => {
            const response = await clientAuthenticated().api.gardens[
                ':gardenId'
            ]['raised-beds'][':raisedBedId'].fields[':positionIndex'].$delete({
                param: {
                    gardenId: gardenId.toString(),
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
                    queryKey: [...useGardensKeys, 'current'],
                });
            }
        },
    });
}
