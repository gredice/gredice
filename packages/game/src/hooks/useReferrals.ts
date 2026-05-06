import { clientAuthenticated } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export function useReferrals() {
    return useQuery({
        queryKey: ['accounts', 'current', 'referrals'],
        queryFn: async () => {
            const response =
                await clientAuthenticated().api.accounts.current.referrals.$get();
            if (!response.ok) throw new Error('Failed to fetch referrals');
            return await response.json();
        },
    });
}
