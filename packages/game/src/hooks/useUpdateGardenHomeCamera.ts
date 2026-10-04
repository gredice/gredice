import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGameState } from '../useGameState';
import type { CurrentGarden, useCurrentGarden } from './useCurrentGarden';
import { currentGardenKeys } from './useCurrentGarden';
import type { useGardens } from './useGardens';
import { useGardensKeys } from './useGardens';

export type GardenHomeCamera = NonNullable<CurrentGarden['homeCamera']>;

type UpdateGardenHomeCameraVariables = {
    homeCamera: GardenHomeCamera | null;
};

type CurrentGardenData = ReturnType<typeof useCurrentGarden>['data'];
type GardensData = ReturnType<typeof useGardens>['data'];

export function useUpdateGardenHomeCamera(gardenId?: number) {
    const queryClient = useQueryClient();
    const winterMode = useGameState((state) => state.winterMode);
    const gardenQueryKey = currentGardenKeys(winterMode, gardenId);

    return useMutation({
        mutationFn: async ({ homeCamera }: UpdateGardenHomeCameraVariables) => {
            if (!gardenId) {
                throw new Error(
                    'Garden ID is required to update garden home position',
                );
            }

            const response = await clientAuthenticated().api.gardens[
                ':gardenId'
            ].$patch({
                param: { gardenId: gardenId.toString() },
                json: { homeCamera },
            });

            if (!response.ok) {
                throw new Error('Failed to update garden home position');
            }
        },
        onMutate: async ({ homeCamera }) => {
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
                        ? { ...currentGarden, homeCamera }
                        : currentGarden,
            );
            queryClient.setQueryData<GardensData>(
                useGardensKeys,
                (currentGardens) =>
                    currentGardens?.map((garden) =>
                        garden.id === gardenId
                            ? { ...garden, homeCamera }
                            : garden,
                    ) ?? currentGardens,
            );

            return { previousGarden, previousGardens };
        },
        onError: (error, _variables, context) => {
            console.error('Failed to update garden home position:', error);
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
        },
    });
}
