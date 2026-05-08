import { clientAuthenticated } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export const useGardensKeys = ['gardens'];

export function useGardens(disabled?: boolean) {
    return useQuery({
        queryKey: useGardensKeys,
        queryFn: async () => {
            const resp = await clientAuthenticated().api.gardens.$get();
            if (resp.status === 401) return null;

            return resp.json();
        },
        retry: false,
        enabled: !disabled,
        staleTime: 1000 * 60 * 60, // 1h
    });
}
