import { useQuery } from "@tanstack/react-query";
import { client } from "@gredice/client";

export function useWeatherForecast() {
    return useQuery({
        queryKey: ['weather', 'forecast'],
        queryFn: async () => {
            const response = await client().api.data.weather.$get();
            return await response.json();
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}