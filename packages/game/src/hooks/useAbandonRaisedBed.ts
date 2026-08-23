import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { handleOptimisticUpdate } from '../helpers/queryHelpers';
import {
    RAISED_BED_ABANDON_FAILED_MESSAGE,
    RAISED_BED_STATUS_ABANDONED,
} from '../raisedBedConstants';
import { useGameState } from '../useGameState';
import { currentGardenKeys, useCurrentGarden } from './useCurrentGarden';
import { tutorialChecklistKeys } from './useTutorialChecklist';

const mutationKey = ['gardens', 'current', 'raisedBedAbandon'];
const SINGLE_MUTATION = 1;

async function getAbandonErrorMessage(response: Response) {
    try {
        const body: unknown = await response.json();
        if (typeof body === 'object' && body !== null && 'error' in body) {
            const { error } = body;
            if (typeof error === 'string' && error.trim()) {
                if (error === 'Raised bed is already abandoned') {
                    return 'Odabrana gredica je već napuštena. Odaberi drugu aktivnu gredicu.';
                }
                if (error === 'Only active raised beds can be abandoned') {
                    return 'Odabrana gredica više nije aktivna. Osvježi popis i odaberi drugu gredicu.';
                }
                if (error === 'Raised bed not found') {
                    return 'Odabrana gredica više nije dostupna. Osvježi popis i pokušaj ponovno.';
                }
                return error;
            }
        }
    } catch {
        return RAISED_BED_ABANDON_FAILED_MESSAGE;
    }

    return RAISED_BED_ABANDON_FAILED_MESSAGE;
}

export function useAbandonRaisedBed(gardenId: number) {
    const queryClient = useQueryClient();
    const { data: garden } = useCurrentGarden();
    const winterMode = useGameState((state) => state.winterMode);
    const gardenQueryKey = currentGardenKeys(winterMode, garden?.id);

    return useMutation({
        mutationKey,
        mutationFn: async (raisedBedId: number) => {
            const response = await clientAuthenticated().api.gardens[
                ':gardenId'
            ]['raised-beds'][':raisedBedId'].abandon.$post({
                param: {
                    gardenId: gardenId.toString(),
                    raisedBedId: raisedBedId.toString(),
                },
            });

            if (response.status !== 201) {
                console.warn('Failed to abandon raised bed response:', {
                    status: response.status,
                    statusText: response.statusText,
                });
                throw new Error(await getAbandonErrorMessage(response));
            }
        },
        onMutate: async (raisedBedId) => {
            if (!garden) {
                return;
            }

            const updatedRaisedBeds = garden.raisedBeds.map((bed) =>
                bed.id === raisedBedId
                    ? {
                          ...bed,
                          status: RAISED_BED_STATUS_ABANDONED,
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
            if (queryClient.isMutating({ mutationKey }) === SINGLE_MUTATION) {
                await queryClient.invalidateQueries({
                    queryKey: gardenQueryKey,
                });
                await queryClient.invalidateQueries({
                    queryKey: ['garden-operations', gardenId],
                });
                await queryClient.invalidateQueries({
                    queryKey: tutorialChecklistKeys,
                });
            }
        },
    });
}
