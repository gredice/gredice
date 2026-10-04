import type { QueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';

export function SceneQueryDataCacheProbe({ client }: { client: QueryClient }) {
    const cache = client.getQueryCache();
    const subscribe = useCallback(
        (changed: () => void) => cache.subscribe(changed),
        [cache],
    );
    const snapshot = useCallback(
        () =>
            JSON.stringify(
                cache.getAll().map((query) => ({
                    key: query.queryKey,
                    observers: query.getObserversCount(),
                    status: query.state.status,
                    fetchStatus: query.state.fetchStatus,
                    error: query.state.error?.message ?? null,
                })),
            ),
        [cache],
    );
    const value = useSyncExternalStore(subscribe, snapshot, snapshot);
    return <output data-testid="scene-query-cache">{value}</output>;
}
