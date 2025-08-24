import { directoriesClient } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

async function getOperations() {
    const operations = await directoriesClient().GET('/entities/operation');
    return operations.data?.sort((a, b) =>
        a.information.name.localeCompare(b.information.name),
    );
}

export function useOperations() {
    return useQuery({
        queryKey: ['operations'],
        queryFn: getOperations,
        staleTime: 1000 * 60 * 60, // 1 hour
    });
}
