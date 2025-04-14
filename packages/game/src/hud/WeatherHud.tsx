"use client"

import { Popper } from "@signalco/ui-primitives/Popper";
import { WeatherForecastDetails } from './components/weather/WeatherForecastDetails';
import { weatherIcons } from './components/weather/WeatherIcons';
import { HudCard } from './components/HudCard';
import { Button } from '@signalco/ui-primitives/Button';
import { useWeatherForecast } from "../hooks/useWeatherForecast";
import { useWeatherNow } from "../hooks/useWeatherNow";
import { Row } from "@signalco/ui-primitives/Row";
import { Typography } from "@signalco/ui-primitives/Typography";
import { WeatherNowDetails } from "./components/weather/WeatherNowDetails";

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
            <Row spacing={1}>
                <Popper
                    side="bottom"
                    sideOffset={12}
                    className="overflow-hidden border-tertiary border-b-4"
                    trigger={(
                        <Button
                            title="Trenutno vrijeme"
                            variant="plain"
                            className="rounded-full px-2 justify-between pr-4 md:pr-2" size="sm">
                            <Row>
                                {WeatherIcon && <WeatherIcon.day className="size-6" />}
                                <Typography level="body2" className="pl-0.5">{weatherData?.temperature}°C</Typography>
                            </Row>
                        </Button>
                    )}>
                    <WeatherNowDetails />
                </Popper>
                {(forecastData && weatherData) && <div className="w-[1px] h-4 border-r hidden md:inline" />}
                {forecastData && (
                    <Popper
                        side="bottom"
                        sideOffset={12}
                        className="overflow-hidden border-tertiary border-b-4"
                        trigger={(
                            <Button
                                title="Prognoza vremena"
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
                        )}>
                        <WeatherForecastDetails />
                    </Popper>
                )}
            </Row>
        </HudCard>
    )
}

