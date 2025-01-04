"use client"

import { useState } from 'react'
import { Popper } from "@signalco/ui-primitives/Popper";
import { WeatherDetails } from './components/weather/WeatherDetails';
import { weatherIcons, WeatherIconType } from './components/weather/WeatherIcons';
import { HudCard } from './components/HudCard';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@signalco/ui-primitives/Button';

export type WeatherType = WeatherIconType
export type WindDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'

export type WeatherDay = {
    day: string
    weather: WeatherType
    tempMax: number
    tempMin: number
    rain: number
    wind: {
        speed: number
        direction: WindDirection
    }
}

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

function useWeatherData() {
    return useQuery({
        queryKey: ['weather'],
        queryFn: async () => {
            const response = await fetch('/api/data/weather')
            const data = await response.json();
            return data as DayForecast[];
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

export function WeatherHud() {
    const { data: weatherData } = useWeatherData();

    return (
        <HudCard
            open
            position="floating"
            className="right-[68px] md:right-24 top-2">
            {/* TODO Loading indicator */}
            {weatherData && (
                <Popper
                    side="bottom"
                    sideOffset={12}
                    className="overflow-hidden"
                    trigger={(
                        <Button
                            variant="plain"
                            className="rounded-full px-2 justify-between" size="sm">
                            <div className="flex space-x-2">
                                {weatherData.slice(0, 3).map((day, index) => {
                                    const WeatherIcon = weatherIcons[day.symbol];
                                    return (
                                        <div key={day.date} className={`flex items-center ${index > 0 ? 'hidden md:flex' : ''}`}>
                                            {WeatherIcon && <WeatherIcon.day className="w-6 h-6 text-gray-800" />}
                                        </div>
                                    )
                                })}
                            </div>
                        </Button>
                    )}>
                    {/* TODO Loading indicator */}
                    {weatherData && (
                        <WeatherDetails data={weatherData} />
                    )}
                </Popper>
            )}
        </HudCard>
    )
}

