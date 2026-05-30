'use client';

import {
    buildWeatherSeries,
    clampRangeToBounds,
    type WeatherForecastDay,
    type WeatherHistoryPoint,
    type WeatherMetricKey,
    type WeatherSeriesPoint,
    weatherMetrics,
    windDirectionToDegrees,
} from '@gredice/js/weather';
import { type ComponentType, useMemo, useState } from 'react';
import {
    Area,
    Bar,
    CartesianGrid,
    Cell,
    ComposedChart,
    Line,
    ReferenceArea,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { Button } from '../Button/Button';
import {
    ButtonGroup,
    buttonGroupItemClassName,
} from '../ButtonGroup/ButtonGroup';
import { Input } from '../Input/Input';
import { ArrowUp, Calendar, Droplets, ThermometerSun, Wind } from '../icons';
import { Popper } from '../Popper/Popper';
import { Row } from '../Row/Row';
import { Stack } from '../Stack/Stack';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../Tabs/Tabs';
import { Typography } from '../Typography/Typography';
import { cx } from '../utils';

export interface WeatherChartsRange {
    from: Date;
    to: Date;
}

export interface WeatherChartsProps {
    history?: WeatherHistoryPoint[] | null;
    forecast?: WeatherForecastDay[] | null;
    range: WeatherChartsRange;
    bounds: { min: Date; max: Date };
    onRangeChange: (range: WeatherChartsRange) => void;
    isLoading?: boolean;
    /** Tighter spacing/height for the in-game HUD modal. */
    compact?: boolean;
    className?: string;
    /** Currently selected metric tab. */
    metric?: WeatherMetricKey;
    onMetricChange?: (metric: WeatherMetricKey) => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_FORECAST_DAYS = 3;
const HISTORY_PRESETS = [3, 7, 30];

type ForecastMode = 'standard' | 'extended';

type MetricChartPoint = WeatherSeriesPoint & {
    historyValue: number | null;
    forecastValue: number | null;
};

const weatherMetricIcons: Record<
    WeatherMetricKey,
    ComponentType<{ className?: string }>
> = {
    temperature: ThermometerSun,
    rain: Droplets,
    wind: Wind,
};

function isWeatherMetricKey(value: string): value is WeatherMetricKey {
    return weatherMetrics.some((metric) => metric.key === value);
}

function toMetricChartData(
    points: WeatherSeriesPoint[],
    metricKey: WeatherMetricKey,
): MetricChartPoint[] {
    const definition = weatherMetrics.find(
        (metric) => metric.key === metricKey,
    );
    if (!definition) return [];

    return points.map((point) => {
        const value = point[definition.dataKey];
        return {
            ...point,
            historyValue: point.source === 'history' ? value : null,
            forecastValue: point.source === 'forecast' ? value : null,
        };
    });
}

function formatShortDate(date: Date): string {
    return date.toLocaleDateString('hr-HR', {
        day: '2-digit',
        month: '2-digit',
    });
}

function toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function fromDateInputValue(value: string, endOfDay = false): Date | null {
    if (!value) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;
    return endOfDay
        ? new Date(year, month - 1, day, 23, 59, 59, 999)
        : new Date(year, month - 1, day, 0, 0, 0, 0);
}

function WeatherTooltip({
    active,
    payload,
    label,
    unit,
    showDirection,
}: {
    active?: boolean;
    payload?: Array<{
        value?: number | string | null;
        payload?: Record<string, unknown>;
    }>;
    label?: number;
    unit: string;
    showDirection?: boolean;
}) {
    if (!active || !payload?.length || label == null) return null;
    const activePayload = payload.find((item) => item.value != null);
    if (!activePayload) return null;

    const point = activePayload.payload as
        | { windDirection?: string | null; source?: string }
        | undefined;
    const value = Number(activePayload.value);
    const date = new Date(label);
    const formatted = date.toLocaleString('hr-HR', {
        weekday: 'short',
        day: 'numeric',
        month: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
    const direction = point?.windDirection;
    const degrees = windDirectionToDegrees(direction);

    return (
        <div className="rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md">
            <Typography level="body3" tertiary>
                {formatted}
                {point?.source === 'forecast' ? ' · prognoza' : ''}
            </Typography>
            <Row spacing={1} className="pt-0.5">
                <Typography level="body2" semiBold>
                    {Number.isFinite(value)
                        ? `${value.toFixed(1)} ${unit}`
                        : '—'}
                </Typography>
                {showDirection && degrees != null && (
                    <ArrowUp
                        className="size-3.5 text-muted-foreground"
                        style={{ transform: `rotate(${degrees}deg)` }}
                    />
                )}
                {showDirection && direction && (
                    <Typography level="body3" tertiary>
                        {direction}
                    </Typography>
                )}
            </Row>
        </div>
    );
}

export function WeatherCharts({
    history,
    forecast,
    range,
    bounds,
    onRangeChange,
    isLoading,
    compact,
    className,
    metric,
    onMetricChange,
}: WeatherChartsProps) {
    const nowTs = Date.now();

    const data = useMemo(
        () => buildWeatherSeries(history, forecast, range),
        [history, forecast, range],
    );

    const forecastStart = Math.max(nowTs, range.from.getTime());
    const forecastEnd = range.to.getTime();
    const hasForecastRegion = forecastEnd > forecastStart;

    const spansMultipleDays =
        range.to.getTime() - range.from.getTime() > 2 * DAY_MS;
    const tickFormatter = (value: number) => {
        const date = new Date(value);
        return spansMultipleDays
            ? date.toLocaleDateString('hr-HR', {
                  day: 'numeric',
                  month: 'numeric',
              })
            : date.toLocaleTimeString('hr-HR', {
                  hour: '2-digit',
                  minute: '2-digit',
              });
    };

    const forecastMode: ForecastMode =
        range.to.getTime() - nowTs > (DEFAULT_FORECAST_DAYS + 0.5) * DAY_MS
            ? 'extended'
            : 'standard';
    const hasExtendedForecast =
        bounds.max.getTime() - nowTs > (DEFAULT_FORECAST_DAYS + 0.5) * DAY_MS;
    const activeHistoryDays =
        HISTORY_PRESETS.find(
            (days) =>
                Math.abs(nowTs - range.from.getTime() - days * DAY_MS) <
                DAY_MS / 2,
        ) ?? null;

    const getForecastEnd = (now: Date, mode: ForecastMode) =>
        mode === 'extended'
            ? bounds.max
            : new Date(now.getTime() + DEFAULT_FORECAST_DAYS * DAY_MS);

    const applyHistoryPreset = (historyDays: number) => {
        const now = new Date();
        onRangeChange(
            clampRangeToBounds(
                {
                    from: new Date(now.getTime() - historyDays * DAY_MS),
                    to: getForecastEnd(now, forecastMode),
                },
                bounds,
            ),
        );
    };

    const applyForecastMode = (mode: ForecastMode) => {
        const now = new Date();
        const historyDays = activeHistoryDays ?? DEFAULT_FORECAST_DAYS;
        onRangeChange(
            clampRangeToBounds(
                {
                    from: new Date(now.getTime() - historyDays * DAY_MS),
                    to: getForecastEnd(now, mode),
                },
                bounds,
            ),
        );
    };

    const chartHeight = compact ? 220 : 320;

    const renderChart = (metricKey: WeatherMetricKey) => {
        const definition = weatherMetrics.find((m) => m.key === metricKey);
        if (!definition) return null;
        const { color, unit, dataKey } = definition;
        const isRain = metricKey === 'rain';
        const isWind = metricKey === 'wind';
        const chartData = toMetricChartData(data, metricKey);

        return (
            <div style={{ height: chartHeight }} className="w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={chartData}
                        margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
                    >
                        <defs>
                            <linearGradient
                                id={`weather-${metricKey}`}
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                            >
                                <stop
                                    offset="0%"
                                    stopColor={color}
                                    stopOpacity={0.35}
                                />
                                <stop
                                    offset="100%"
                                    stopColor={color}
                                    stopOpacity={0.04}
                                />
                            </linearGradient>
                            <linearGradient
                                id={`weather-${metricKey}-forecast`}
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                            >
                                <stop
                                    offset="0%"
                                    stopColor={color}
                                    stopOpacity={0.12}
                                />
                                <stop
                                    offset="100%"
                                    stopColor={color}
                                    stopOpacity={0.01}
                                />
                            </linearGradient>
                        </defs>
                        <CartesianGrid
                            strokeDasharray="3 3"
                            className="stroke-border"
                        />
                        <XAxis
                            dataKey="timestamp"
                            type="number"
                            scale="time"
                            domain={[range.from.getTime(), range.to.getTime()]}
                            tickFormatter={tickFormatter}
                            tick={{ fontSize: 11 }}
                            minTickGap={24}
                        />
                        <YAxis
                            tick={{ fontSize: 11 }}
                            width={40}
                            unit={isWind ? '' : ` ${unit}`}
                            allowDecimals={!isRain}
                        />
                        <Tooltip
                            content={
                                <WeatherTooltip
                                    unit={unit}
                                    showDirection={isWind}
                                />
                            }
                        />
                        {hasForecastRegion && (
                            <ReferenceArea
                                x1={forecastStart}
                                x2={forecastEnd}
                                fill={color}
                                fillOpacity={0.025}
                                ifOverflow="visible"
                            />
                        )}
                        {nowTs >= range.from.getTime() &&
                            nowTs <= range.to.getTime() && (
                                <ReferenceLine
                                    x={nowTs}
                                    stroke="currentColor"
                                    strokeOpacity={0.4}
                                    strokeDasharray="4 4"
                                    label={{
                                        value: 'Sad',
                                        position: 'insideTopRight',
                                        fontSize: 10,
                                    }}
                                />
                            )}
                        {isRain ? (
                            <Bar
                                dataKey={dataKey}
                                fill={color}
                                fillOpacity={0.85}
                                radius={[3, 3, 0, 0]}
                                isAnimationActive={false}
                            >
                                {chartData.map((point) => (
                                    <Cell
                                        key={point.timestamp}
                                        fillOpacity={
                                            point.source === 'forecast'
                                                ? 0.32
                                                : 0.85
                                        }
                                    />
                                ))}
                            </Bar>
                        ) : isWind ? (
                            <>
                                <Line
                                    type="monotone"
                                    dataKey="historyValue"
                                    stroke={color}
                                    strokeWidth={2}
                                    dot={false}
                                    isAnimationActive={false}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="forecastValue"
                                    stroke={color}
                                    strokeDasharray="5 5"
                                    strokeOpacity={0.55}
                                    strokeWidth={2}
                                    dot={false}
                                    isAnimationActive={false}
                                />
                            </>
                        ) : (
                            <>
                                <Area
                                    type="monotone"
                                    dataKey="historyValue"
                                    stroke={color}
                                    strokeWidth={2}
                                    fill={`url(#weather-${metricKey})`}
                                    isAnimationActive={false}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="forecastValue"
                                    stroke={color}
                                    strokeDasharray="5 5"
                                    strokeOpacity={0.55}
                                    strokeWidth={2}
                                    fill={`url(#weather-${metricKey}-forecast)`}
                                    isAnimationActive={false}
                                />
                            </>
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        );
    };

    const [internalMetric, setInternalMetric] =
        useState<WeatherMetricKey>('temperature');
    const activeMetric = metric ?? internalMetric;
    const handleMetricChange = (value: string) => {
        if (!isWeatherMetricKey(value)) return;
        setInternalMetric(value);
        onMetricChange?.(value);
    };

    const minInput = toDateInputValue(bounds.min);
    const maxInput = toDateInputValue(bounds.max);

    const handleFromChange = (value: string) => {
        const from = fromDateInputValue(value);
        if (!from) return;
        onRangeChange(clampRangeToBounds({ from, to: range.to }, bounds));
    };
    const handleToChange = (value: string) => {
        const to = fromDateInputValue(value, true);
        if (!to) return;
        onRangeChange(clampRangeToBounds({ from: range.from, to }, bounds));
    };
    const dateRangeLabel = `${formatShortDate(range.from)} - ${formatShortDate(range.to)}`;

    return (
        <Stack spacing={compact ? 1 : 2} className={cx('w-full', className)}>
            <Tabs value={activeMetric} onValueChange={handleMetricChange}>
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <TabsList className="min-h-9">
                        {weatherMetrics.map((definition) => {
                            const MetricIcon =
                                weatherMetricIcons[definition.key];
                            return (
                                <TabsTrigger
                                    key={definition.key}
                                    value={definition.key}
                                    aria-label={definition.label}
                                    title={definition.label}
                                    className="min-h-7 px-2.5"
                                >
                                    <MetricIcon className="size-4" />
                                </TabsTrigger>
                            );
                        })}
                    </TabsList>
                    <div className="flex flex-wrap items-center gap-1 md:justify-end">
                        <ButtonGroup legend="Povijest" size="sm">
                            {HISTORY_PRESETS.map((days) => {
                                const isActive = activeHistoryDays === days;
                                return (
                                    <Button
                                        key={days}
                                        type="button"
                                        variant={isActive ? 'soft' : 'plain'}
                                        aria-pressed={isActive}
                                        className={buttonGroupItemClassName()}
                                        onClick={() => applyHistoryPreset(days)}
                                    >
                                        {days}d
                                    </Button>
                                );
                            })}
                        </ButtonGroup>
                        <ButtonGroup legend="Prognoza" size="sm">
                            <Button
                                type="button"
                                variant={
                                    forecastMode === 'standard'
                                        ? 'soft'
                                        : 'plain'
                                }
                                aria-pressed={forecastMode === 'standard'}
                                className={buttonGroupItemClassName()}
                                onClick={() => applyForecastMode('standard')}
                            >
                                3d
                            </Button>
                            <Button
                                type="button"
                                variant={
                                    forecastMode === 'extended'
                                        ? 'soft'
                                        : 'plain'
                                }
                                aria-pressed={forecastMode === 'extended'}
                                className={buttonGroupItemClassName()}
                                disabled={!hasExtendedForecast}
                                title="Proširena prognoza"
                                onClick={() => applyForecastMode('extended')}
                            >
                                Sve
                            </Button>
                        </ButtonGroup>
                        <Popper
                            side="bottom"
                            align="end"
                            sideOffset={8}
                            className="w-auto p-3"
                            trigger={
                                <Button
                                    type="button"
                                    variant="outlined"
                                    size="sm"
                                    startDecorator={
                                        <Calendar className="size-4" />
                                    }
                                    title="Odaberi raspon"
                                >
                                    {dateRangeLabel}
                                </Button>
                            }
                        >
                            <Row spacing={1} className="items-end">
                                <Input
                                    type="date"
                                    value={toDateInputValue(range.from)}
                                    min={minInput}
                                    max={maxInput}
                                    onChange={(event) =>
                                        handleFromChange(event.target.value)
                                    }
                                    label="Od"
                                    className="w-36"
                                />
                                <Input
                                    type="date"
                                    value={toDateInputValue(range.to)}
                                    min={minInput}
                                    max={maxInput}
                                    onChange={(event) =>
                                        handleToChange(event.target.value)
                                    }
                                    label="Do"
                                    className="w-36"
                                />
                            </Row>
                        </Popper>
                    </div>
                </div>
                {weatherMetrics.map((definition) => (
                    <TabsContent key={definition.key} value={definition.key}>
                        {isLoading && data.length === 0 ? (
                            <div
                                className="flex w-full items-center justify-center"
                                style={{ height: chartHeight }}
                            >
                                <Typography level="body2" tertiary>
                                    Učitavanje podataka…
                                </Typography>
                            </div>
                        ) : data.length === 0 ? (
                            <div
                                className="flex w-full items-center justify-center"
                                style={{ height: chartHeight }}
                            >
                                <Typography level="body2" tertiary>
                                    Nema podataka za odabrani raspon.
                                </Typography>
                            </div>
                        ) : (
                            renderChart(definition.key)
                        )}
                    </TabsContent>
                ))}
            </Tabs>
        </Stack>
    );
}
