import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGameState } from '../useGameState';
import { currentGardenKeys, useCurrentGarden } from './useCurrentGarden';

const mutationKey = ['gardens', 'current', 'sandboxPlant'];

/**
 * Plant a sort into a sandbox raised bed field at a chosen age.
 *
 * Only valid for sandbox ("play") gardens — the server backdates the sow date
 * by `ageDays` so the plant renders already-grown.
 */
export function useSandboxPlant() {
    const queryClient = useQueryClient();
    const { data: garden } = useCurrentGarden();
    const winterMode = useGameState((state) => state.winterMode);
    const gardenQueryKey = currentGardenKeys(winterMode, garden?.id);

    return useMutation({
        mutationKey,
        mutationFn: async ({
            raisedBedId,
            positionIndex,
            plantSortId,
            ageDays,
            status,
        }: {
            raisedBedId: number;
            positionIndex: number;
            plantSortId: number;
            ageDays: number;
            status?: string;
        }) => {
            if (!garden) {
                throw new Error('No garden selected');
            }

            const response = await clientAuthenticated().api.gardens[
                ':gardenId'
            ]['raised-beds'][':raisedBedId'].fields[':positionIndex'][
                'sandbox-plant'
            ].$post({
                param: {
                    gardenId: garden.id.toString(),
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
                await queryClient.invalidateQueries({
                    queryKey: gardenQueryKey,
                });
            }
        },
    });
}
