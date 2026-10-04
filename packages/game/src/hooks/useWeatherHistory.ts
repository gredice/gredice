import { clientPublic } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

/**
 * Fetch recorded weather history within an optional date range.
 */
export function useWeatherHistory(from?: Date, to?: Date, enabled = true) {
    const fromIso = from?.toISOString();
    const toIso = to?.toISOString();
    return useQuery({
        queryKey: ['weather', 'history', fromIso ?? null, toIso ?? null],
        queryFn: async () => {
            const query: Record<string, string> = {};
            if (fromIso) query.from = fromIso;
            if (toIso) query.to = toIso;
            const response = await clientPublic().api.data.weather.history.$get(
                { query },
            );
            if (!response.ok) {
                console.debug('Weather history unavailable', {
                    status: response.status,
                });
                return [];
            }
            return await response.json();
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        enabled,
    });
}

/**
 * Fetch the available range (earliest/latest timestamps) of weather history.
 */
export function useWeatherHistoryRange(enabled = true) {
    return useQuery({
        queryKey: ['weather', 'history', 'range'],
        queryFn: async () => {
            const response =
                await clientPublic().api.data.weather.history.range.$get();
            if (!response.ok) {
                return { from: null, to: null };
            }
            return await response.json();
        },
        staleTime: 30 * 60 * 1000, // 30 minutes
        enabled,
    });
}
