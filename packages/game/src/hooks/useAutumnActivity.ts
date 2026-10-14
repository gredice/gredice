import { getAutumnActivityState } from '@gredice/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAutumnActivityContext } from './useAutumnActivityContext';
import { currentAccountKeys } from './useCurrentAccount';
import { gardenAccountGroupsKeys } from './useGardenAccountGroups';

class AutumnActivityOwnerChanged extends Error {}

export const autumnActivityKeys = ['autumn-activity'];
export const activityRefreshKey = (owner: string) =>
    `gredice:autumn-activity-refresh:v1:${owner}`;

export function useAutumnActivity() {
    const context = useAutumnActivityContext();
    const client = useQueryClient();
    const key = [...autumnActivityKeys, context.userId, context.accountId];
    const owner = JSON.stringify([context.userId, context.accountId]);
    const query = useQuery({
        queryKey: key,
        enabled: context.eligible,
        retry: false,
        staleTime: 15_000,
        refetchInterval: 60_000,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: 'always',
        refetchOnReconnect: 'always',
        queryFn: async ({ signal }) => {
            const state = await getAutumnActivityState({ signal });
            if (state.accountId !== context.accountId) {
                void client.invalidateQueries({ queryKey: currentAccountKeys });
                void client.invalidateQueries({
                    queryKey: gardenAccountGroupsKeys,
                });
                throw new AutumnActivityOwnerChanged(
                    'Račun se promijenio. Ponovno učitaj jesenski album.',
                );
            }
            return state;
        },
    });
    useEffect(() => {
        if (!context.eligible) return;
        const refresh = (event: StorageEvent) => {
            if (event.key === activityRefreshKey(owner))
                void client.invalidateQueries({
                    queryKey: [
                        ...autumnActivityKeys,
                        context.userId,
                        context.accountId,
                    ],
                });
        };
        window.addEventListener('storage', refresh);
        return () => window.removeEventListener('storage', refresh);
    }, [client, context.eligible, context.userId, context.accountId, owner]);
    return {
        ...query,
        data:
            query.error instanceof AutumnActivityOwnerChanged
                ? undefined
                : query.data,
        context,
    };
}
