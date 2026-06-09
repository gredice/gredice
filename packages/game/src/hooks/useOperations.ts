import { directoriesClient } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';
import {
    isOperationVisualRewardDebugProfile,
    operationVisualRewardDebugOperationDefinitions,
} from '../operationVisualRewardDebugProfile';
import { useGameState } from '../useGameState';

async function getOperations() {
    const operations = await directoriesClient().GET('/entities/operation');
    return (operations.data ?? [])
        .filter((operation) => operation.attributes.internal !== true)
        .sort((a, b) => a.information.name.localeCompare(b.information.name));
}

export function useOperations() {
    const isMock = useGameState((state) => state.isMock);
    const mockGardenProfile = useGameState((state) => state.mockGardenProfile);
    const isOperationRewardDebug =
        isMock && isOperationVisualRewardDebugProfile(mockGardenProfile);

    return useQuery({
        queryKey: [
            'operations',
            isOperationRewardDebug ? mockGardenProfile : 'directory',
        ],
        queryFn: async () =>
            isOperationRewardDebug
                ? operationVisualRewardDebugOperationDefinitions
                : getOperations(),
        staleTime: 1000 * 60 * 60, // 1 hour
    });
}
