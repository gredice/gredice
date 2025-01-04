"use client"

import { Popper } from "@signalco/ui-primitives/Popper";
import { WeatherDetails } from './components/weather/WeatherDetails';
import { weatherIcons } from './components/weather/WeatherIcons';
import { HudCard } from './components/HudCard';
import { Button } from '@signalco/ui-primitives/Button';
import { useWeatherForecast } from "../hooks/useWeatherForecast";

export function WeatherHud() {
    const { data: weatherData } = useWeatherForecast();

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

