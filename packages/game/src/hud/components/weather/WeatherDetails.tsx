import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ArrowUpLeft, ArrowUpRight, ArrowDownLeft, ArrowDownRight, LucideIcon, Circle, Wind } from 'lucide-react'
import { RainIcon } from './icons/RainIcon'
import { weatherIcons } from './WeatherIcons';
import { Row } from '@signalco/ui-primitives/Row';
import { Typography } from '@signalco/ui-primitives/Typography';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Divider } from '@signalco/ui-primitives/Divider';
import { Link } from '@signalco/ui-primitives/Link';
import { useWeatherForecast } from '../../../hooks/useWeatherForecast';

export const windDirectionIcons: Record<string, LucideIcon> = {
    N: ArrowUp,
    NE: ArrowUpRight,
    E: ArrowRight,
    SE: ArrowDownRight,
    S: ArrowDown,
    SW: ArrowDownLeft,
    W: ArrowLeft,
    NW: ArrowUpLeft
}

export function WeatherDetails() {
    const { data } = useWeatherForecast();
    if (!data) return null;
    // TODO: Add loading indicator
    // TODO: Add error message

    return (
        <Stack>
            <Row className="bg-background px-4 py-2" justifyContent="space-between">
                <Typography level="body3" bold>Prognoza</Typography>
            </Row>
            <Divider />
            <div className="grid grid-cols-3">
                {data.map((day, index) => {
                    const WeatherIcon = weatherIcons[day.symbol]
                    const WindIcon = day.windDirection ? windDirectionIcons[day.windDirection] : Circle;

                    // Write "Danas" for today, name of the day for other days (Ponedjeljak, Utorak, etc.)
                    const dateName = index === 0
                        ? 'danas'
                        : new Date(day.date).toLocaleDateString('hr-HR', { weekday: 'long' });

                    // Chance of rain is a number between 0 and 1,
                    // chance is 100 when there is 10 or more mm of rain
                    const rainChance = day.rain > 10 ? 1 : (10 / day.rain);

                    return (
                        <div key={day.date} className="text-center p-4">
                            <Typography level='body3' semiBold className="capitalize">{dateName}</Typography>
                            <div className="flex justify-center my-1">
                                {WeatherIcon && <WeatherIcon.day className="w-8 h-8" />}
                            </div>
                            <div className="text-sm mb-1 whitespace-nowrap">
                                <span className="font-medium">{day.maxTemp}°</span>
                                <span className="text-muted-foreground text-xs"> / {day.minTemp}°</span>
                            </div>
                            <div className="flex gap-1 flex-col text-xs">
                                {day.rain > 0 && (
                                    <div className="flex items-center space-x-1">
                                        <RainIcon chance={rainChance} />
                                        <span>{day.rain} mm</span>
                                    </div>
                                )}
                                {day.windStrength > 0 && (
                                    <div className="flex items-center space-x-1 relative">
                                        <Wind className="w-4 h-4 opacity-40" />
                                        <Row>
                                            {Array(day.windStrength).fill(0).map((_, i) => (
                                                <WindIcon key={i} className="w-4 h-4 first:ml-0 -ml-1.5" />
                                            ))}
                                        </Row>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
            <Divider />
            <Row className="px-4 py-2" justifyContent="space-between">
                <Link href={"https://meteo.hr/proizvodi.php?section=podaci&param=xml_korisnici"} target='_blank'>
                    <Typography level="body3" className='flex gap-1'>
                        <span>Izvor podataka</span>
                        <img className='inline' width={18} height={18} alt="DHMZ logo" src="data:image/svg+xml;base64,PHN2ZyBpZD0ibWV0ZW8tbG9nbyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB2aWV3Qm94PSIwIDAgMzM3LjcgMjk3LjE2Ij48ZGVmcz48c3R5bGU+LmNscy0xe2ZpbGw6I2Y2YjUzYTt9LmNscy0xLC5jbHMtMntmaWxsLXJ1bGU6ZXZlbm9kZDt9LmNscy0ye2ZpbGw6IzAwNTc4YTt9PC9zdHlsZT48L2RlZnM+PHRpdGxlPmxvZ288L3RpdGxlPjxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTQ1LDM5Ljg3czM1LjIyLTI3LjU1LDYzLjctMzUuOTJhMTAyLjU5LDEwMi41OSwwLDAsMSw1My40LS44M1pNMTgzLjM0LDE1LDE2MC40OSwyLjI3bC0xNTUsODFMNC40LDg3LjU1LDE4Ny44NCwzMy4zNiwyLjc1LDEzMy40NiwwLDE0MmwxODMuMzMtNTYuNEwyLjUxLDE3NS4xOS44MSwxODEuMDhsMTYxLjM1LTQyLjYxTDYuNDMsMjE2Ljc4bDQuOTMsNi41NEwxNjQsMTgyLjA2LDIzLjIzLDI1Ni42OGw5LjkxLDYuODlMMTU2LjgsMjMzLjMyLDY4LjUxLDI3OS4yczM1LjQzLDExLjg4LDY5LjA2LDQuNjdhMTY0LjQyLDE2NC40MiwwLDAsMCw1OC4xOS0yNS42NmwtODYsMTQuNzNMMjY0LDE4Ny4zM2wtMTkxLDUyLjgsMTgwLjItOTYuMjctNjguODIsMTcuODgtODcuODQsMjIsMTM5LjItNjQuMjUsMzIuNTQtMjQuOTJMODMuNTgsMTQ1Ljg0LDIzNy41MSw2NS41N2wtNi43MS0xMS43NUw5My44LDkzLjIzLDIxMCwzMi41OGwtMTYuODktMTMuM0wxMjIsNDMuNTdaIi8+PHBhdGggY2xhc3M9ImNscy0yIiBkPSJNMTE4LjQxLDQ3LjUzczIzLTIxLjI4LDU4LTMxLDY1Ljc3LS42LDY1Ljc3LS42Wk0yNDEuNjIsMTUuNjQsOTMuOCw5My4yM2wxNzguNi00Ny4zMUw4My41OCwxNDUuODQsMjYyLjQsMTAwbC0xNjUuOCw4My44LDg3Ljg0LTIyLDEzOC4zLTc0LjExLTYtMTEuMzdMMTkzLjY2LDEwOS40MywyOTcuODQsNTMuMjNsLTE5LjA1LTE3TDE5NC43NSw1OGw2OC41LTMyWm05My4zMiwxMDYuNTEtODEuNjksMjEuNzFMNzMuMDUsMjQwLjEzLDI0OCwxOTUsMTAxLjkzLDI3Ny4zNCwyMzYuNDQsMjQ5LjhsLTg3Ljg3LDQzLjUxczQzLjc2LDEzLjgxLDkxLTEwLjkyYzI0Ljg5LTEzLDc5LjMzLTU4Ljc1LDc5LjMzLTU4Ljc1bDQuNjQtNy44Mi0xNTMuNCw0MEwzMzcuNywxNjcuNjZsLS40LTUuN0wxOTcuMDcsMTk5LjE1LDMzNS44LDEyNy45M1oiLz48L3N2Zz4=" />
                        <span>DHMZ</span>
                    </Typography>
                </Link>
            </Row>
        </Stack>
    )
}

