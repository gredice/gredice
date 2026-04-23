'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { Popper } from '@signalco/ui-primitives/Popper';
import { Row } from '@signalco/ui-primitives/Row';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useWeatherForecast } from '../hooks/useWeatherForecast';
import { useWeatherNow } from '../hooks/useWeatherNow';
import { useGameState } from '../useGameState';
import { HudCard } from './components/HudCard';
import { TimeDisplay } from './components/TimeDisplay';
import { WeatherForecastDetails } from './components/weather/WeatherForecastDetails';
import { weatherIcons } from './components/weather/WeatherIcons';
import { WeatherNowDetails } from './components/weather/WeatherNowDetails';

export function WeatherHud({ noWeather }: { noWeather?: boolean }) {
    const currentTime = useGameState((state) => state.currentTime);
    const weatherEnabled = !noWeather;
    const { data: weatherData } = useWeatherNow(weatherEnabled);
    const { data: forecastData } = useWeatherForecast(weatherEnabled);
    if (!weatherEnabled) return null;
    // TODO: Add loading indicator
    // TODO: Add error message
    // TODO: Show night icons when it's night for weather

    const WeatherIcon = weatherData ? weatherIcons[weatherData.symbol] : null;
    const formattedTime = currentTime?.toLocaleTimeString('hr-HR', {
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <HudCard open position="floating" className="static md:px-1">
            <Row spacing={1}>
                {weatherData && (
                    <Popper
                        side="bottom"
                        sideOffset={12}
                        className="overflow-hidden border-tertiary border-b-4 w-full"
                        trigger={
                            <Button
                                title="Trenutno vrijeme"
                                variant="plain"
                                className="rounded-full px-2 justify-between pr-4 md:pr-2"
                            >
                                <Row>
                                    {WeatherIcon && (
                                        <WeatherIcon.day className="size-6" />
                                    )}
                                    <Typography
                                        level="body2"
                                        className="text-base pl-0.5"
                                    >
                                        {weatherData.measuredTemperature?.toFixed(
                                            1,
                                        ) ?? weatherData.temperature}
                                        °C
                                    </Typography>
                                </Row>
                            </Button>
                        }
                    >
                        <WeatherNowDetails />
                    </Popper>
                )}
                {weatherData && (forecastData || formattedTime) && (
                    <div className="w-[1px] h-4 border-r" />
                )}
                {forecastData && (
                    <Popper
                        side="bottom"
                        sideOffset={12}
                        className="overflow-hidden border-tertiary border-b-4"
                        trigger={
                            <Button
                                title="Prognoza vremena"
                                variant="plain"
                                className="rounded-full px-2 justify-between pr-4 md:pr-2 hidden md:flex"
                            >
                                <Row spacing={1}>
                                    {forecastData.slice(0, 3).map((day) => {
                                        const ForecastIcon =
                                            weatherIcons[day.symbol];
                                        if (!ForecastIcon) return null;
                                        return (
                                            <ForecastIcon.day
                                                key={day.date}
                                                className="size-6"
                                            />
                                        );
                                    })}
                                </Row>
                            </Button>
                        }
                    >
                        <WeatherForecastDetails />
                    </Popper>
                )}
                {forecastData && formattedTime && (
                    <div className="w-[1px] h-4 border-r hidden md:inline" />
                )}
                {formattedTime && (
                    <Popper
                        side="bottom"
                        sideOffset={12}
                        className="overflow-hidden border-tertiary border-b-4"
                        trigger={
                            <Button
                                title="Doba dana"
                                variant="plain"
                                className="rounded-full px-2"
                            >
                                <Typography level="body2" className="text-base">
                                    {formattedTime}
                                </Typography>
                            </Button>
                        }
                    >
                        <TimeDisplay variant="card" />
                    </Popper>
                )}
            </Row>
        </HudCard>
    );
}
