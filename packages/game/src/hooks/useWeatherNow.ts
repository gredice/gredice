import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../utils/apiFetch";

export type WeatherNow = {
    symbol: number;
    temperature: number;
    rain: number;
    windDirection: string;
    windSpeed: number;
    snowy: number;
    rainy: number;
    foggy: number;
    cloudy: number;
    thundery: number;
};

export function useWeatherNow() {
    return useQuery({
        queryKey: ['weather', 'now'],
        queryFn: async () => {
            const response = await apiFetch('/api/data/weather/now')
            const data = await response.json();
            return data as WeatherNow;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}