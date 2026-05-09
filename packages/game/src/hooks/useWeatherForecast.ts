import { clientPublic } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export function useWeatherForecast(enabled = true) {
    return useQuery({
        queryKey: ['weather', 'forecast'],
        queryFn: async () => {
            const response = await clientPublic().api.data.weather.$get();
            return await response.json();
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        enabled,
    });
}
