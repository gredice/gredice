'use client';

import { DebugPanel, DebugPanelSection } from '@gredice/ui/DebugControls';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { Slider } from '@signalco/ui-primitives/Slider';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
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

function formatWindSpeed(value: number) {
    const intensity = Math.round(value);
    const labels = ['None', 'Light', 'Moderate', 'Strong'];
    return `${intensity} - ${labels[intensity] || 'Unknown'}`;
}

function formatWindDirection(value: number) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round((value / 45) % 8);
    return directions[index];
}

const PANEL_MARGIN_PX = 16;
const PANEL_STORAGE_KEY = 'gredice.debugPanel.position';

interface PanelPosition {
    x: number;
    y: number;
}

export function DebugHud() {
    const setWeather = useGameState((s) => s.setWeather);
    const currentTime = useGameState((s) => s.currentTime);
    const setFreezeTime = useGameState((s) => s.setFreezeTime);

    const { data: weather } = useWeatherNow();

    const panelWrapperRef = useRef<HTMLDivElement>(null);
    const panelSizeRef = useRef({ width: 0, height: 0 });
    const panelDragStateRef = useRef({
        pointerId: null as number | null,
        offsetX: 0,
        offsetY: 0,
    });
    const panelPositionRef = useRef<PanelPosition | null>(null);
    const hasInitializedPanelPositionRef = useRef(false);

    const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(
        null,
    );
    const [isDraggingPanel, setIsDraggingPanel] = useState(false);

    const clampPanelPosition = useCallback((rawPosition: PanelPosition) => {
        if (typeof window === 'undefined') {
            return rawPosition;
        }

        const { width, height } = panelSizeRef.current;
        const { innerWidth, innerHeight } = window;

        const maxX = Math.max(
            PANEL_MARGIN_PX,
            innerWidth - width - PANEL_MARGIN_PX,
        );
        const maxY = Math.max(
            PANEL_MARGIN_PX,
            innerHeight - height - PANEL_MARGIN_PX,
        );

        return {
            x: clampToRange(rawPosition.x, PANEL_MARGIN_PX, maxX),
            y: clampToRange(rawPosition.y, PANEL_MARGIN_PX, maxY),
        };
    }, []);

    const setClampedPanelPosition = useCallback(
        (nextPosition: PanelPosition) => {
            const clamped = clampPanelPosition(nextPosition);
            panelPositionRef.current = clamped;
            setPanelPosition(clamped);
            return clamped;
        },
        [clampPanelPosition],
    );

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const panelElement = panelWrapperRef.current;
        if (!panelElement) {
            return;
        }

        const readStoredPosition = (): PanelPosition | null => {
            try {
                const storedValue =
                    window.localStorage.getItem(PANEL_STORAGE_KEY);
                if (!storedValue) {
                    return null;
                }

                const parsed = JSON.parse(
                    storedValue,
                ) as Partial<PanelPosition> | null;
                if (
                    parsed &&
                    typeof parsed.x === 'number' &&
                    Number.isFinite(parsed.x) &&
                    typeof parsed.y === 'number' &&
                    Number.isFinite(parsed.y)
                ) {
                    return { x: parsed.x, y: parsed.y };
                }
            } catch {
                // Ignore malformed storage contents.
            }

            return null;
        };

        const refreshPanelSize = () => {
            const rect = panelElement.getBoundingClientRect();
            panelSizeRef.current = { width: rect.width, height: rect.height };
        };

        const initializePosition = () => {
            refreshPanelSize();

            const storedPosition = readStoredPosition();
            const { innerWidth, innerHeight } = window;
            const { width, height } = panelSizeRef.current;

            const maxX = Math.max(
                PANEL_MARGIN_PX,
                innerWidth - width - PANEL_MARGIN_PX,
            );
            const maxY = Math.max(
                PANEL_MARGIN_PX,
                innerHeight - height - PANEL_MARGIN_PX,
            );

            const storedWithinBounds =
                storedPosition !== null &&
                storedPosition.x >= PANEL_MARGIN_PX &&
                storedPosition.x <= maxX &&
                storedPosition.y >= PANEL_MARGIN_PX &&
                storedPosition.y <= maxY;

            const targetPosition = storedWithinBounds
                ? storedPosition
                : {
                      x: innerWidth - width - PANEL_MARGIN_PX,
                      y: innerHeight - height - PANEL_MARGIN_PX,
                  };

            setClampedPanelPosition(targetPosition);
            hasInitializedPanelPositionRef.current = true;
        };

        if (!hasInitializedPanelPositionRef.current) {
            initializePosition();
        } else {
            refreshPanelSize();
            if (panelPositionRef.current) {
                setClampedPanelPosition(panelPositionRef.current);
            }
        }

        let resizeObserver: ResizeObserver | undefined;
        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(() => {
                refreshPanelSize();

                if (!hasInitializedPanelPositionRef.current) {
                    initializePosition();
                    return;
                }

                if (panelPositionRef.current) {
                    setClampedPanelPosition(panelPositionRef.current);
                }
            });

            resizeObserver.observe(panelElement);
        }

        const handleWindowResize = () => {
            refreshPanelSize();

            if (!hasInitializedPanelPositionRef.current) {
                initializePosition();
                return;
            }

            if (panelPositionRef.current) {
                setClampedPanelPosition(panelPositionRef.current);
            }
        };

        window.addEventListener('resize', handleWindowResize);

        return () => {
            resizeObserver?.disconnect();
            window.removeEventListener('resize', handleWindowResize);
        };
    }, [setClampedPanelPosition]);

    const handlePanelPointerMove = useCallback(
        (event: PointerEvent) => {
            const dragState = panelDragStateRef.current;
            if (dragState.pointerId !== event.pointerId) {
                return;
            }

            setClampedPanelPosition({
                x: event.clientX - dragState.offsetX,
                y: event.clientY - dragState.offsetY,
            });
        },
        [setClampedPanelPosition],
    );

    const handlePanelPointerUp = useCallback(
        (event: PointerEvent) => {
            const dragState = panelDragStateRef.current;
            if (dragState.pointerId !== event.pointerId) {
                return;
            }

            dragState.pointerId = null;
            dragState.offsetX = 0;
            dragState.offsetY = 0;
            setIsDraggingPanel(false);

            window.removeEventListener('pointermove', handlePanelPointerMove);
            window.removeEventListener('pointerup', handlePanelPointerUp);
            window.removeEventListener('pointercancel', handlePanelPointerUp);
        },
        [handlePanelPointerMove],
    );

    const handlePanelPointerDown = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (event.button === 2) {
                return;
            }

            const currentPosition = panelPositionRef.current;
            if (!currentPosition) {
                return;
            }

            const panelElement = panelWrapperRef.current;
            if (panelElement) {
                const rect = panelElement.getBoundingClientRect();
                panelSizeRef.current = {
                    width: rect.width,
                    height: rect.height,
                };
            }

            event.preventDefault();
            event.stopPropagation();

            if (typeof window !== 'undefined') {
                window.getSelection()?.removeAllRanges?.();
            }

            const dragState = panelDragStateRef.current;
            dragState.pointerId = event.pointerId;
            dragState.offsetX = event.clientX - currentPosition.x;
            dragState.offsetY = event.clientY - currentPosition.y;

            setIsDraggingPanel(true);

            window.addEventListener('pointermove', handlePanelPointerMove);
            window.addEventListener('pointerup', handlePanelPointerUp);
            window.addEventListener('pointercancel', handlePanelPointerUp);
        },
        [handlePanelPointerMove, handlePanelPointerUp],
    );

    useEffect(() => {
        return () => {
            window.removeEventListener('pointermove', handlePanelPointerMove);
            window.removeEventListener('pointerup', handlePanelPointerUp);
            window.removeEventListener('pointercancel', handlePanelPointerUp);
        };
    }, [handlePanelPointerMove, handlePanelPointerUp]);

    const [timeOfDay, setTimeOfDay] = useState(() =>
        getTimeOfDayFromDate(currentTime),
    );
    const [overrideWeather, setOverrideWeather] = useState(false);
    const [cloudy, setCloudy] = useState(weather?.cloudy ?? 0);
    const [rainy, setRainy] = useState(weather?.rainy ?? 0);
    const [snowy, setSnowy] = useState(weather?.snowy ?? 0);
    const [foggy, setFoggy] = useState(weather?.foggy ?? 0);
    const [windSpeed, setWindSpeed] = useState(
        typeof weather?.windSpeed === 'number' ? weather.windSpeed : 0,
    );
    const [windDirection, setWindDirection] = useState(
        typeof weather?.windDirection === 'number' ? weather.windDirection : 0,
    );
    const [snowAccumulation, setSnowAccumulation] = useState(
        typeof weather?.snowAccumulation === 'number'
            ? weather.snowAccumulation
            : 0,
    );

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
            setWeather({
                cloudy,
                rainy,
                snowy,
                foggy,
                windSpeed,
                windDirection,
                snowAccumulation,
            });
            return;
        }

        if (weather) {
            setWeather({
                cloudy: weather.cloudy ?? 0,
                rainy: weather.rainy ?? 0,
                snowy: weather.snowy ?? 0,
                foggy: weather.foggy ?? 0,
                windSpeed:
                    typeof weather.windSpeed === 'number'
                        ? weather.windSpeed
                        : undefined,
                windDirection:
                    typeof weather.windDirection === 'number'
                        ? weather.windDirection
                        : undefined,
                snowAccumulation:
                    typeof weather.snowAccumulation === 'number'
                        ? weather.snowAccumulation
                        : undefined,
            });
        }
    }, [
        overrideWeather,
        cloudy,
        rainy,
        snowy,
        foggy,
        windSpeed,
        windDirection,
        snowAccumulation,
        weather,
        setWeather,
    ]);

    useEffect(() => {
        if (!weather || overrideWeather) {
            return;
        }

        setCloudy(weather.cloudy ?? 0);
        setRainy(weather.rainy ?? 0);
        setSnowy(weather.snowy ?? 0);
        setFoggy(weather.foggy ?? 0);
        setWindSpeed(
            typeof weather.windSpeed === 'number' ? weather.windSpeed : 0,
        );
        setWindDirection(
            typeof weather.windDirection === 'number'
                ? weather.windDirection
                : 0,
        );
        setSnowAccumulation(
            typeof weather.snowAccumulation === 'number'
                ? weather.snowAccumulation
                : 0,
        );
    }, [weather, overrideWeather]);

    const handleOverrideChange = (checked: boolean | 'indeterminate') => {
        setOverrideWeather(checked === true);
    };

    const weatherControlsDisabled = !overrideWeather;

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        if (!panelPosition || isDraggingPanel) {
            return;
        }

        try {
            window.localStorage.setItem(
                PANEL_STORAGE_KEY,
                JSON.stringify(panelPosition),
            );
        } catch {
            // Ignore storage write failures.
        }
    }, [panelPosition, isDraggingPanel]);

    const panelContainerStyle: CSSProperties = panelPosition
        ? { top: `${panelPosition.y}px`, left: `${panelPosition.x}px` }
        : { bottom: `${PANEL_MARGIN_PX}px`, right: `${PANEL_MARGIN_PX}px` };

    return (
        <div
            className="pointer-events-none fixed z-50"
            style={panelContainerStyle}
        >
            <div ref={panelWrapperRef} className="pointer-events-auto">
                <DebugPanel
                    title="Environment"
                    description="Tune lighting and weather parameters for debugging."
                    dragging={isDraggingPanel}
                    onDragHandlePointerDown={handlePanelPointerDown}
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
                                        setTimeOfDay(
                                            clampToRange(nextValue, 0, 1),
                                        );
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
                                            setCloudy(
                                                clampToRange(nextValue, 0, 1),
                                            );
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
                                            setRainy(
                                                clampToRange(nextValue, 0, 1),
                                            );
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
                                            setSnowy(
                                                clampToRange(nextValue, 0, 1),
                                            );
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
                                            setFoggy(
                                                clampToRange(nextValue, 0, 1),
                                            );
                                        }
                                    }}
                                />
                                <Slider
                                    label={`Wind Speed: ${formatWindSpeed(windSpeed)}`}
                                    min={0}
                                    max={3}
                                    step={1}
                                    value={[windSpeed]}
                                    disabled={weatherControlsDisabled}
                                    onValueChange={(value) => {
                                        const [nextValue] = value;
                                        if (typeof nextValue === 'number') {
                                            setWindSpeed(
                                                clampToRange(nextValue, 0, 3),
                                            );
                                        }
                                    }}
                                />
                                <Slider
                                    label={`Wind Direction: ${formatWindDirection(windDirection)}`}
                                    min={0}
                                    max={315}
                                    step={45}
                                    value={[windDirection]}
                                    disabled={weatherControlsDisabled}
                                    onValueChange={(value) => {
                                        const [nextValue] = value;
                                        if (typeof nextValue === 'number') {
                                            setWindDirection(
                                                clampToRange(nextValue, 0, 315),
                                            );
                                        }
                                    }}
                                />
                                <Slider
                                    label={`Snow Accumulation: ${snowAccumulation} cm`}
                                    min={0}
                                    max={50}
                                    step={1}
                                    value={[snowAccumulation]}
                                    disabled={weatherControlsDisabled}
                                    onValueChange={(value) => {
                                        const [nextValue] = value;
                                        if (typeof nextValue === 'number') {
                                            setSnowAccumulation(
                                                clampToRange(nextValue, 0, 50),
                                            );
                                        }
                                    }}
                                />
                            </Stack>
                        </DebugPanelSection>
                    </Stack>
                </DebugPanel>
            </div>
        </div>
    );
}
