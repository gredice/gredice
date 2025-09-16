import { client } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { currentGardenKeys } from './useCurrentGarden';
import { useGardensKeys } from './useGardens';

type RenameGardenVariables = {
    name: string;
};

export function useRenameGarden(gardenId?: number) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ name }: RenameGardenVariables) => {
            if (!gardenId) {
                throw new Error('Garden ID is required to rename a garden');
            }

            const trimmedName = name.trim();
            if (!trimmedName) {
                throw new Error('Garden name is required');
            }

            await client().api.gardens[':gardenId'].$patch({
                param: { gardenId: gardenId.toString() },
                json: { name: trimmedName },
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: currentGardenKeys });
            queryClient.invalidateQueries({ queryKey: useGardensKeys });
        },
        onError: (error) => {
            console.error('Failed to rename garden:', error);
        },
    });
}
