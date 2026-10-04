import { clientPublic } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';
import { isDeterministicEmptyMockGardenProfile } from '../mockGardenProfilePolicy';
import { useGameState } from '../useGameState';

export function useWeatherNow(enabled = true, farmId?: number | null) {
    const isLocalSandbox = useGameState(
        (state) => state.localSandboxStorageKey !== null,
    );
    const isMock = useGameState((state) => state.isMock);
    const mockGardenProfile = useGameState((state) => state.mockGardenProfile);
    const isDeterministicEmptyMock =
        isMock && isDeterministicEmptyMockGardenProfile(mockGardenProfile);

    return useQuery({
        queryKey: isDeterministicEmptyMock
            ? ['weather', 'now', mockGardenProfile]
            : ['weather', 'now', farmId ?? null],
        queryFn: async () => {
            if (isDeterministicEmptyMock) {
                return null;
            }
            const query: Record<string, string> = {};
            if (farmId != null) query.farmId = farmId.toString();
            const response = await clientPublic().api.data.weather.now.$get({
                query,
            });
            if (!response.ok) {
                console.debug('Weather data unavailable', {
                    status: response.status,
                });
                return null;
            }
            return await response.json();
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        enabled: enabled && !isLocalSandbox,
    });
}
