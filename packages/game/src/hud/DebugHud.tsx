'use client';

import { DebugPanel, DebugPanelSection } from '@gredice/ui/DebugControls';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { Slider } from '@signalco/ui-primitives/Slider';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useEffect, useState } from 'react';
import { useWeatherNow } from '../hooks/useWeatherNow';
import { useGameState } from '../useGameState';

function getTimeOfDayFromDate(date: Date) {
    const totalSeconds =
        date.getHours() * 60 * 60 + date.getMinutes() * 60 + date.getSeconds();
    return totalSeconds / (24 * 60 * 60);
}

// Avoid thrashing the time-of-day slider when the live clock only moves by a
// handful of milliseconds between frames.
const TIME_OF_DAY_SYNC_THRESHOLD = 0.0005;

function clampToRange(value: number, min: number, max: number) {
    if (value < min) {
        return min;
    }

    if (value > max) {
        return max;
    }

    return value;
}

function formatTimeLabel(value: number) {
    const clamped = clampToRange(value, 0, 1);
    const totalSeconds = Math.round(clamped * 24 * 60 * 60);
    const hours = Math.floor(totalSeconds / (60 * 60));
    const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
    return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}`;
}

function formatPercent(value: number) {
    return `${Math.round(clampToRange(value, 0, 1) * 100)}%`;
}

export function DebugHud() {
    const setWeather = useGameState((s) => s.setWeather);
    const currentTime = useGameState((s) => s.currentTime);
    const setFreezeTime = useGameState((s) => s.setFreezeTime);

    const { data: weather } = useWeatherNow();

    const [timeOfDay, setTimeOfDay] = useState(() => getTimeOfDayFromDate(currentTime));
    const [overrideWeather, setOverrideWeather] = useState(false);
    const [cloudy, setCloudy] = useState(weather?.cloudy ?? 0);
    const [rainy, setRainy] = useState(weather?.rainy ?? 0);
    const [snowy, setSnowy] = useState(weather?.snowy ?? 0);
    const [foggy, setFoggy] = useState(weather?.foggy ?? 0);

    useEffect(() => {
        const nextTimeOfDay = getTimeOfDayFromDate(currentTime);
        setTimeOfDay((previous) =>
            Math.abs(previous - nextTimeOfDay) < TIME_OF_DAY_SYNC_THRESHOLD
                ? previous
                : nextTimeOfDay,
        );
    }, [currentTime]);

    useEffect(() => {
        const seconds = clampToRange(timeOfDay, 0, 1) * 24 * 60 * 60;
        const date = new Date();
        date.setHours(seconds / 60 / 60);
        date.setMinutes((seconds / 60) % 60);
        date.setSeconds(seconds % 60);
        setFreezeTime(date);
    }, [timeOfDay, setFreezeTime]);

    useEffect(() => {
        if (overrideWeather) {
            setWeather({ cloudy, rainy, snowy, foggy });
            return;
        }

        if (weather) {
            setWeather({
                cloudy: weather.cloudy ?? 0,
                rainy: weather.rainy ?? 0,
                snowy: weather.snowy ?? 0,
                foggy: weather.foggy ?? 0,
            });
        }
    }, [overrideWeather, cloudy, rainy, snowy, foggy, weather, setWeather]);

    useEffect(() => {
        if (!weather || overrideWeather) {
            return;
        }

        setCloudy(weather.cloudy ?? 0);
        setRainy(weather.rainy ?? 0);
        setSnowy(weather.snowy ?? 0);
        setFoggy(weather.foggy ?? 0);
    }, [weather, overrideWeather]);

    const handleOverrideChange = (checked: boolean | 'indeterminate') => {
        setOverrideWeather(checked === true);
    };

    const weatherControlsDisabled = !overrideWeather;

    return (
        <div className="pointer-events-none fixed top-4 right-4 z-50 flex max-w-full justify-end px-2">
            <DebugPanel
                title="Environment"
                description="Tune lighting and weather parameters for debugging."
                className="pointer-events-auto"
            >
                <Stack spacing={2}>
                    <DebugPanelSection
                        title="Time of day"
                        description="Adjust the sun position across the day."
                    >
                        <Slider
                            label={`Time: ${formatTimeLabel(timeOfDay)}`}
                            min={0}
                            max={1}
                            step={0.01}
                            value={[timeOfDay]}
                            onValueChange={(value) => {
                                const [nextValue] = value;
                                if (typeof nextValue === 'number') {
                                    setTimeOfDay(clampToRange(nextValue, 0, 1));
                                }
                            }}
                        />
                        <Typography level="body3" secondary>
                            Local time freeze is applied immediately.
                        </Typography>
                    </DebugPanelSection>
                    <DebugPanelSection
                        title="Weather"
                        description="Override live weather data when necessary."
                    >
                        <Checkbox
                            label="Override live weather"
                            checked={overrideWeather}
                            onCheckedChange={handleOverrideChange}
                        />
                        <Stack spacing={1} className="pt-1">
                            <Slider
                                label={`Cloudiness: ${formatPercent(cloudy)}`}
                                min={0}
                                max={1}
                                step={0.01}
                                value={[cloudy]}
                                disabled={weatherControlsDisabled}
                                onValueChange={(value) => {
                                    const [nextValue] = value;
                                    if (typeof nextValue === 'number') {
                                        setCloudy(clampToRange(nextValue, 0, 1));
                                    }
                                }}
                            />
                            <Slider
                                label={`Rain: ${formatPercent(rainy)}`}
                                min={0}
                                max={1}
                                step={0.01}
                                value={[rainy]}
                                disabled={weatherControlsDisabled}
                                onValueChange={(value) => {
                                    const [nextValue] = value;
                                    if (typeof nextValue === 'number') {
                                        setRainy(clampToRange(nextValue, 0, 1));
                                    }
                                }}
                            />
                            <Slider
                                label={`Snow: ${formatPercent(snowy)}`}
                                min={0}
                                max={1}
                                step={0.01}
                                value={[snowy]}
                                disabled={weatherControlsDisabled}
                                onValueChange={(value) => {
                                    const [nextValue] = value;
                                    if (typeof nextValue === 'number') {
                                        setSnowy(clampToRange(nextValue, 0, 1));
                                    }
                                }}
                            />
                            <Slider
                                label={`Fog: ${formatPercent(foggy)}`}
                                min={0}
                                max={1}
                                step={0.01}
                                value={[foggy]}
                                disabled={weatherControlsDisabled}
                                onValueChange={(value) => {
                                    const [nextValue] = value;
                                    if (typeof nextValue === 'number') {
                                        setFoggy(clampToRange(nextValue, 0, 1));
                                    }
                                }}
                            />
                        </Stack>
                    </DebugPanelSection>
                </Stack>
            </DebugPanel>
        </div>
    );
}
