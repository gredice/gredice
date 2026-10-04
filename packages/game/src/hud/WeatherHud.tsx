'use client';

import { Button } from '@gredice/ui/Button';
import { Warning } from '@gredice/ui/icons';
import { Popper } from '@gredice/ui/Popper';
import { Row } from '@gredice/ui/Row';
import { Typography } from '@gredice/ui/Typography';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useWeatherForecast } from '../hooks/useWeatherForecast';
import { useWeatherNow } from '../hooks/useWeatherNow';
import { HudCard } from './components/HudCard';
import { WeatherForecastDetails } from './components/weather/WeatherForecastDetails';
import { weatherIcons } from './components/weather/WeatherIcons';
import { WeatherNowDetails } from './components/weather/WeatherNowDetails';

const weatherPopperClassName =
    'w-fit max-w-[calc(100vw-1rem)] overflow-hidden border-tertiary border-b-4';

export function WeatherHud({ noWeather }: { noWeather?: boolean }) {
    const weatherEnabled = !noWeather;
    const { data: currentGarden } = useCurrentGarden();
    const farmId = currentGarden?.farmId;
    const { data: weatherData } = useWeatherNow(weatherEnabled, farmId);
    const { data: forecastData } = useWeatherForecast(weatherEnabled);
    if (!weatherEnabled) return null;
    // TODO: Add loading indicator
    // TODO: Add error message
    // TODO: Show night icons when it's night for weather

    const WeatherIcon =
        weatherData?.symbol != null ? weatherIcons[weatherData.symbol] : null;
    const hasAlerts = (weatherData?.alerts?.length ?? 0) > 0;

    return (
        <HudCard open position="floating" className="static md:px-1">
            <Row>
                {weatherData && (
                    <Popper
                        side="bottom"
                        sideOffset={12}
                        className={weatherPopperClassName}
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
                                    {hasAlerts && (
                                        <Warning className="size-4 shrink-0 text-amber-600" />
                                    )}
                                    <Typography
                                        level="body2"
                                        className="text-base pl-0.5"
                                    >
                                        {weatherData.measuredTemperature?.toFixed(
                                            1,
                                        ) ??
                                            weatherData.temperature ??
                                            '—'}
                                        °C
                                    </Typography>
                                </Row>
                            </Button>
                        }
                    >
                        <WeatherNowDetails farmId={farmId} />
                    </Popper>
                )}
                {weatherData && forecastData && (
                    <div className="w-[1px] h-4 border-r" />
                )}
                {forecastData && (
                    <Popper
                        side="bottom"
                        sideOffset={12}
                        className={weatherPopperClassName}
                        trigger={
                            <Button
                                title="Prognoza vremena"
                                variant="plain"
                                className="rounded-full px-2 justify-between pr-4 md:pr-2 hidden md:flex"
                            >
                                <Row spacing={2}>
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
            </Row>
        </HudCard>
    );
}
