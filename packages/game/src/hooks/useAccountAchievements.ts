import { clientAuthenticated } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';
import { useCurrentAccount } from './useCurrentAccount';

export const accountAchievementsKeys = ['accounts', 'current', 'achievements'];

export function useAccountAchievements() {
    const account = useCurrentAccount();
    const accountId = account.data?.id;
    const query = useQuery({
        queryKey: [...accountAchievementsKeys, accountId],
        enabled: Boolean(accountId),
        queryFn: async ({ signal }) => {
            const response =
                await clientAuthenticated().api.accounts.current.achievements.$get(
                    {},
                    { init: { signal } },
                );
            if (!response.ok)
                throw new Error('Postignuća trenutno nisu dostupna.');
            const data = await response.json();
            if (data.accountId !== accountId)
                throw new Error(
                    'Račun je promijenjen. Ponovno učitaj postignuća.',
                );
            return data;
        },
        staleTime: 30_000, // Refresh reopened collections and focused windows after 30 seconds.
        refetchInterval: 60_000,
        refetchIntervalInBackground: false,
    });

    // The achievements query stays disabled until the account ID is known, so
    // surface the account query's loading and error state instead of treating
    // a missing ID as an empty collection.
    const waitingForAccount = !accountId;
    return {
        data: query.data,
        isLoading: query.isLoading || (waitingForAccount && account.isLoading),
        error: query.error ?? (waitingForAccount ? account.error : null),
        refetch: () =>
            waitingForAccount ? account.refetch() : query.refetch(),
    };
}
