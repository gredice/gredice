import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { handleOptimisticUpdate } from '../helpers/queryHelpers';
import { RAISED_BED_ABANDON_FAILED_MESSAGE } from '../raisedBedMessages';
import { useGameState } from '../useGameState';
import { currentGardenKeys, useCurrentGarden } from './useCurrentGarden';

const mutationKey = ['gardens', 'current', 'raisedBedAbandon'];
const LAST_MUTATION_IN_FLIGHT = 1;

export function useAbandonRaisedBed(gardenId: number, raisedBedId: number) {
    const queryClient = useQueryClient();
    const { data: garden } = useCurrentGarden();
    const winterMode = useGameState((state) => state.winterMode);
    const gardenQueryKey = currentGardenKeys(winterMode, garden?.id);

    return useMutation({
        mutationKey,
        mutationFn: async () => {
            const response = await clientAuthenticated().api.gardens[
                ':gardenId'
            ]['raised-beds'][':raisedBedId'].abandon.$post({
                param: {
                    gardenId: gardenId.toString(),
                    raisedBedId: raisedBedId.toString(),
                },
            });

            if (response.status !== 201) {
                throw new Error(RAISED_BED_ABANDON_FAILED_MESSAGE);
            }
        },
        onMutate: async () => {
            if (!garden) {
                return;
            }

            const updatedRaisedBeds = garden.raisedBeds.map((bed) =>
                bed.id === raisedBedId
                    ? {
                          ...bed,
                          status: 'abandoned',
                      }
                    : bed,
            );

            const previousItem = await handleOptimisticUpdate(
                queryClient,
                gardenQueryKey,
                {
                    raisedBeds: updatedRaisedBeds,
                },
            );

            return { previousItem };
        },
        onError: (error, _variables, context) => {
            console.error('Failed to abandon raised bed:', error);
            if (context?.previousItem) {
                queryClient.setQueryData(gardenQueryKey, context.previousItem);
            }
        },
        onSettled: async () => {
            if (
                queryClient.isMutating({ mutationKey }) ===
                LAST_MUTATION_IN_FLIGHT
            ) {
                await queryClient.invalidateQueries({
                    queryKey: gardenQueryKey,
                });
                await queryClient.invalidateQueries({
                    queryKey: ['garden-operations', gardenId],
                });
            }
        },
    });
}
