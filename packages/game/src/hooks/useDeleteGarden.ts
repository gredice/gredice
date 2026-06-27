import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGameState } from '../useGameState';
import { useCurrentGardenIdParam } from '../useUrlState';
import { currentGardenKeys } from './useCurrentGarden';
import { useGardensKeys } from './useGardens';
import { tutorialChecklistKeys } from './useTutorialChecklist';

type DeleteGardenVariables = {
    gardenId: number;
};

const mutationKey = ['gardens', 'delete'];
const GARDEN_DELETE_FAILED_MESSAGE =
    'Došlo je do greške prilikom brisanja vrta. Pokušaj ponovno.';

function activeRaisedBedsMessage(count: number) {
    return count === 1
        ? 'Prije brisanja vrta napusti 1 aktivnu gredicu.'
        : `Prije brisanja vrta napusti ${count.toString()} aktivnih gredica.`;
}

async function getDeleteGardenErrorMessage(response: Response) {
    try {
        const body: unknown = await response.json();
        if (
            typeof body === 'object' &&
            body !== null &&
            'activeRaisedBedCount' in body
        ) {
            const { activeRaisedBedCount } = body;
            if (
                typeof activeRaisedBedCount === 'number' &&
                activeRaisedBedCount > 0
            ) {
                return activeRaisedBedsMessage(activeRaisedBedCount);
            }
        }

        if (typeof body === 'object' && body !== null && 'error' in body) {
            const { error } = body;
            if (typeof error === 'string' && error.trim()) {
                return error;
            }
        }
    } catch {
        return GARDEN_DELETE_FAILED_MESSAGE;
    }

    return GARDEN_DELETE_FAILED_MESSAGE;
}

export function useDeleteGarden() {
    const queryClient = useQueryClient();
    const winterMode = useGameState((state) => state.winterMode);
    const [selectedGardenId, setSelectedGardenId] = useCurrentGardenIdParam();

    return useMutation({
        mutationKey,
        mutationFn: async ({ gardenId }: DeleteGardenVariables) => {
            const response = await clientAuthenticated().api.gardens[
                ':gardenId'
            ].$delete({
                param: {
                    gardenId: gardenId.toString(),
                },
            });

            if (!response.ok) {
                throw new Error(await getDeleteGardenErrorMessage(response));
            }
        },
        onSuccess: async (_data, { gardenId }) => {
            if (selectedGardenId === gardenId) {
                void setSelectedGardenId(null);
            }

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: useGardensKeys }),
                queryClient.invalidateQueries({
                    queryKey: currentGardenKeys(winterMode),
                }),
                queryClient.invalidateQueries({
                    queryKey: tutorialChecklistKeys,
                }),
            ]);
        },
        onError: (error) => {
            console.error('Failed to delete garden:', error);
        },
    });
}
