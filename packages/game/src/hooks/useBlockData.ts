import { directoriesClient } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import { useGameState } from '../useGameState';

export function useBlockData() {
    const localSandboxStorageKey = useGameState(
        (state) => state.localSandboxStorageKey,
    );
    const isLocalSandbox = localSandboxStorageKey !== null;

    return useQuery({
        queryKey: isLocalSandbox ? ['blocks', 'local-sandbox'] : ['blocks'],
        queryFn: async () => {
            if (isLocalSandbox) {
                return getLocalSandboxBlockData();
            }

            return (
                (await directoriesClient().GET('/entities/block')).data ?? null
            );
        },
        staleTime: 1000 * 60 * 60, // 1 hour
    });
}
