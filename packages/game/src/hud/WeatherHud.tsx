"use client"

import { Popper } from "@signalco/ui-primitives/Popper";
import { WeatherDetails } from './components/weather/WeatherDetails';
import { weatherIcons } from './components/weather/WeatherIcons';
import { HudCard } from './components/HudCard';
import { Button } from '@signalco/ui-primitives/Button';
import { useWeatherForecast } from "../hooks/useWeatherForecast";
import { useWeatherNow } from "../hooks/useWeatherNow";
import { Row } from "@signalco/ui-primitives/Row";
import { Typography } from "@signalco/ui-primitives/Typography";

export function WeatherHud() {
    const { data: weatherData } = useWeatherNow();
    const { data: forecastData } = useWeatherForecast();
    if (!forecastData || !weatherData) return null;
    // TODO: Add loading indicator    
    // TODO: Add error message
    // TODO: Show night icons when it's night for weather

    const WeatherIcon = weatherData ? weatherIcons[weatherData.symbol] : null;

    return (
        <HudCard
            open
            position="floating"
            className="static md:px-1">
            {forecastData && (
                <Popper
                    side="bottom"
                    sideOffset={12}
                    className="overflow-hidden"
                    trigger={(
                        <Row spacing={1}>
                            <Button
                                aria-label="Trenutno vrijeme"
                                variant="plain"
                                className="rounded-full px-2 justify-between pr-4 md:pr-2" size="sm">
                                <Row>
                                    {WeatherIcon && <WeatherIcon.day className="size-6" />}
                                    <Typography level="body2" className="pl-0.5">{weatherData?.temperature}°C</Typography>
                                </Row>
                            </Button>
                            <div className="w-[1px] h-4 border-r hidden md:inline" />
                            <Button
                                aria-label="Prognoza vremena"
                                variant="plain"
                                className="rounded-full px-2 justify-between pr-4 md:pr-2 hidden md:flex" size="sm">
                                <Row spacing={1}>
                                    {forecastData.slice(0, 3).map((day) => {
                                        const ForecastIcon = weatherIcons[day.symbol];
                                        if (!ForecastIcon) return null;
                                        return <ForecastIcon.day key={day.date} className="size-6" />;
                                    })}
                                </Row>
                            </Button>
                        </Row>
                    )}>
                    <WeatherDetails />
                </Popper>
            )}
        </HudCard>
    )
}

