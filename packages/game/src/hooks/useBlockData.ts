import { directoriesClient } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export function useBlockData() {
    return useQuery({
        queryKey: ['blocks'],
        queryFn: async () => {
            return (
                (await directoriesClient().GET('/entities/block')).data ?? null
            );
        },
        staleTime: 1000 * 60 * 60, // 1 hour
    });
}
