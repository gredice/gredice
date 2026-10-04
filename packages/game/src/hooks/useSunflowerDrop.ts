import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { currentAccountKeys } from './useCurrentAccount';

export const sunflowerDropKeys = (gardenId: number | null | undefined) => [
    'accounts',
    'current',
    'sunflowers',
    'drops',
    gardenId ?? null,
];

export function useSunflowerDrop(
    gardenId: number | null | undefined,
    enabled = true,
) {
    return useQuery({
        queryKey: sunflowerDropKeys(gardenId),
        queryFn: async () => {
            if (gardenId == null) {
                return null;
            }

            const response =
                await clientAuthenticated().api.accounts.current.sunflowers.drops.gardens[
                    ':gardenId'
                ].$get({
                    param: {
                        gardenId: gardenId.toString(),
                    },
                });
            if (response.status === 401) {
                return null;
            }
            if (!response.ok) {
                throw new Error(
                    `Failed to load sunflower drop: ${response.status} ${response.statusText}`,
                );
            }

            return await response.json();
        },
        enabled: enabled && gardenId != null,
        refetchOnWindowFocus: false,
        retry: false,
        staleTime: 0,
    });
}

export function useClaimSunflowerDrop() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (spawnId: string) => {
            const response =
                await clientAuthenticated().api.accounts.current.sunflowers.drops[
                    ':spawnId'
                ].claim.$post({
                    param: {
                        spawnId,
                    },
                });
            if (!response.ok) {
                throw new Error(
                    `Failed to claim sunflower drop: ${response.status} ${response.statusText}`,
                );
            }

            return await response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: currentAccountKeys });
            queryClient.invalidateQueries({
                queryKey: ['accounts', 'current', 'sunflowers', 'drops'],
            });
        },
    });
}
