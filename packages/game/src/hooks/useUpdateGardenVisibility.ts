import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGameState } from '../useGameState';
import type { useCurrentGarden } from './useCurrentGarden';
import { currentGardenKeys } from './useCurrentGarden';
import type { useGardens } from './useGardens';
import { useGardensKeys } from './useGardens';
import { tutorialChecklistKeys } from './useTutorialChecklist';

type UpdateGardenVisibilityVariables = {
    isPublic: boolean;
};

type CurrentGardenData = ReturnType<typeof useCurrentGarden>['data'];
type GardensData = ReturnType<typeof useGardens>['data'];

export function useUpdateGardenVisibility(gardenId?: number) {
    const queryClient = useQueryClient();
    const winterMode = useGameState((state) => state.winterMode);
    const gardenQueryKey = currentGardenKeys(winterMode, gardenId);

    return useMutation({
        mutationFn: async ({ isPublic }: UpdateGardenVisibilityVariables) => {
            if (!gardenId) {
                throw new Error(
                    'Garden ID is required to update garden visibility',
                );
            }

            const response = await clientAuthenticated().api.gardens[
                ':gardenId'
            ].$patch({
                param: { gardenId: gardenId.toString() },
                json: { isPublic },
            });

            if (!response.ok) {
                throw new Error('Failed to update garden visibility');
            }
        },
        onMutate: async ({ isPublic }) => {
            await Promise.all([
                queryClient.cancelQueries({ queryKey: gardenQueryKey }),
                queryClient.cancelQueries({ queryKey: useGardensKeys }),
            ]);

            const previousGarden =
                queryClient.getQueryData<CurrentGardenData>(gardenQueryKey);
            const previousGardens =
                queryClient.getQueryData<GardensData>(useGardensKeys);

            queryClient.setQueryData<CurrentGardenData>(
                gardenQueryKey,
                (currentGarden) =>
                    currentGarden
                        ? { ...currentGarden, isPublic }
                        : currentGarden,
            );
            queryClient.setQueryData<GardensData>(
                useGardensKeys,
                (currentGardens) =>
                    currentGardens?.map((garden) =>
                        garden.id === gardenId
                            ? { ...garden, isPublic }
                            : garden,
                    ) ?? currentGardens,
            );

            return { previousGarden, previousGardens };
        },
        onError: (error, _variables, context) => {
            console.error('Failed to update garden visibility:', error);
            if (context?.previousGarden !== undefined) {
                queryClient.setQueryData(
                    gardenQueryKey,
                    context.previousGarden,
                );
            }
            if (context?.previousGardens !== undefined) {
                queryClient.setQueryData(
                    useGardensKeys,
                    context.previousGardens,
                );
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: gardenQueryKey });
            queryClient.invalidateQueries({ queryKey: useGardensKeys });
            queryClient.invalidateQueries({ queryKey: tutorialChecklistKeys });
        },
    });
}
