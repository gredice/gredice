import { clientPublic } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';
import { useGameState } from '../useGameState';

export function useWeatherNow(enabled = true) {
    const isLocalSandbox = useGameState(
        (state) => state.localSandboxStorageKey !== null,
    );

    return useQuery({
        queryKey: ['weather', 'now'],
        queryFn: async () => {
            const response = await clientPublic().api.data.weather.now.$get();
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
