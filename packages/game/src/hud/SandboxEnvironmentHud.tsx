'use client';

import { Button } from '@gredice/ui/Button';
import { Divider } from '@gredice/ui/Divider';
import { Input } from '@gredice/ui/Input';
import {
    Calendar,
    Cloud,
    Custom,
    Droplets,
    Lightning,
    Moon,
    Reset,
    Snowflake,
    Sun,
    SunMoon,
    Wind,
} from '@gredice/ui/icons';
import { Popper } from '@gredice/ui/Popper';
import { Row } from '@gredice/ui/Row';
import { Slider } from '@gredice/ui/Slider';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useCallback, useEffect, useState } from 'react';
import { useLiveTime } from '../hooks/useLiveTime';
import { type GameState, useGameState } from '../useGameState';
import { clampTimeOfDay, createDateForGameTimeOfDay } from '../utils/timeOfDay';
import { HudCard } from './components/HudCard';
import { TimeOfDayVisualization } from './components/TimeOfDayVisualization';

type SandboxWeather = NonNullable<GameState['weather']>;

const sandboxWeatherDefaults = {
    cloudy: 0,
    rainy: 0,
    snowy: 0,
    foggy: 0,
    thundery: 0,
    windSpeed: 0,
    windDirection: 0,
    snowAccumulation: 0,
} satisfies SandboxWeather;

const weatherPresets = [
    {
        label: 'Vedro',
        icon: Sun,
        weather: sandboxWeatherDefaults,
    },
    {
        label: 'Kiša',
        icon: Droplets,
        weather: {
            cloudy: 0.75,
            rainy: 0.8,
            snowy: 0,
            foggy: 0.12,
            thundery: 0,
            windSpeed: 1,
            windDirection: 0,
            snowAccumulation: 0,
        },
    },
    {
        label: 'Snijeg',
        icon: Snowflake,
        weather: {
            cloudy: 0.8,
            rainy: 0,
            snowy: 1,
            foggy: 0.1,
            thundery: 0,
            windSpeed: 1,
            windDirection: 0,
            snowAccumulation: 30,
        },
    },
    {
        label: 'Magla',
        icon: Cloud,
        weather: {
            cloudy: 0.5,
            rainy: 0,
            snowy: 0,
            foggy: 0.85,
            thundery: 0,
            windSpeed: 0,
            windDirection: 0,
            snowAccumulation: 0,
        },
    },
    {
        label: 'Oluja',
        icon: Lightning,
        weather: {
            cloudy: 1,
            rainy: 1,
            snowy: 0,
            foggy: 0.25,
            thundery: 1,
            windSpeed: 3,
            windDirection: 0,
            snowAccumulation: 0,
        },
    },
] as const;

const popperClassName =
    'w-[22rem] max-w-[calc(100vw-1rem)] overflow-hidden border-tertiary border-b-4';

function formatPercent(value: number) {
    return `${Math.round(clampTimeOfDay(value) * 100)}%`;
}

function formatWholeNumber(value: number) {
    return Math.round(value).toString();
}

function formatCentimeters(value: number) {
    return `${Math.round(value)} cm`;
}

function formatDateInputValue(date: Date) {
    const year = date.getFullYear().toString().padStart(4, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseDateInputValue(value: string, referenceDate: Date) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
    if (!match) {
        return null;
    }

    const [, yearValue, monthValue, dayValue] = match;
    const year = Number(yearValue);
    const month = Number(monthValue);
    const day = Number(dayValue);
    if (
        !Number.isFinite(year) ||
        !Number.isFinite(month) ||
        !Number.isFinite(day)
    ) {
        return null;
    }

    const nextDate = new Date(referenceDate);
    nextDate.setFullYear(year, month - 1, day);
    return nextDate;
}

function formatTime(date: Date) {
    return date.toLocaleTimeString('hr-HR', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatShortDate(date: Date) {
    return date.toLocaleDateString('hr-HR', {
        day: '2-digit',
        month: '2-digit',
    });
}

function isPresetActive(
    weather: SandboxWeather,
    presetWeather: SandboxWeather,
) {
    return (
        weather.cloudy === presetWeather.cloudy &&
        weather.rainy === presetWeather.rainy &&
        weather.snowy === presetWeather.snowy &&
        weather.foggy === presetWeather.foggy &&
        weather.thundery === presetWeather.thundery &&
        weather.windSpeed === presetWeather.windSpeed &&
        weather.snowAccumulation === presetWeather.snowAccumulation
    );
}

function weatherLabel(weather: SandboxWeather) {
    if ((weather.thundery ?? 0) > 0.05) {
        return 'Oluja';
    }

    if (weather.snowy > 0.05) {
        return 'Snijeg';
    }

    if (weather.rainy > 0.05) {
        return 'Kiša';
    }

    if (weather.foggy > 0.05) {
        return 'Magla';
    }

    if (weather.cloudy > 0.2) {
        return 'Oblačno';
    }

    return 'Vedro';
}

function weatherIcon(weather: SandboxWeather) {
    if ((weather.thundery ?? 0) > 0.05) {
        return Lightning;
    }

    if (weather.snowy > 0.05 || (weather.snowAccumulation ?? 0) > 0) {
        return Snowflake;
    }

    if (weather.rainy > 0.05) {
        return Droplets;
    }

    if (weather.cloudy > 0.2 || weather.foggy > 0.05) {
        return Cloud;
    }

    return Sun;
}

function WeatherSliderLabel({
    icon: Icon,
    label,
    value,
}: {
    icon: typeof Cloud;
    label: string;
    value: string;
}) {
    return (
        <span className="flex w-full items-center justify-between gap-3">
            <span className="inline-flex min-w-0 items-center gap-2">
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{label}</span>
            </span>
            <span className="shrink-0 text-right tabular-nums text-muted-foreground">
                {value}
            </span>
        </span>
    );
}

export function SandboxEnvironmentHud() {
    const currentTime = useLiveTime();
    const [customWeatherControlsOpen, setCustomWeatherControlsOpen] =
        useState(false);
    const weatherOverride = useGameState((state) => state.weather);
    const setWeather = useGameState((state) => state.setWeather);
    const setWeatherVisualizationDisabled = useGameState(
        (state) => state.setWeatherVisualizationDisabled,
    );
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const setFreezeTime = useGameState((state) => state.setFreezeTime);
    const setDayNightCycleDisabled = useGameState(
        (state) => state.setDayNightCycleDisabled,
    );

    const weather = {
        ...sandboxWeatherDefaults,
        ...(weatherOverride ?? {}),
    };
    const WeatherIcon = weatherIcon(weather);
    const activeWeatherPreset = weatherPresets.find((preset) =>
        isPresetActive(weather, preset.weather),
    );
    const customWeatherSelected =
        customWeatherControlsOpen || !activeWeatherPreset;

    useEffect(() => {
        if (weatherOverride) {
            return;
        }

        setWeatherVisualizationDisabled(false);
        setWeather(sandboxWeatherDefaults);
    }, [setWeather, setWeatherVisualizationDisabled, weatherOverride]);

    const updateWeather = (nextWeather: Partial<SandboxWeather>) => {
        setWeatherVisualizationDisabled(false);
        setWeather({
            ...sandboxWeatherDefaults,
            ...weather,
            ...nextWeather,
        });
    };

    const updateTimeOfDay = useCallback(
        (nextTimeOfDay: number) => {
            setDayNightCycleDisabled(false);
            setFreezeTime(
                createDateForGameTimeOfDay(currentTime, nextTimeOfDay),
            );
        },
        [currentTime, setDayNightCycleDisabled, setFreezeTime],
    );

    const updateDate = (dateValue: string) => {
        const nextDate = parseDateInputValue(dateValue, currentTime);
        if (!nextDate) {
            return;
        }

        setDayNightCycleDisabled(false);
        setFreezeTime(createDateForGameTimeOfDay(nextDate, timeOfDay));
    };

    const resetTime = () => {
        setDayNightCycleDisabled(false);
        setFreezeTime(null);
    };

    return (
        <HudCard
            data-sandbox-environment-hud="true"
            open
            position="floating"
            className="static md:px-1"
        >
            <Row>
                <Popper
                    side="bottom"
                    sideOffset={12}
                    className={popperClassName}
                    trigger={
                        <Button
                            title="Uvjeti u vrtu"
                            variant="plain"
                            className="rounded-full px-2 md:pr-2 pr-3"
                        >
                            <WeatherIcon className="size-5" />
                            <Typography
                                level="body2"
                                className="hidden text-base md:inline"
                            >
                                {weatherLabel(weather)}
                            </Typography>
                        </Button>
                    }
                >
                    <Stack>
                        <Row
                            className="bg-background px-4 py-2"
                            justifyContent="space-between"
                        >
                            <Typography level="body2" bold>
                                Uvjeti
                            </Typography>
                        </Row>
                        <Divider />
                        <Stack spacing={4} className="px-4 py-3">
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {weatherPresets.map((preset) => {
                                    const PresetIcon = preset.icon;
                                    const active =
                                        !customWeatherSelected &&
                                        activeWeatherPreset?.label ===
                                            preset.label;
                                    return (
                                        <Button
                                            key={preset.label}
                                            size="sm"
                                            variant={
                                                active ? 'solid' : 'outlined'
                                            }
                                            color={
                                                preset.label === 'Oluja'
                                                    ? 'warning'
                                                    : 'primary'
                                            }
                                            startDecorator={
                                                <PresetIcon className="size-4" />
                                            }
                                            onClick={() => {
                                                setCustomWeatherControlsOpen(
                                                    false,
                                                );
                                                updateWeather(preset.weather);
                                            }}
                                        >
                                            {preset.label}
                                        </Button>
                                    );
                                })}
                                <Button
                                    size="sm"
                                    variant={
                                        customWeatherSelected
                                            ? 'solid'
                                            : 'outlined'
                                    }
                                    startDecorator={
                                        <Custom className="size-4" />
                                    }
                                    onClick={() =>
                                        setCustomWeatherControlsOpen(true)
                                    }
                                >
                                    Prilagođeno
                                </Button>
                            </div>
                            {customWeatherSelected ? (
                                <Stack spacing={3}>
                                    <Slider
                                        aria-label="Oblaci"
                                        label={
                                            <WeatherSliderLabel
                                                icon={Cloud}
                                                label="Oblaci"
                                                value={formatPercent(
                                                    weather.cloudy,
                                                )}
                                            />
                                        }
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={[weather.cloudy]}
                                        onValueChange={([nextValue]) => {
                                            if (typeof nextValue === 'number') {
                                                updateWeather({
                                                    cloudy: clampTimeOfDay(
                                                        nextValue,
                                                    ),
                                                });
                                            }
                                        }}
                                    />
                                    <Slider
                                        aria-label="Kiša"
                                        label={
                                            <WeatherSliderLabel
                                                icon={Droplets}
                                                label="Kiša"
                                                value={formatPercent(
                                                    weather.rainy,
                                                )}
                                            />
                                        }
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={[weather.rainy]}
                                        onValueChange={([nextValue]) => {
                                            if (typeof nextValue === 'number') {
                                                updateWeather({
                                                    rainy: clampTimeOfDay(
                                                        nextValue,
                                                    ),
                                                });
                                            }
                                        }}
                                    />
                                    <Slider
                                        aria-label="Snijeg"
                                        label={
                                            <WeatherSliderLabel
                                                icon={Snowflake}
                                                label="Snijeg"
                                                value={formatPercent(
                                                    weather.snowy,
                                                )}
                                            />
                                        }
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={[weather.snowy]}
                                        onValueChange={([nextValue]) => {
                                            if (typeof nextValue === 'number') {
                                                updateWeather({
                                                    snowy: clampTimeOfDay(
                                                        nextValue,
                                                    ),
                                                });
                                            }
                                        }}
                                    />
                                    <Slider
                                        aria-label="Magla"
                                        label={
                                            <WeatherSliderLabel
                                                icon={Cloud}
                                                label="Magla"
                                                value={formatPercent(
                                                    weather.foggy,
                                                )}
                                            />
                                        }
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={[weather.foggy]}
                                        onValueChange={([nextValue]) => {
                                            if (typeof nextValue === 'number') {
                                                updateWeather({
                                                    foggy: clampTimeOfDay(
                                                        nextValue,
                                                    ),
                                                });
                                            }
                                        }}
                                    />
                                    <Slider
                                        aria-label="Oluja"
                                        label={
                                            <WeatherSliderLabel
                                                icon={Lightning}
                                                label="Oluja"
                                                value={formatPercent(
                                                    weather.thundery ?? 0,
                                                )}
                                            />
                                        }
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={[weather.thundery ?? 0]}
                                        onValueChange={([nextValue]) => {
                                            if (typeof nextValue === 'number') {
                                                updateWeather({
                                                    thundery:
                                                        clampTimeOfDay(
                                                            nextValue,
                                                        ),
                                                });
                                            }
                                        }}
                                    />
                                    <Slider
                                        aria-label="Vjetar"
                                        label={
                                            <WeatherSliderLabel
                                                icon={Wind}
                                                label="Vjetar"
                                                value={formatWholeNumber(
                                                    weather.windSpeed ?? 0,
                                                )}
                                            />
                                        }
                                        min={0}
                                        max={3}
                                        step={1}
                                        value={[weather.windSpeed ?? 0]}
                                        onValueChange={([nextValue]) => {
                                            if (typeof nextValue === 'number') {
                                                updateWeather({
                                                    windSpeed: Math.min(
                                                        3,
                                                        Math.max(0, nextValue),
                                                    ),
                                                });
                                            }
                                        }}
                                    />
                                    <Slider
                                        aria-label="Snježni pokrov"
                                        label={
                                            <WeatherSliderLabel
                                                icon={Snowflake}
                                                label="Snježni pokrov"
                                                value={formatCentimeters(
                                                    weather.snowAccumulation ??
                                                        0,
                                                )}
                                            />
                                        }
                                        min={0}
                                        max={50}
                                        step={1}
                                        value={[weather.snowAccumulation ?? 0]}
                                        onValueChange={([nextValue]) => {
                                            if (typeof nextValue === 'number') {
                                                updateWeather({
                                                    snowAccumulation: Math.min(
                                                        50,
                                                        Math.max(0, nextValue),
                                                    ),
                                                });
                                            }
                                        }}
                                    />
                                </Stack>
                            ) : null}
                        </Stack>
                    </Stack>
                </Popper>
                <div className="h-4 w-px border-r" />
                <Popper
                    side="bottom"
                    sideOffset={12}
                    className={popperClassName}
                    trigger={
                        <Button
                            title="Doba dana"
                            variant="plain"
                            className="rounded-full px-2 md:pr-2 pr-3"
                        >
                            <SunMoon className="size-5" />
                            <Typography level="body2" className="text-base">
                                {formatTime(currentTime)}
                            </Typography>
                        </Button>
                    }
                >
                    <Stack>
                        <Row
                            className="bg-background px-4 py-2"
                            justifyContent="space-between"
                        >
                            <Typography level="body2" bold>
                                Vrijeme
                            </Typography>
                            <Button
                                aria-label="Vrati na sada"
                                size="xs"
                                variant="plain"
                                color="neutral"
                                onClick={resetTime}
                            >
                                <Reset className="size-4" />
                            </Button>
                        </Row>
                        <Divider />
                        <Stack spacing={4} className="px-4 py-3">
                            <TimeOfDayVisualization
                                data-sandbox-time-visualization="true"
                                interactive
                                onChange={updateTimeOfDay}
                                timeOfDay={timeOfDay}
                            />
                            <Row justifyContent="space-between">
                                <Typography
                                    level="body2"
                                    className={cx(
                                        'inline-flex items-center gap-1',
                                        timeOfDay >= 0.2 && timeOfDay <= 0.8
                                            ? 'text-amber-700 dark:text-amber-300'
                                            : 'text-blue-700 dark:text-blue-300',
                                    )}
                                >
                                    {timeOfDay >= 0.2 && timeOfDay <= 0.8 ? (
                                        <Sun className="size-4" />
                                    ) : (
                                        <Moon className="size-4" />
                                    )}
                                    {formatTime(currentTime)}
                                </Typography>
                                <Popper
                                    align="end"
                                    className="w-56 p-3"
                                    side="bottom"
                                    sideOffset={8}
                                    trigger={
                                        <Button
                                            aria-label={`Promijeni datum ${formatShortDate(currentTime)}`}
                                            className="-mr-2 px-2 text-muted-foreground hover:text-foreground"
                                            color="neutral"
                                            size="sm"
                                            title="Promijeni datum"
                                            type="button"
                                            variant="plain"
                                        >
                                            <Calendar className="size-4" />
                                            {formatShortDate(currentTime)}
                                        </Button>
                                    }
                                >
                                    <Input
                                        fullWidth
                                        label="Datum"
                                        type="date"
                                        value={formatDateInputValue(
                                            currentTime,
                                        )}
                                        onChange={(event) =>
                                            updateDate(
                                                event.currentTarget.value,
                                            )
                                        }
                                    />
                                </Popper>
                            </Row>
                        </Stack>
                    </Stack>
                </Popper>
            </Row>
        </HudCard>
    );
}
