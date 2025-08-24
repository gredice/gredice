import type { QueryClient, QueryKey } from '@tanstack/react-query';

export async function handleOptimisticUpdate<T>(
    client: QueryClient,
    key: QueryKey,
    newItem: T,
) {
    await client.cancelQueries({ queryKey: key });
    const previousItem = client.getQueryData(key);
    if (previousItem) {
        client.setQueryData(key, (old: T) => ({ ...old, ...newItem }));
    }
    return previousItem;
}
