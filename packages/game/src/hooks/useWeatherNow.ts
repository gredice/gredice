import { clientPublic } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';
import { useGameState } from '../useGameState';

export function useWeatherNow(enabled = true, farmId?: number | null) {
    const isLocalSandbox = useGameState(
        (state) => state.localSandboxStorageKey !== null,
    );

    return useQuery({
        queryKey: ['weather', 'now', farmId ?? null],
        queryFn: async () => {
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
