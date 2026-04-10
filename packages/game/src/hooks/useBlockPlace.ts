import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGameState } from '../useGameState';
import { currentAccountKeys } from './useCurrentAccount';
import { currentGardenKeys, useCurrentGarden } from './useCurrentGarden';

const mutationKey = ['gardens', 'current', 'blockPlace'];

async function getBlockPlacementError(response: Response) {
    const responseText = await response.text();
    if (!responseText) {
        return 'Failed to place block';
    }

    try {
        const parsedResponse = JSON.parse(responseText) as {
            error?: string;
        };
        return parsedResponse.error ?? responseText;
    } catch {
        return responseText;
    }
}

export function useBlockPlace() {
    const queryClient = useQueryClient();
    const { data: garden } = useCurrentGarden();
    const winterMode = useGameState((state) => state.winterMode);
    const gardenQueryKey = currentGardenKeys(winterMode, garden?.id);

    return useMutation({
        mutationKey,
        mutationFn: async ({ blockName }: { blockName: string }) => {
            if (!garden) {
                throw new Error('No garden selected');
            }
            const response = await clientAuthenticated().api.gardens[
                ':gardenId'
            ].blocks.$post({
                param: {
                    gardenId: garden.id.toString(),
                },
                json: {
                    blockName,
                },
            });
            if (!response.ok) {
                throw new Error(await getBlockPlacementError(response));
            }

            return await response.json();
        },
        onError: (error) => {
            console.error('Error creating block', error);
        },
        onSettled: async () => {
            await queryClient.invalidateQueries({
                queryKey: currentAccountKeys,
            });
            if (queryClient.isMutating({ mutationKey }) === 1) {
                await queryClient.invalidateQueries({
                    queryKey: gardenQueryKey,
                });
            }
        },
    });
}
