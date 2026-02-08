import { client } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGameState } from '../useGameState';
import { currentGardenKeys } from './useCurrentGarden';
import { useGardensKeys } from './useGardens';

type CreateGardenVariables = {
    name?: string;
};

export function useCreateGarden() {
    const queryClient = useQueryClient();
    const winterMode = useGameState((state) => state.winterMode);
    const gardenQueryKey = currentGardenKeys(winterMode);

    return useMutation({
        mutationFn: async ({ name }: CreateGardenVariables) => {
            const trimmedName = name?.trim();
            await client().api.gardens.$post({
                json: trimmedName ? { name: trimmedName } : {},
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: useGardensKeys });
            queryClient.invalidateQueries({ queryKey: gardenQueryKey });
        },
        onError: (error) => {
            console.error('Failed to create garden:', error);
        },
    });
}
