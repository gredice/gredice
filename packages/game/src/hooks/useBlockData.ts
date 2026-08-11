import { directoriesClient } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';
import { withInternalSceneBlockData } from '../internalSceneBlockData';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import { useGameState } from '../useGameState';

export function useBlockData() {
    const isMock = useGameState((state) => state.isMock);
    const localSandboxStorageKey = useGameState(
        (state) => state.localSandboxStorageKey,
    );
    const isLocalSandbox = localSandboxStorageKey !== null;
    const useLocalBlockData = isLocalSandbox || isMock;

    return useQuery({
        queryKey: useLocalBlockData ? ['blocks', 'local'] : ['blocks'],
        queryFn: async () => {
            if (useLocalBlockData) {
                return withInternalSceneBlockData(getLocalSandboxBlockData());
            }

            const blockData = (await directoriesClient().GET('/entities/block'))
                .data;
            return blockData ? withInternalSceneBlockData(blockData) : null;
        },
        staleTime: 1000 * 60 * 60, // 1 hour
    });
}
