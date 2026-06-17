import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGameState } from '../useGameState';
import { currentGardenKeys } from './useCurrentGarden';
import { useGardensKeys } from './useGardens';
import { tutorialChecklistKeys } from './useTutorialChecklist';

type CreateGardenVariables = {
    name?: string;
    isSandbox?: boolean;
};

export function useCreateGarden() {
    const queryClient = useQueryClient();
    const winterMode = useGameState((state) => state.winterMode);
    const gardenQueryKey = currentGardenKeys(winterMode);

    return useMutation({
        mutationFn: async ({ name, isSandbox }: CreateGardenVariables) => {
            const trimmedName = name?.trim();
            const response = await clientAuthenticated().api.gardens.$post({
                json: {
                    ...(trimmedName ? { name: trimmedName } : {}),
                    ...(isSandbox ? { isSandbox: true } : {}),
                },
            });
            if (!response.ok) {
                throw new Error('Failed to create garden');
            }
            return await response.json();
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: useGardensKeys });
            await queryClient.invalidateQueries({ queryKey: gardenQueryKey });
            await queryClient.invalidateQueries({
                queryKey: tutorialChecklistKeys,
            });
        },
        onError: (error) => {
            console.error('Failed to create garden:', error);
        },
    });
}
