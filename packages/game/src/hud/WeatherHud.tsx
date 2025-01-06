"use client"

import { Popper } from "@signalco/ui-primitives/Popper";
import { WeatherDetails } from './components/weather/WeatherDetails';
import { weatherIcons } from './components/weather/WeatherIcons';
import { HudCard } from './components/HudCard';
import { Button } from '@signalco/ui-primitives/Button';
import { useWeatherForecast } from "../hooks/useWeatherForecast";
import { useWeatherNow } from "../hooks/useWeatherNow";
import { Row } from "@signalco/ui-primitives/Row";
import { Divide } from "lucide-react";
import { Divider } from "@signalco/ui-primitives/Divider";
import { Typography } from "@signalco/ui-primitives/Typography";

export function WeatherHud() {
    const { data: weatherData } = useWeatherNow();
    const { data: forecastData } = useWeatherForecast();
    if (!forecastData) return null;
    // TODO: Add loading indicator    
    // TODO: Add error message

    const WeatherIcon = weatherData ? weatherIcons[weatherData.symbol] : null;

    return (
        <HudCard
            open
            position="floating"
            className="right-[68px] md:right-24 top-2">
            {/* TODO Loading indicator */}
            {forecastData && (
                <Popper
                    side="bottom"
                    sideOffset={12}
                    className="overflow-hidden"
                    trigger={(
                        <Button
                            variant="plain"
                            className="rounded-full px-2 justify-between pr-4 md:pr-2" size="sm">
                            <Row spacing={1}>
                                <Row>
                                    {WeatherIcon && <WeatherIcon.day className="w-6 h-6 text-gray-800" />}
                                    <Typography level="body2">{weatherData?.temperature}°C</Typography>
                                </Row>
                                <div className="w-[1px] h-4 border-r hidden md:inline" />
                                <Row spacing={1} className="hidden md:flex">
                                    {forecastData.slice(0, 3).map((day) => {
                                        const ForecastIcon = weatherIcons[day.symbol];
                                        if (!ForecastIcon) return null;
                                        return <ForecastIcon.day key={day.date} className="w-6 h-6 text-gray-800" />;
                                    })}
                                </Row>
                            </Row>
                        </Button>
                    )}>
                    <WeatherDetails />
                </Popper>
            )}
        </HudCard>
    )
}

