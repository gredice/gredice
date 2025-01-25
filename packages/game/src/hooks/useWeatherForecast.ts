import { useQuery } from "@tanstack/react-query";

export interface WeatherEntry {
    time: number;
    temperature: number;
    symbol: number;
    windDirection: string | null;
    windStrength: number;
    rain: number;
}

export interface DayForecast {
    date: string;
    minTemp: number;
    maxTemp: number;
    symbol: number;
    windDirection: string | null;
    windStrength: number;
    rain: number;
    entries: WeatherEntry[];
}

export function useWeatherForecast() {
    return useQuery({
        queryKey: ['weather', 'forecast'],
        queryFn: async () => {
            const response = await fetch('/api/data/weather')
            const data = await response.json();
            return data as DayForecast[];
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}