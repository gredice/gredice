import { clientAuthenticated } from '@gredice/client';
import type { GameBackgroundPaletteKey } from '@gredice/js/gameBackground';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { handleOptimisticUpdate } from '../helpers/queryHelpers';
import { persistLocalSandboxGarden } from '../localSandboxGarden';
import { useGameState } from '../useGameState';
import { currentGardenKeys, useCurrentGarden } from './useCurrentGarden';

const mutationKey = ['gardens', 'current', 'backgroundPalette'];

type CurrentGardenData = NonNullable<
    ReturnType<typeof useCurrentGarden>['data']
>;

type BackgroundPaletteVariables = {
    backgroundPalette: GameBackgroundPaletteKey;
    previousBackgroundPalette: GameBackgroundPaletteKey;
};

export function useCycleGardenBackgroundPalette() {
    const queryClient = useQueryClient();
    const { data: garden } = useCurrentGarden();
    const localSandboxStorageKey = useGameState(
        (state) => state.localSandboxStorageKey,
    );
    const isMock = useGameState((state) => state.isMock);
    const winterMode = useGameState((state) => state.winterMode);
    const cycleBackgroundPalette = useGameState(
        (state) => state.cycleBackgroundPalette,
    );
    const setBackgroundPaletteKey = useGameState(
        (state) => state.setBackgroundPaletteKey,
    );
    const gardenQueryKey = currentGardenKeys(
        winterMode,
        garden?.id,
        undefined,
        localSandboxStorageKey,
    );

    const mutation = useMutation({
        mutationKey,
        mutationFn: async ({
            backgroundPalette,
        }: BackgroundPaletteVariables) => {
            if (!garden) {
                throw new Error('No garden selected');
            }

            if (isMock || localSandboxStorageKey) {
                return;
            }

            const response = await clientAuthenticated().api.gardens[
                ':gardenId'
            ].$patch({
                param: {
                    gardenId: garden.id.toString(),
                },
                json: {
                    backgroundPalette,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to update garden background palette');
            }
        },
        onMutate: async ({ backgroundPalette, previousBackgroundPalette }) => {
            const previousItem = await handleOptimisticUpdate(
                queryClient,
                gardenQueryKey,
                {
                    backgroundPalette,
                },
            );

            const currentGarden =
                queryClient.getQueryData<CurrentGardenData>(gardenQueryKey) ??
                garden;
            if (localSandboxStorageKey && currentGarden) {
                persistLocalSandboxGarden(localSandboxStorageKey, {
                    ...currentGarden,
                    backgroundPalette,
                });
            }

            return {
                previousBackgroundPalette,
                previousItem,
            };
        },
        onError: (error, _variables, context) => {
            console.error('Error updating garden background palette', error);
            if (context?.previousBackgroundPalette) {
                setBackgroundPaletteKey(context.previousBackgroundPalette);
            }
            if (context?.previousItem) {
                queryClient.setQueryData(gardenQueryKey, context.previousItem);
            }
        },
        onSettled: async () => {
            if (isMock || localSandboxStorageKey) {
                return;
            }

            if (queryClient.isMutating({ mutationKey }) === 1) {
                await queryClient.invalidateQueries({
                    queryKey: gardenQueryKey,
                });
            }
        },
    });

    return () => {
        if (!garden) {
            return;
        }

        const { nextKey, previousKey } = cycleBackgroundPalette();
        mutation.mutate({
            backgroundPalette: nextKey,
            previousBackgroundPalette: previousKey,
        });
    };
}
