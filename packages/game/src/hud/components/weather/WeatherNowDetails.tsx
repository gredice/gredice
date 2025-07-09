import { RainIcon } from './icons/RainIcon'
import { weatherIcons } from './WeatherIcons';
import { Row } from '@signalco/ui-primitives/Row';
import { Typography } from '@signalco/ui-primitives/Typography';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Divider } from '@signalco/ui-primitives/Divider';
import { Link } from '@signalco/ui-primitives/Link';
import { useWeatherNow } from '../../../hooks/useWeatherNow';
import { WeatherForecastDays } from './WeatherForecastDetails';
import { FC, useState } from 'react';
import { Button } from '@signalco/ui-primitives/Button';
import { Empty, Navigate, Wind, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ArrowUpLeft, ArrowUpRight, ArrowDownLeft, ArrowDownRight } from '@signalco/ui-icons';

export const windDirectionIcons: Record<string, FC> = {
    N: ArrowUp,
    NE: ArrowUpRight,
    E: ArrowRight,
    SE: ArrowDownRight,
    S: ArrowDown,
    SW: ArrowDownLeft,
    W: ArrowLeft,
    NW: ArrowUpLeft
}

export function WeatherNowDetails() {
    const { data } = useWeatherNow();
    if (!data) return null;
    // TODO: Add loading indicator
    // TODO: Add error message

    const [showForecast, setShowForecast] = useState(false);

    const WeatherIcon = weatherIcons[data.symbol]
    const WindIcon = data.windDirection ? windDirectionIcons[data.windDirection] : Empty;

    // Chance of rain is a number between 0 and 1,
    // chance is 100 when there is 10 or more mm of rain
    const rainChance = data.rain > 10 ? 1 : (10 / data.rain);

    return (
        <Stack>
            <Row className="bg-background px-4 py-2" justifyContent="space-between">
                <Typography level="body2" bold>Aktualno vrijeme</Typography>
            </Row>
            <Divider />
            {showForecast && <WeatherForecastDays />}
            {!showForecast && (
                <div className='grid grid-cols-[1fr_auto] gap-2'>
                    <Row spacing={1} className='p-4'>
                        <div className="my-1 mr-2">
                            {WeatherIcon && <WeatherIcon.day className="size-12" />}
                        </div>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                            <Stack>
                                <Typography level='body3'>Temperatura (prognoza)</Typography>
                                <Typography semiBold>{data.temperature}°C</Typography>
                            </Stack>
                            {data.measuredTemperature && (
                                <Stack>
                                    <Typography level='body3'>Izmjerena temperatura</Typography>
                                    <Typography semiBold>{data.measuredTemperature.toFixed(1)}°C</Typography>
                                </Stack>
                            )}
                            {data.rain > 0 && (
                                <Stack spacing={0.5}>
                                    <Typography level='body3'>Padaline</Typography>
                                    <div className="flex items-center space-x-1">
                                        <RainIcon chance={rainChance} />
                                        <Typography level="body2">{data.rain} mm</Typography>
                                    </div>
                                </Stack>
                            )}
                            {data.windSpeed > 0 && (
                                <Stack spacing={0.5}>
                                    <Typography level='body3'>Vjetar</Typography>
                                    <div className="flex items-center space-x-1 relative">
                                        <Wind className="w-4 h-4 opacity-40" />
                                        <Row>
                                            {Array(data.windSpeed).fill(0).map((_, i) => (
                                                <WindIcon key={i} className="w-4 h-4 first:ml-0 -ml-1.5" />
                                            ))}
                                        </Row>
                                    </div>
                                </Stack>
                            )}
                        </div>
                    </Row>
                    <div className='border-l block md:hidden'>
                        <Button variant='plain' className='h-full rounded-none' endDecorator={<Navigate />} onClick={() => setShowForecast(true)}>
                            Prognoza
                        </Button>
                    </div>
                </div>
            )}
            <Divider />
            <Row className="px-4 py-2" justifyContent="space-between">
                <Typography level="body3" className='flex gap-1'>
                    <span>Izvor podataka</span>
                    <Link href={"https://meteo.hr/proizvodi.php?section=podaci&param=xml_korisnici"} target='_blank'>
                        <img className='inline' width={18} height={18} alt="DHMZ logo" src="data:image/svg+xml;base64,PHN2ZyBpZD0ibWV0ZW8tbG9nbyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB2aWV3Qm94PSIwIDAgMzM3LjcgMjk3LjE2Ij48ZGVmcz48c3R5bGU+LmNscy0xe2ZpbGw6I2Y2YjUzYTt9LmNscy0xLC5jbHMtMntmaWxsLXJ1bGU6ZXZlbm9kZDt9LmNscy0ye2ZpbGw6IzAwNTc4YTt9PC9zdHlsZT48L2RlZnM+PHRpdGxlPmxvZ288L3RpdGxlPjxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTQ1LDM5Ljg3czM1LjIyLTI3LjU1LDYzLjctMzUuOTJhMTAyLjU5LDEwMi41OSwwLDAsMSw1My40LS44M1pNMTgzLjM0LDE1LDE2MC40OSwyLjI3bC0xNTUsODFMNC40LDg3LjU1LDE4Ny44NCwzMy4zNiwyLjc1LDEzMy40NiwwLDE0MmwxODMuMzMtNTYuNEwyLjUxLDE3NS4xOS44MSwxODEuMDhsMTYxLjM1LTQyLjYxTDYuNDMsMjE2Ljc4bDQuOTMsNi41NEwxNjQsMTgyLjA2LDIzLjIzLDI1Ni42OGw5LjkxLDYuODlMMTU2LjgsMjMzLjMyLDY4LjUxLDI3OS4yczM1LjQzLDExLjg4LDY5LjA2LDQuNjdhMTY0LjQyLDE2NC40MiwwLDAsMCw1OC4xOS0yNS42NmwtODYsMTQuNzNMMjY0LDE4Ny4zM2wtMTkxLDUyLjgsMTgwLjItOTYuMjctNjguODIsMTcuODgtODcuODQsMjIsMTM5LjItNjQuMjUsMzIuNTQtMjQuOTJMODMuNTgsMTQ1Ljg0LDIzNy41MSw2NS41N2wtNi43MS0xMS43NUw5My44LDkzLjIzLDIxMCwzMi41OGwtMTYuODktMTMuM0wxMjIsNDMuNTdaIi8+PHBhdGggY2xhc3M9ImNscy0yIiBkPSJNMTE4LjQxLDQ3LjUzczIzLTIxLjI4LDU4LTMxLDY1Ljc3LS42LDY1Ljc3LS42Wk0yNDEuNjIsMTUuNjQsOTMuOCw5My4yM2wxNzguNi00Ny4zMUw4My41OCwxNDUuODQsMjYyLjQsMTAwbC0xNjUuOCw4My44LDg3Ljg0LTIyLDEzOC4zLTc0LjExLTYtMTEuMzdMMTkzLjY2LDEwOS40MywyOTcuODQsNTMuMjNsLTE5LjA1LTE3TDE5NC43NSw1OGw2OC41LTMyWm05My4zMiwxMDYuNTEtODEuNjksMjEuNzFMNzMuMDUsMjQwLjEzLDI0OCwxOTUsMTAxLjkzLDI3Ny4zNCwyMzYuNDQsMjQ5LjhsLTg3Ljg3LDQzLjUxczQzLjc2LDEzLjgxLDkxLTEwLjkyYzI0Ljg5LTEzLDc5LjMzLTU4Ljc1LDc5LjMzLTU4Ljc1bDQuNjQtNy44Mi0xNTMuNCw0MEwzMzcuNywxNjcuNjZsLS40LTUuN0wxOTcuMDcsMTk5LjE1LDMzNS44LDEyNy45M1oiLz48L3N2Zz4=" />
                        <span>DHMZ</span>
                    </Link>
                    <span>•</span>
                    <Link href="https://signalco.io" target="_blank">
                        <img className="inline rounded-sm" width={18} height={18} alt="Signalco logo" src="data:image/png;base64,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" />
                        <span>Signalco</span>
                    </Link>
                </Typography>
            </Row>
        </Stack>
    )
}

