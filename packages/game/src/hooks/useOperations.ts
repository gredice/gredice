import { directoriesClient } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';
import {
    highTargetOperationVisualOperationDefinitions,
    isOperationVisualRewardDebugProfile,
    operationVisualRewardDebugOperationDefinitions,
} from '../operationVisualRewardDebugProfile';
import { useOptionalGameState } from '../useGameState';
import { resolveHighTargetOperationVisualsEnabled } from './mockGardenProfileFixtures';

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

function isHighTargetOperationVisualsProfile(
    isMock: boolean,
    mockGardenProfile: string,
) {
    return (
        isMock &&
        mockGardenProfile === 'high-target' &&
        resolveHighTargetOperationVisualsEnabled(
            typeof window === 'undefined' ? undefined : window.location.search,
        )
    );
}

export function useOperations() {
    const isMock = useOptionalGameState((state) => state.isMock, false);
    const mockGardenProfile = useOptionalGameState(
        (state) => state.mockGardenProfile,
        'default',
    );
    const isOperationRewardDebug =
        isMock && isOperationVisualRewardDebugProfile(mockGardenProfile);
    const isHighTargetMock = isMock && mockGardenProfile === 'high-target';
    const highTargetOperationVisuals = isHighTargetOperationVisualsProfile(
        isMock,
        mockGardenProfile,
    );

    return useQuery({
        queryKey:
            isOperationRewardDebug || isHighTargetMock
                ? [
                      'operations',
                      mockGardenProfile,
                      highTargetOperationVisuals
                          ? 'operation-visuals'
                          : 'empty',
                  ]
                : ['operations'],
        queryFn: async () =>
            isOperationRewardDebug
                ? operationVisualRewardDebugOperationDefinitions
                : highTargetOperationVisuals
                  ? highTargetOperationVisualOperationDefinitions
                  : isHighTargetMock
                    ? []
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
    const isHighTargetMock = isMock && mockGardenProfile === 'high-target';
    const highTargetOperationVisuals = isHighTargetOperationVisualsProfile(
        isMock,
        mockGardenProfile,
    );

    return useQuery({
        queryKey: operationDefinitionsQueryKey.byProfile(
            isOperationRewardDebug || isHighTargetMock
                ? `${mockGardenProfile}:${
                      highTargetOperationVisuals ? 'operation-visuals' : 'empty'
                  }`
                : null,
        ),
        queryFn: async () =>
            isOperationRewardDebug
                ? operationVisualRewardDebugOperationDefinitions
                : highTargetOperationVisuals
                  ? highTargetOperationVisualOperationDefinitions
                  : isHighTargetMock
                    ? []
                    : getOperations({ includeInternal: true }),
        staleTime: 1000 * 60 * 60, // 1 hour
    });
}
