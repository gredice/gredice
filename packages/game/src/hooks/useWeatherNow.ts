import { client } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export function useWeatherNow(enabled = true) {
    return useQuery({
        queryKey: ['weather', 'now'],
        queryFn: async () => {
            const response = await client().api.data.weather.now.$get();
            if (response.status === 500) {
                console.error('Failed to fetch weather data', response);
                return null;
            }
            return await response.json();
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        enabled,
    });
}