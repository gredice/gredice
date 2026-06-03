'use client';

import { Button } from '@gredice/ui/Button';
import { DebugPanel, DebugPanelSection } from '@gredice/ui/DebugControls';
import { IconButton } from '@gredice/ui/IconButton';
import {
    AI,
    Cloud,
    Custom,
    Desktop,
    Droplets,
    Fence,
    FullWidth,
    Ghost,
    Graph,
    Layers,
    Lightning,
    MapPin,
    Moon,
    Reset,
    Settings,
    Snowflake,
    Sun,
    SunMoon,
    Thermometer,
    Wind,
} from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Slider } from '@gredice/ui/Slider';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import type {
    ComponentType,
    CSSProperties,
    ReactNode,
    PointerEvent as ReactPointerEvent,
} from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Vector3 } from 'three';
import { useBlockData } from '../hooks/useBlockData';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useLiveTime } from '../hooks/useLiveTime';
import { useWeatherNow } from '../hooks/useWeatherNow';
import { animateSunflowerPointToHud } from '../indicators/SunflowerTransfer/useSunflowerTransferAnimation';
import {
    type GameProfileMetadata,
    readGameProfileMetadata,
} from '../scene/gameProfileMetadata';
import { useGameState } from '../useGameState';
import { clampTimeOfDay, createDateForGameTimeOfDay } from '../utils/timeOfDay';
import { TimeOfDayVisualization } from './components/TimeOfDayVisualization';
import {
    getSpecialEntityDebugEntries,
    type SpecialEntityDebugEntry,
    SUNFLOWER_SPECIAL_ENTITY_REWARD_AMOUNT,
} from './specialEntityDebug';

type IconType = ComponentType<{ className?: string }>;

function clampToRange(value: number, min: number, max: number) {
    if (value < min) {
        return min;
    }

    if (value > max) {
        return max;
    }

    return value;
}

function formatClockLabel(timeOfDay: number) {
    const totalMinutes = Math.round(clampTimeOfDay(timeOfDay) * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}`;
}

function formatTime(date: Date | null | undefined) {
    return (
        date?.toLocaleTimeString('hr-HR', {
            hour: '2-digit',
            minute: '2-digit',
        }) ?? 'n/a'
    );
}

function formatPercent(value: number) {
    return `${Math.round(clampToRange(value, 0, 1) * 100)}%`;
}

function formatWindSpeed(value: number) {
    const intensity = Math.round(value);
    const labels = ['None', 'Light', 'Moderate', 'Strong'];
    return `${intensity} · ${labels[intensity] || 'Unknown'}`;
}

function formatWindDirection(value: number) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round((value / 45) % 8);
    return directions[index];
}

function formatMetric(value: number | null | undefined, suffix = '') {
    return typeof value === 'number' && Number.isFinite(value)
        ? `${Math.round(value * 10) / 10}${suffix}`
        : 'n/a';
}

function formatTemperature(value: number | null | undefined) {
    return typeof value === 'number' && Number.isFinite(value)
        ? `${Math.round(value)}°C`
        : 'n/a';
}

function formatDebugPosition(position: { x: number; y: number; z: number }) {
    return `${formatMetric(position.x)}, ${formatMetric(position.y)}, ${formatMetric(position.z)}`;
}

function InfoRow({
    icon: Icon,
    label,
    value,
}: {
    icon: IconType;
    label: string;
    value: ReactNode;
}) {
    return (
        <div className="flex items-center justify-between gap-2 text-[11px] leading-tight">
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                <Icon className="size-3 shrink-0" />
                <span className="truncate">{label}</span>
            </span>
            <span className="shrink-0 text-right font-mono tabular-nums">
                {value}
            </span>
        </div>
    );
}

function WeatherSliderLabel({
    icon: Icon,
    label,
    value,
}: {
    icon: IconType;
    label: string;
    value: string;
}) {
    return (
        <span className="flex w-full items-center justify-between gap-2 text-xs">
            <span className="inline-flex min-w-0 items-center gap-1.5">
                <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{label}</span>
            </span>
            <span className="shrink-0 text-right font-mono tabular-nums text-muted-foreground">
                {value}
            </span>
        </span>
    );
}

type FrameStats = {
    fps: number;
    p95FrameMs: number;
};

type ProfileHudSnapshot = GameProfileMetadata & {
    canvasHeight?: number;
    canvasWidth?: number;
    reportedDpr?: number;
};

function useFrameStats() {
    const [stats, setStats] = useState<FrameStats>({
        fps: 0,
        p95FrameMs: 0,
    });

    useEffect(() => {
        const intervals: number[] = [];
        let animationFrame = 0;
        let lastFrame = performance.now();

        const sample = (now: number) => {
            intervals.push(now - lastFrame);
            if (intervals.length > 180) {
                intervals.shift();
            }
            lastFrame = now;
            animationFrame = window.requestAnimationFrame(sample);
        };

        const interval = window.setInterval(() => {
            if (!intervals.length) {
                setStats({ fps: 0, p95FrameMs: 0 });
                return;
            }

            const sortedIntervals = [...intervals].sort((a, b) => a - b);
            const averageFrameMs =
                intervals.reduce((sum, value) => sum + value, 0) /
                intervals.length;
            const p95FrameMs =
                sortedIntervals[
                    Math.min(
                        sortedIntervals.length - 1,
                        Math.floor(sortedIntervals.length * 0.95),
                    )
                ] ?? 0;

            setStats({
                fps: averageFrameMs > 0 ? 1000 / averageFrameMs : 0,
                p95FrameMs,
            });
        }, 1000);

        animationFrame = window.requestAnimationFrame(sample);

        return () => {
            window.cancelAnimationFrame(animationFrame);
            window.clearInterval(interval);
        };
    }, []);

    return stats;
}

function useProfileHudSnapshot() {
    const [snapshot, setSnapshot] = useState<ProfileHudSnapshot | undefined>();

    useEffect(() => {
        const readSnapshot = () => {
            const canvas = document.querySelector('canvas');
            setSnapshot({
                ...readGameProfileMetadata(),
                canvasHeight: canvas?.height,
                canvasWidth: canvas?.width,
                reportedDpr: window.devicePixelRatio,
            });
        };

        readSnapshot();
        const interval = window.setInterval(readSnapshot, 1000);
        return () => window.clearInterval(interval);
    }, []);

    return snapshot;
}

const SNOW_ACCUMULATION_PRESETS = [
    { label: '0', value: 0 },
    { label: '5', value: 5 },
    { label: '15', value: 15 },
    { label: '30', value: 30 },
] as const;

const QUALITY_OPTIONS = ['auto', 'low', 'medium', 'high'] as const;

const PANEL_MARGIN_PX = 16;
const PANEL_STORAGE_KEY = 'gredice.debugPanel.position';

interface PanelPosition {
    x: number;
    y: number;
}

export function DebugHud() {
    const setWeather = useGameState((s) => s.setWeather);
    const currentTime = useLiveTime();
    const setFreezeTime = useGameState((s) => s.setFreezeTime);
    const timeOfDay = useGameState((s) => s.timeOfDay);
    const sunriseTime = useGameState((s) => s.sunriseTime);
    const sunsetTime = useGameState((s) => s.sunsetTime);
    const setDayNightCycleDisabled = useGameState(
        (s) => s.setDayNightCycleDisabled,
    );
    const animalDebugEntries = useGameState((s) => s.animalDebugEntries);
    const triggerAnimalDebugBehavior = useGameState(
        (s) => s.triggerAnimalDebugBehavior,
    );
    const editHitboxDebugVisible = useGameState(
        (s) => s.editHitboxDebugVisible,
    );
    const setEditHitboxDebugVisible = useGameState(
        (s) => s.setEditHitboxDebugVisible,
    );
    const entityRenderModeDebugVisible = useGameState(
        (s) => s.entityRenderModeDebugVisible,
    );
    const setEntityRenderModeDebugVisible = useGameState(
        (s) => s.setEntityRenderModeDebugVisible,
    );
    const gameQualitySetting = useGameState((s) => s.gameQualitySetting);
    const setGameQualitySetting = useGameState((s) => s.setGameQualitySetting);
    const gameCamera = useGameState((s) => s.gameCamera);
    const frameStats = useFrameStats();
    const profileSnapshot = useProfileHudSnapshot();

    const { data: blockData } = useBlockData();
    const { data: garden } = useCurrentGarden();
    const { data: weather } = useWeatherNow();
    const specialEntityDebugEntries = useMemo(
        () =>
            getSpecialEntityDebugEntries({
                blockData,
                stacks: garden?.stacks,
            }),
        [blockData, garden?.stacks],
    );

    const forceSunflowerReward = useCallback(
        (entry: SpecialEntityDebugEntry) => {
            if (!gameCamera) {
                return;
            }

            const target = gameCamera.projectToScreen(
                new Vector3(
                    entry.position.x,
                    entry.position.y,
                    entry.position.z,
                ),
            );

            if (!target) {
                return;
            }

            animateSunflowerPointToHud({
                amount: SUNFLOWER_SPECIAL_ENTITY_REWARD_AMOUNT,
                from: target,
            });
        },
        [gameCamera],
    );

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

    const [overrideWeather, setOverrideWeather] = useState(false);
    const [cloudy, setCloudy] = useState(weather?.cloudy ?? 0);
    const [rainy, setRainy] = useState(weather?.rainy ?? 0);
    const [snowy, setSnowy] = useState(weather?.snowy ?? 0);
    const [foggy, setFoggy] = useState(weather?.foggy ?? 0);
    const [thundery, setThundery] = useState(weather?.thundery ?? 0);
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

    const updateTimeOfDay = useCallback(
        (nextTimeOfDay: number) => {
            setDayNightCycleDisabled(false);
            setFreezeTime(
                createDateForGameTimeOfDay(currentTime, nextTimeOfDay),
            );
        },
        [currentTime, setDayNightCycleDisabled, setFreezeTime],
    );

    const resetTime = useCallback(() => {
        setDayNightCycleDisabled(false);
        setFreezeTime(null);
    }, [setDayNightCycleDisabled, setFreezeTime]);

    useEffect(() => {
        if (overrideWeather) {
            setWeather({
                cloudy,
                rainy,
                snowy,
                foggy,
                thundery,
                windSpeed,
                windDirection,
                snowAccumulation,
            });
        }
    }, [
        overrideWeather,
        cloudy,
        rainy,
        snowy,
        foggy,
        thundery,
        windSpeed,
        windDirection,
        snowAccumulation,
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
        setThundery(
            typeof weather.thundery === 'number' ? weather.thundery : 0,
        );
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

    const resetWeather = useCallback(() => {
        // Drop the override and fall back to the live forecast.
        setOverrideWeather(false);
    }, []);

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

    const isDaytime = timeOfDay >= 0.2 && timeOfDay <= 0.8;
    const qualityTier = profileSnapshot?.qualityTier ?? 'n/a';
    const canvasSize =
        profileSnapshot?.canvasWidth && profileSnapshot.canvasHeight
            ? `${profileSnapshot.canvasWidth}×${profileSnapshot.canvasHeight}`
            : 'n/a';
    const shadowMapMode =
        profileSnapshot?.shadowMapAutoUpdate === false
            ? profileSnapshot.shadowMapDynamicRefreshMs
                ? `cached · ${profileSnapshot.shadowMapDynamicRefreshMs}ms dynamic`
                : 'cached'
            : 'auto';

    return (
        <div
            className="pointer-events-none fixed z-50"
            style={panelContainerStyle}
        >
            <div ref={panelWrapperRef} className="pointer-events-auto">
                <DebugPanel
                    title="Debug"
                    dragging={isDraggingPanel}
                    defaultCollapsed
                    collapsedSummary={
                        <span className="inline-flex items-center gap-1">
                            <Graph className="size-3 shrink-0" />
                            <span className="inline-block w-[5ch] text-right tabular-nums">
                                {formatMetric(frameStats.fps)}
                            </span>
                            <span className="shrink-0">
                                FPS · {qualityTier}
                            </span>
                        </span>
                    }
                    onDragHandlePointerDown={handlePanelPointerDown}
                >
                    <Stack spacing={2}>
                        <DebugPanelSection title="Performance" icon={Graph}>
                            <Stack spacing={1}>
                                <InfoRow
                                    icon={Graph}
                                    label="FPS"
                                    value={`${formatMetric(frameStats.fps)} · p95 ${formatMetric(frameStats.p95FrameMs)} ms`}
                                />
                                <InfoRow
                                    icon={Desktop}
                                    label="Quality"
                                    value={`${qualityTier} · DPR ${formatMetric(profileSnapshot?.dprCap)}/${formatMetric(profileSnapshot?.reportedDpr)}`}
                                />
                                <InfoRow
                                    icon={FullWidth}
                                    label="Canvas"
                                    value={canvasSize}
                                />
                                <InfoRow
                                    icon={Sun}
                                    label="Shadows"
                                    value={
                                        profileSnapshot?.shadowsEnabled
                                            ? `${profileSnapshot.shadowMapSize}px · ${shadowMapMode} · ${profileSnapshot.shadowMapInvalidationCount ?? 0} invalidations`
                                            : 'off'
                                    }
                                />
                                <InfoRow
                                    icon={Cloud}
                                    label="Cloud shadows"
                                    value={`${profileSnapshot?.cloudProjectedShadowCount ?? 0} projected · ${profileSnapshot?.cloudRealShadowCasterCount ?? 0} real`}
                                />
                                <InfoRow
                                    icon={Droplets}
                                    label="Particles"
                                    value={`rain ${profileSnapshot?.rainParticleCount ?? 0} · snow ${profileSnapshot?.snowParticleCount ?? 0}`}
                                />
                                <InfoRow
                                    icon={Layers}
                                    label="Overlays"
                                    value={`snow ${profileSnapshot?.instancedSnowOverlayCount ?? 0} · mulch ${profileSnapshot?.raisedBedMulchOverlayCount ?? 0} · decor ${profileSnapshot?.groundDecorationCount ?? 0}`}
                                />
                                <InfoRow
                                    icon={Settings}
                                    label="Decor density"
                                    value={formatMetric(
                                        profileSnapshot?.groundDecorationDensity,
                                    )}
                                />
                                <InfoRow
                                    icon={Fence}
                                    label="Decor chunks"
                                    value={
                                        profileSnapshot?.groundDecorationVisibleCount !==
                                        undefined
                                            ? `${profileSnapshot.groundDecorationVisibleCount} visible · ${profileSnapshot.groundDecorationAtlasPageCount ?? 0} pages · ${profileSnapshot.groundDecorationChunkCount ?? 0} chunks`
                                            : 'n/a'
                                    }
                                />
                            </Stack>
                            <Row spacing={1}>
                                {QUALITY_OPTIONS.map((option) => (
                                    <Button
                                        key={option}
                                        size="xs"
                                        className="flex-1 px-1 capitalize"
                                        variant={
                                            gameQualitySetting === option
                                                ? 'solid'
                                                : 'outlined'
                                        }
                                        onClick={() =>
                                            setGameQualitySetting(option)
                                        }
                                    >
                                        {option}
                                    </Button>
                                ))}
                            </Row>
                        </DebugPanelSection>
                        <DebugPanelSection title="Animals" icon={Ghost}>
                            {animalDebugEntries.length === 0 ? (
                                <Typography
                                    level="body3"
                                    secondary
                                    className="italic"
                                >
                                    No active animals
                                </Typography>
                            ) : (
                                <Stack spacing={1}>
                                    {animalDebugEntries.map((entry) => (
                                        <div
                                            key={entry.id}
                                            className="rounded-md border border-border/50 bg-card/60 p-1.5 text-[11px] leading-tight"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="inline-flex min-w-0 items-center gap-1 font-medium">
                                                    <Ghost className="size-3 shrink-0 text-muted-foreground" />
                                                    <span className="truncate">
                                                        {entry.species}{' '}
                                                        {entry.label}
                                                    </span>
                                                </span>
                                                <span className="shrink-0 rounded bg-muted px-1 font-mono">
                                                    {entry.phase}
                                                </span>
                                            </div>
                                            <div className="mt-0.5 text-muted-foreground">
                                                {entry.activity} ·{' '}
                                                {entry.behavior} →{' '}
                                                {entry.targetId || 'none'}
                                            </div>
                                            {entry.pathfinding ? (
                                                <div className="mt-1 rounded bg-muted/70 px-1.5 py-1 font-mono text-[10px] text-muted-foreground">
                                                    pathfinding{' '}
                                                    {entry.pathfinding.status} ·{' '}
                                                    {
                                                        entry.pathfinding
                                                            .waypointCount
                                                    }{' '}
                                                    wp ·{' '}
                                                    {entry.pathfinding.distance}
                                                    b ·{' '}
                                                    {
                                                        entry.pathfinding
                                                            .visitedCellCount
                                                    }{' '}
                                                    checked ·{' '}
                                                    {
                                                        entry.pathfinding
                                                            .blockedCellCount
                                                    }{' '}
                                                    blocked
                                                    {entry.pathfinding
                                                        .nextWaypoint
                                                        ? ` · next ${formatDebugPosition(entry.pathfinding.nextWaypoint)}`
                                                        : ''}
                                                </div>
                                            ) : null}
                                            <div className="inline-flex items-center gap-1 font-mono text-muted-foreground">
                                                <MapPin className="size-3 shrink-0" />
                                                {formatDebugPosition(
                                                    entry.position,
                                                )}
                                            </div>
                                            {entry.debugBehaviors?.length ? (
                                                <div className="mt-1.5 flex flex-wrap gap-1">
                                                    {entry.debugBehaviors.map(
                                                        (behavior) => (
                                                            <Button
                                                                key={`${entry.id}-${behavior}`}
                                                                size="xs"
                                                                className="h-6 px-1.5 text-[10px]"
                                                                variant={
                                                                    entry.behavior ===
                                                                    behavior
                                                                        ? 'solid'
                                                                        : 'outlined'
                                                                }
                                                                onClick={() =>
                                                                    triggerAnimalDebugBehavior(
                                                                        {
                                                                            behavior,
                                                                            species:
                                                                                entry.species,
                                                                            targetId:
                                                                                entry.id,
                                                                        },
                                                                    )
                                                                }
                                                            >
                                                                {behavior}
                                                            </Button>
                                                        ),
                                                    )}
                                                </div>
                                            ) : null}
                                        </div>
                                    ))}
                                </Stack>
                            )}
                        </DebugPanelSection>
                        <DebugPanelSection title="Special entities" icon={AI}>
                            {specialEntityDebugEntries.length === 0 ? (
                                <Typography
                                    level="body3"
                                    secondary
                                    className="italic"
                                >
                                    No active special entities
                                </Typography>
                            ) : (
                                <Stack spacing={1}>
                                    {specialEntityDebugEntries.map((entry) => (
                                        <div
                                            key={entry.id}
                                            className="rounded-md border border-border/50 bg-card/60 p-1.5 text-[11px] leading-tight"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="inline-flex min-w-0 items-center gap-1 font-medium">
                                                    <AI className="size-3 shrink-0 text-muted-foreground" />
                                                    <span className="truncate">
                                                        {entry.label}
                                                    </span>
                                                </span>
                                                <span className="shrink-0 rounded bg-muted px-1 font-mono">
                                                    {entry.kind}
                                                </span>
                                            </div>
                                            <div className="mt-0.5 truncate text-muted-foreground">
                                                {entry.blockName} ·{' '}
                                                {entry.blockId}
                                            </div>
                                            <div className="inline-flex items-center gap-1 font-mono text-muted-foreground">
                                                <MapPin className="size-3 shrink-0" />
                                                {formatDebugPosition(
                                                    entry.position,
                                                )}
                                            </div>
                                            <Button
                                                size="xs"
                                                className="mt-1.5 h-6 px-1.5 text-[10px]"
                                                disabled={!gameCamera}
                                                variant="outlined"
                                                onClick={() =>
                                                    forceSunflowerReward(entry)
                                                }
                                            >
                                                Spawn reward
                                            </Button>
                                        </div>
                                    ))}
                                </Stack>
                            )}
                        </DebugPanelSection>
                        <DebugPanelSection title="Scene" icon={Layers}>
                            <Row spacing={1} className="flex-wrap">
                                <Button
                                    size="xs"
                                    className="flex-1"
                                    startDecorator={
                                        <Fence className="size-3.5" />
                                    }
                                    variant={
                                        editHitboxDebugVisible
                                            ? 'solid'
                                            : 'outlined'
                                    }
                                    onClick={() =>
                                        setEditHitboxDebugVisible(
                                            !editHitboxDebugVisible,
                                        )
                                    }
                                >
                                    Edit hitboxes
                                </Button>
                                <Button
                                    size="xs"
                                    className="flex-1"
                                    startDecorator={
                                        <Layers className="size-3.5" />
                                    }
                                    variant={
                                        entityRenderModeDebugVisible
                                            ? 'solid'
                                            : 'outlined'
                                    }
                                    onClick={() =>
                                        setEntityRenderModeDebugVisible(
                                            !entityRenderModeDebugVisible,
                                        )
                                    }
                                >
                                    Render modes
                                </Button>
                            </Row>
                            {entityRenderModeDebugVisible && (
                                <div className="grid gap-0.5 font-mono text-[11px]">
                                    <span className="text-emerald-500">
                                        ● instanced
                                    </span>
                                    <span className="text-amber-500">
                                        ● component
                                    </span>
                                </div>
                            )}
                        </DebugPanelSection>
                        <DebugPanelSection
                            title="Time"
                            icon={SunMoon}
                            action={
                                <IconButton
                                    type="button"
                                    size="sm"
                                    variant="plain"
                                    title="Reset time"
                                    className="size-6 rounded-full"
                                    onClick={resetTime}
                                >
                                    <Reset className="size-3.5" />
                                </IconButton>
                            }
                        >
                            <TimeOfDayVisualization
                                interactive
                                onChange={updateTimeOfDay}
                                timeOfDay={timeOfDay}
                            />
                            <Row
                                justifyContent="space-between"
                                className="text-[11px]"
                            >
                                <Typography
                                    level="body3"
                                    className="inline-flex items-center gap-1 whitespace-nowrap"
                                >
                                    <Sun className="size-3 text-amber-500" />
                                    {formatTime(sunriseTime)}
                                </Typography>
                                <Typography
                                    level="body3"
                                    className={cx(
                                        'inline-flex items-center gap-1 whitespace-nowrap font-mono font-medium',
                                        isDaytime
                                            ? 'text-amber-600 dark:text-amber-300'
                                            : 'text-blue-600 dark:text-blue-300',
                                    )}
                                >
                                    {isDaytime ? (
                                        <Sun className="size-3" />
                                    ) : (
                                        <Moon className="size-3" />
                                    )}
                                    {formatTime(currentTime)} ·{' '}
                                    {formatClockLabel(timeOfDay)}
                                </Typography>
                                <Typography
                                    level="body3"
                                    className="inline-flex items-center gap-1 whitespace-nowrap"
                                >
                                    <Moon className="size-3 text-blue-500" />
                                    {formatTime(sunsetTime)}
                                </Typography>
                            </Row>
                        </DebugPanelSection>
                        <DebugPanelSection
                            title="Weather"
                            icon={Cloud}
                            action={
                                <IconButton
                                    type="button"
                                    size="sm"
                                    variant="plain"
                                    title="Reset weather"
                                    className="size-6 rounded-full"
                                    disabled={weatherControlsDisabled}
                                    onClick={resetWeather}
                                >
                                    <Reset className="size-3.5" />
                                </IconButton>
                            }
                        >
                            {weather ? (
                                <Stack spacing={1}>
                                    <InfoRow
                                        icon={Thermometer}
                                        label="Temperature"
                                        value={formatTemperature(
                                            weather.temperature,
                                        )}
                                    />
                                    <InfoRow
                                        icon={Cloud}
                                        label="Source"
                                        value={`${weather.source ?? 'n/a'}${weather.isStale ? ' (stale)' : ''}`}
                                    />
                                </Stack>
                            ) : null}
                            <Button
                                size="xs"
                                className="self-start"
                                startDecorator={<Custom className="size-3.5" />}
                                variant={overrideWeather ? 'solid' : 'outlined'}
                                onClick={() =>
                                    setOverrideWeather((current) => !current)
                                }
                            >
                                Override forecast
                            </Button>
                            <Stack spacing={2}>
                                <Slider
                                    aria-label="Clouds"
                                    label={
                                        <WeatherSliderLabel
                                            icon={Cloud}
                                            label="Clouds"
                                            value={formatPercent(cloudy)}
                                        />
                                    }
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
                                    aria-label="Rain"
                                    label={
                                        <WeatherSliderLabel
                                            icon={Droplets}
                                            label="Rain"
                                            value={formatPercent(rainy)}
                                        />
                                    }
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
                                    aria-label="Snow"
                                    label={
                                        <WeatherSliderLabel
                                            icon={Snowflake}
                                            label="Snow"
                                            value={formatPercent(snowy)}
                                        />
                                    }
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
                                    aria-label="Fog"
                                    label={
                                        <WeatherSliderLabel
                                            icon={Cloud}
                                            label="Fog"
                                            value={formatPercent(foggy)}
                                        />
                                    }
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
                                    aria-label="Thunder"
                                    label={
                                        <WeatherSliderLabel
                                            icon={Lightning}
                                            label="Thunder"
                                            value={formatPercent(thundery)}
                                        />
                                    }
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    value={[thundery]}
                                    disabled={weatherControlsDisabled}
                                    onValueChange={(value) => {
                                        const [nextValue] = value;
                                        if (typeof nextValue === 'number') {
                                            setThundery(
                                                clampToRange(nextValue, 0, 1),
                                            );
                                        }
                                    }}
                                />
                                <Slider
                                    aria-label="Wind"
                                    label={
                                        <WeatherSliderLabel
                                            icon={Wind}
                                            label="Wind"
                                            value={formatWindSpeed(windSpeed)}
                                        />
                                    }
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
                                    aria-label="Wind direction"
                                    label={
                                        <WeatherSliderLabel
                                            icon={Wind}
                                            label="Direction"
                                            value={formatWindDirection(
                                                windDirection,
                                            )}
                                        />
                                    }
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
                                    aria-label="Snow cover"
                                    label={
                                        <WeatherSliderLabel
                                            icon={Snowflake}
                                            label="Snow cover"
                                            value={`${snowAccumulation} cm`}
                                        />
                                    }
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
                                <Row spacing={1} alignItems="center">
                                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                                        <Snowflake className="size-3.5" />
                                        cm
                                    </span>
                                    {SNOW_ACCUMULATION_PRESETS.map((preset) => (
                                        <Button
                                            key={preset.label}
                                            size="xs"
                                            className="flex-1 px-1"
                                            disabled={weatherControlsDisabled}
                                            onClick={() =>
                                                setSnowAccumulation(
                                                    preset.value,
                                                )
                                            }
                                            variant={
                                                snowAccumulation ===
                                                preset.value
                                                    ? 'solid'
                                                    : 'outlined'
                                            }
                                        >
                                            {preset.label}
                                        </Button>
                                    ))}
                                </Row>
                            </Stack>
                        </DebugPanelSection>
                    </Stack>
                </DebugPanel>
            </div>
        </div>
    );
}
