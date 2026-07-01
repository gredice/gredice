import { directoriesClient } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';
import {
    isOperationVisualRewardDebugProfile,
    operationVisualRewardDebugOperationDefinitions,
} from '../operationVisualRewardDebugProfile';
import { useOptionalGameState } from '../useGameState';

export const operationDefinitionsQueryKey = {
    all: ['operation-definitions'] as const,
    byProfile: (profile?: string | null) =>
        profile
            ? (['operation-definitions', profile] as const)
            : (['operation-definitions'] as const),
};

async function getOperations({ includeInternal = false } = {}) {
    const operations = await directoriesClient().GET('/entities/operation');
    return (operations.data ?? [])
        .filter(
            (operation) =>
                includeInternal || operation.attributes.internal !== true,
        )
        .sort((a, b) => a.information.name.localeCompare(b.information.name));
}

export function useOperations() {
    const isMock = useOptionalGameState((state) => state.isMock, false);
    const mockGardenProfile = useOptionalGameState(
        (state) => state.mockGardenProfile,
        'default',
    );
    const isOperationRewardDebug =
        isMock && isOperationVisualRewardDebugProfile(mockGardenProfile);

    return useQuery({
        queryKey: isOperationRewardDebug
            ? ['operations', mockGardenProfile]
            : ['operations'],
        queryFn: async () =>
            isOperationRewardDebug
                ? operationVisualRewardDebugOperationDefinitions
                : getOperations(),
        staleTime: 1000 * 60 * 60, // 1 hour
    });
}

export function useOperationDefinitions() {
    const isMock = useOptionalGameState((state) => state.isMock, false);
    const mockGardenProfile = useOptionalGameState(
        (state) => state.mockGardenProfile,
        'default',
    );
    const isOperationRewardDebug =
        isMock && isOperationVisualRewardDebugProfile(mockGardenProfile);

    return useQuery({
        queryKey: operationDefinitionsQueryKey.byProfile(
            isOperationRewardDebug ? mockGardenProfile : null,
        ),
        queryFn: async () =>
            isOperationRewardDebug
                ? operationVisualRewardDebugOperationDefinitions
                : getOperations({ includeInternal: true }),
        staleTime: 1000 * 60 * 60, // 1 hour
    });
}
