import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGardensKeys } from './useGardens';

const mutationKey = ['gardens', 'current', 'sandboxPlant'];

/**
 * Plant a sort into a sandbox raised bed field at a chosen age.
 *
 * Only valid for sandbox ("play") gardens — the server backdates the sow date
 * by `ageDays` so the plant renders already-grown. Context-free (takes the
 * gardenId per call) so it can be used outside the game-state provider.
 */
export function useSandboxPlant() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey,
        mutationFn: async ({
            gardenId,
            raisedBedId,
            positionIndex,
            plantSortId,
            ageDays,
            status,
        }: {
            gardenId: number;
            raisedBedId: number;
            positionIndex: number;
            plantSortId: number;
            ageDays: number;
            status?: string;
        }) => {
            const response = await clientAuthenticated().api.gardens[
                ':gardenId'
            ]['raised-beds'][':raisedBedId'].fields[':positionIndex'][
                'sandbox-plant'
            ].$post({
                param: {
                    gardenId: gardenId.toString(),
                    raisedBedId: raisedBedId.toString(),
                    positionIndex: positionIndex.toString(),
                },
                json: {
                    plantSortId,
                    ageDays,
                    ...(status ? { status } : {}),
                },
            });

            if (response.status !== 200) {
                const errorData = await response.text();
                throw new Error(`Failed to plant: ${errorData}`);
            }
        },
        onSettled: async () => {
            if (queryClient.isMutating({ mutationKey }) === 1) {
                // Prefix-match every current-garden query regardless of winter mode.
                await queryClient.invalidateQueries({
                    queryKey: [...useGardensKeys, 'current'],
                });
            }
        },
    });
}
