import { client } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGameState } from '../useGameState';
import { currentGardenKeys } from './useCurrentGarden';
import { useCurrentUser } from './useCurrentUser';

export function useUpdateRaisedBed(gardenId: number, raisedBedId: number) {
    const queryClient = useQueryClient();
    const currentUser = useCurrentUser();
    const winterMode = useGameState((state) => state.winterMode);
    const gardenQueryKey = currentGardenKeys(winterMode);

    return useMutation({
        mutationFn: async ({ name }: { name?: string | null }) => {
            if (!currentUser.data) {
                throw new Error('Current user data is not available');
            }

            await client().api.gardens[':gardenId']['raised-beds'][
                ':raisedBedId'
            ].$patch({
                param: {
                    gardenId: gardenId.toString(),
                    raisedBedId: raisedBedId.toString(),
                },
                json: {
                    name: name || undefined,
                },
            });
        },
        onError: (error) => {
            console.error('Failed to update raised bed:', error);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: gardenQueryKey });
        },
    });
}
