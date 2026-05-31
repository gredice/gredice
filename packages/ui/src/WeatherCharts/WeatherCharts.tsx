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
import {
    type ComponentType,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
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
const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_FORECAST_DAYS = 3;
const HISTORY_PRESETS = [3, 7, 30];
const SMALL_CHART_WIDTH = 560;
const SMALL_CHART_AGGREGATION_MS = 8 * HOUR_MS;

type ForecastMode = 'standard' | 'extended';

type DisplayWeatherSeriesPoint = WeatherSeriesPoint & {
    aggregateStart?: number;
    aggregateEnd?: number;
    aggregatePointCount?: number;
};

type MetricChartPoint = DisplayWeatherSeriesPoint & {
    historyValue: number | null;
    forecastValue: number | null;
};

interface WeatherSeriesBucket {
    source: WeatherSeriesPoint['source'];
    bucketStart: number;
    bucketEnd: number;
    timestampTotal: number;
    pointCount: number;
    temperatureTotal: number;
    temperatureCount: number;
    rainTotal: number;
    windSpeedTotal: number;
    windSpeedCount: number;
    windDirection: string | null;
    symbol: number | null;
}

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

function roundMetric(value: number): number {
    return Math.round(value * 10) / 10;
}

function aggregateWeatherSeries(
    points: DisplayWeatherSeriesPoint[],
    bucketMs: number,
): DisplayWeatherSeriesPoint[] {
    const buckets = new Map<string, WeatherSeriesBucket>();

    for (const point of points) {
        const bucketStart = Math.floor(point.timestamp / bucketMs) * bucketMs;
        const bucketKey = `${point.source}:${bucketStart}`;
        const existing = buckets.get(bucketKey);
        const bucket =
            existing ??
            ({
                source: point.source,
                bucketStart,
                bucketEnd: bucketStart + bucketMs,
                timestampTotal: 0,
                pointCount: 0,
                temperatureTotal: 0,
                temperatureCount: 0,
                rainTotal: 0,
                windSpeedTotal: 0,
                windSpeedCount: 0,
                windDirection: null,
                symbol: null,
            } satisfies WeatherSeriesBucket);

        bucket.timestampTotal += point.timestamp;
        bucket.pointCount += 1;
        if (point.temperature != null) {
            bucket.temperatureTotal += point.temperature;
            bucket.temperatureCount += 1;
        }
        bucket.rainTotal += point.rain;
        bucket.windSpeedTotal += point.windSpeed;
        bucket.windSpeedCount += 1;
        bucket.windDirection = point.windDirection ?? bucket.windDirection;
        bucket.symbol = point.symbol ?? bucket.symbol;
        buckets.set(bucketKey, bucket);
    }

    return Array.from(buckets.values())
        .map((bucket) => ({
            timestamp: Math.round(bucket.timestampTotal / bucket.pointCount),
            temperature:
                bucket.temperatureCount > 0
                    ? roundMetric(
                          bucket.temperatureTotal / bucket.temperatureCount,
                      )
                    : null,
            rain: roundMetric(bucket.rainTotal),
            windSpeed:
                bucket.windSpeedCount > 0
                    ? roundMetric(bucket.windSpeedTotal / bucket.windSpeedCount)
                    : 0,
            windDirection: bucket.windDirection,
            symbol: bucket.symbol,
            source: bucket.source,
            aggregateStart: bucket.bucketStart,
            aggregateEnd: bucket.bucketEnd,
            aggregatePointCount: bucket.pointCount,
        }))
        .sort((a, b) => a.timestamp - b.timestamp);
}

function toMetricChartData(
    points: DisplayWeatherSeriesPoint[],
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

function interpolateNullableNumber(
    from: number | null,
    to: number | null,
    ratio: number,
): number | null {
    if (from == null && to == null) return null;
    if (from == null) return to;
    if (to == null) return from;
    return from + (to - from) * ratio;
}

function interpolateNumber(from: number, to: number, ratio: number): number {
    return from + (to - from) * ratio;
}

function createBridgeMetricChartPoint(
    previous: MetricChartPoint,
    next: MetricChartPoint,
    timestamp: number,
): MetricChartPoint | null {
    if (previous.historyValue == null || next.forecastValue == null) {
        return null;
    }

    const duration = next.timestamp - previous.timestamp;
    if (duration <= 0) return null;

    const ratio = Math.min(
        1,
        Math.max(0, (timestamp - previous.timestamp) / duration),
    );
    const bridgedValue =
        previous.historyValue +
        (next.forecastValue - previous.historyValue) * ratio;

    return {
        timestamp,
        temperature: interpolateNullableNumber(
            previous.temperature,
            next.temperature,
            ratio,
        ),
        rain: Math.max(0, interpolateNumber(previous.rain, next.rain, ratio)),
        windSpeed: Math.max(
            0,
            interpolateNumber(previous.windSpeed, next.windSpeed, ratio),
        ),
        windDirection: next.windDirection ?? previous.windDirection,
        symbol: next.symbol ?? previous.symbol,
        source: 'forecast',
        historyValue: bridgedValue,
        forecastValue: bridgedValue,
    };
}

function stitchMetricChartData(
    points: MetricChartPoint[],
    nowTs: number,
): MetricChartPoint[] {
    let lastHistoryIndex = -1;
    let firstForecastIndex = -1;

    for (let index = 0; index < points.length; index += 1) {
        const point = points[index];
        if (!point) continue;
        if (point.source === 'history' && point.historyValue != null) {
            lastHistoryIndex = index;
        }
        if (
            firstForecastIndex === -1 &&
            point.source === 'forecast' &&
            point.forecastValue != null
        ) {
            firstForecastIndex = index;
        }
    }

    if (lastHistoryIndex === -1 || firstForecastIndex === -1) return points;

    const lastHistory = points[lastHistoryIndex];
    const firstForecast = points[firstForecastIndex];
    if (!lastHistory || !firstForecast) return points;
    if (lastHistory.timestamp > firstForecast.timestamp) return points;

    const bridgeTimestamp = Math.min(
        Math.max(nowTs, lastHistory.timestamp),
        firstForecast.timestamp,
    );

    if (bridgeTimestamp <= lastHistory.timestamp) {
        return points.map((point, index) =>
            index === lastHistoryIndex
                ? { ...point, forecastValue: point.historyValue }
                : point,
        );
    }

    if (bridgeTimestamp >= firstForecast.timestamp) {
        return points.map((point, index) =>
            index === firstForecastIndex
                ? { ...point, historyValue: point.forecastValue }
                : point,
        );
    }

    const bridgePoint = createBridgeMetricChartPoint(
        lastHistory,
        firstForecast,
        bridgeTimestamp,
    );
    if (!bridgePoint) return points;

    return [
        ...points.slice(0, firstForecastIndex),
        bridgePoint,
        ...points.slice(firstForecastIndex),
    ];
}

function toEmptyMetricChartData(range: WeatherChartsRange): MetricChartPoint[] {
    return [range.from, range.to].map((date) => ({
        timestamp: date.getTime(),
        temperature: null,
        rain: 0,
        windSpeed: 0,
        windDirection: null,
        symbol: null,
        source: 'history',
        historyValue: null,
        forecastValue: null,
    }));
}

function useElementWidth<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const [width, setWidth] = useState<number | null>(null);

    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) return;

        const updateWidth = () => {
            setWidth(Math.round(element.getBoundingClientRect().width));
        };

        updateWidth();

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', updateWidth);
            return () => window.removeEventListener('resize', updateWidth);
        }

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            setWidth(
                Math.round(
                    entry?.contentRect.width ??
                        element.getBoundingClientRect().width,
                ),
            );
        });

        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    return { ref, width };
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

function getTimeTicks(range: WeatherChartsRange, count = 5): number[] {
    const from = range.from.getTime();
    const to = range.to.getTime();
    if (!Number.isFinite(from) || !Number.isFinite(to)) return [];
    if (to <= from) return [from];

    return Array.from({ length: count }, (_, index) =>
        Math.round(from + ((to - from) * index) / (count - 1)),
    );
}

function getCalendarDayDiff(from: Date, to: Date): number {
    const fromDay = new Date(
        from.getFullYear(),
        from.getMonth(),
        from.getDate(),
    );
    const toDay = new Date(to.getFullYear(), to.getMonth(), to.getDate());
    return Math.round((toDay.getTime() - fromDay.getTime()) / DAY_MS);
}

function getPresetSelectableBounds(
    bounds: { min: Date; max: Date },
    now: Date,
): { min: Date; max: Date } {
    const maxHistoryDays = Math.max(...HISTORY_PRESETS);
    const minPreset = new Date(now.getTime() - maxHistoryDays * DAY_MS);
    const maxPreset = new Date(now.getTime() + DEFAULT_FORECAST_DAYS * DAY_MS);

    return {
        min:
            bounds.min.getTime() < minPreset.getTime() ? bounds.min : minPreset,
        max:
            bounds.max.getTime() > maxPreset.getTime() ? bounds.max : maxPreset,
    };
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
    const now = new Date(nowTs);
    const selectableBounds = getPresetSelectableBounds(bounds, now);
    const { ref: containerRef, width: containerWidth } =
        useElementWidth<HTMLDivElement>();
    const isSmallChart =
        containerWidth != null && containerWidth < SMALL_CHART_WIDTH;

    const rawData = useMemo<DisplayWeatherSeriesPoint[]>(
        () => buildWeatherSeries(history, forecast, range),
        [history, forecast, range],
    );
    const data = useMemo(
        () =>
            isSmallChart
                ? aggregateWeatherSeries(rawData, SMALL_CHART_AGGREGATION_MS)
                : rawData,
        [isSmallChart, rawData],
    );

    const forecastStart = Math.max(nowTs, range.from.getTime());
    const forecastEnd = range.to.getTime();
    const hasForecastRegion = forecastEnd > forecastStart;

    const spansMultipleDays =
        range.to.getTime() - range.from.getTime() > 2 * DAY_MS;
    const xTicks = getTimeTicks(range, isSmallChart ? 4 : 5);
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
        getCalendarDayDiff(now, range.to) > DEFAULT_FORECAST_DAYS
            ? 'extended'
            : 'standard';
    const forecastDaysAvailable = Math.max(
        DEFAULT_FORECAST_DAYS,
        getCalendarDayDiff(now, bounds.max),
    );
    const hasExtendedForecast =
        bounds.max.getTime() - nowTs > (DEFAULT_FORECAST_DAYS + 0.5) * DAY_MS;
    const activeHistoryDays =
        HISTORY_PRESETS.find(
            (days) => getCalendarDayDiff(range.from, now) === days,
        ) ?? null;

    const getForecastEnd = (now: Date, mode: ForecastMode) =>
        mode === 'extended'
            ? bounds.max
            : new Date(now.getTime() + DEFAULT_FORECAST_DAYS * DAY_MS);

    const [dateRangeSelected, setDateRangeSelected] = useState(false);

    const applyHistoryPreset = (historyDays: number) => {
        const now = new Date();
        setDateRangeSelected(false);
        onRangeChange(
            clampRangeToBounds(
                {
                    from: new Date(now.getTime() - historyDays * DAY_MS),
                    to: getForecastEnd(now, forecastMode),
                },
                selectableBounds,
            ),
        );
    };

    const applyForecastMode = (mode: ForecastMode) => {
        const now = new Date();
        const historyDays = activeHistoryDays ?? DEFAULT_FORECAST_DAYS;
        setDateRangeSelected(false);
        onRangeChange(
            clampRangeToBounds(
                {
                    from: new Date(now.getTime() - historyDays * DAY_MS),
                    to: getForecastEnd(now, mode),
                },
                selectableBounds,
            ),
        );
    };

    const chartHeight = compact ? 220 : 320;

    const renderChart = (
        metricKey: WeatherMetricKey,
        overlayMessage?: string,
    ) => {
        const definition = weatherMetrics.find((m) => m.key === metricKey);
        if (!definition) return null;
        const { color, unit, dataKey } = definition;
        const isRain = metricKey === 'rain';
        const isWind = metricKey === 'wind';
        const rawMetricChartData = toMetricChartData(data, metricKey);
        const metricChartData = isRain
            ? rawMetricChartData
            : stitchMetricChartData(rawMetricChartData, nowTs);
        const hasMetricData = metricChartData.length > 0;
        const chartData = hasMetricData
            ? metricChartData
            : toEmptyMetricChartData(range);

        return (
            <div style={{ height: chartHeight }} className="relative w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={chartData}
                        margin={{ top: 8, right: 8, bottom: 0, left: 4 }}
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
                            ticks={xTicks}
                            tick={{ fontSize: isSmallChart ? 10 : 11 }}
                            minTickGap={isSmallChart ? 40 : 24}
                        />
                        <YAxis
                            tick={{ fontSize: 11 }}
                            tickMargin={4}
                            width={48}
                            unit={isWind ? '' : ` ${unit}`}
                            allowDecimals={!isRain}
                        />
                        {hasMetricData && (
                            <Tooltip
                                content={
                                    <WeatherTooltip
                                        unit={unit}
                                        showDirection={isWind}
                                    />
                                }
                            />
                        )}
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
                        {hasMetricData &&
                            (isRain ? (
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
                            ))}
                    </ComposedChart>
                </ResponsiveContainer>
                {overlayMessage && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center">
                        <Typography level="body2" tertiary>
                            {overlayMessage}
                        </Typography>
                    </div>
                )}
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

    const minInput = toDateInputValue(selectableBounds.min);
    const maxInput = toDateInputValue(selectableBounds.max);

    const handleFromChange = (value: string) => {
        const from = fromDateInputValue(value);
        if (!from) return;
        setDateRangeSelected(true);
        onRangeChange(
            clampRangeToBounds({ from, to: range.to }, selectableBounds),
        );
    };
    const handleToChange = (value: string) => {
        const to = fromDateInputValue(value, true);
        if (!to) return;
        setDateRangeSelected(true);
        onRangeChange(
            clampRangeToBounds({ from: range.from, to }, selectableBounds),
        );
    };
    const dateRangeLabel = `${formatShortDate(range.from)} - ${formatShortDate(range.to)}`;
    const chartMessage =
        isLoading && data.length === 0
            ? 'Učitavanje podataka…'
            : data.length === 0
              ? 'Nema podataka za odabrani raspon.'
              : undefined;

    return (
        <Stack
            ref={containerRef}
            spacing={compact ? 1 : 2}
            className={cx('w-full', className)}
        >
            <div className="flex flex-col items-start gap-2 md:flex-row md:items-center md:justify-between">
                <ButtonGroup legend="Mjerenje" size="sm">
                    {weatherMetrics.map((definition) => {
                        const MetricIcon = weatherMetricIcons[definition.key];
                        const isActive = activeMetric === definition.key;
                        return (
                            <Button
                                key={definition.key}
                                type="button"
                                variant={isActive ? 'soft' : 'plain'}
                                aria-label={definition.label}
                                aria-pressed={isActive}
                                title={definition.label}
                                className={buttonGroupItemClassName({
                                    iconOnly: true,
                                })}
                                onClick={() =>
                                    handleMetricChange(definition.key)
                                }
                            >
                                <MetricIcon className="size-4" />
                            </Button>
                        );
                    })}
                </ButtonGroup>
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
                                forecastMode === 'standard' ? 'soft' : 'plain'
                            }
                            aria-pressed={forecastMode === 'standard'}
                            className={buttonGroupItemClassName()}
                            onClick={() => applyForecastMode('standard')}
                        >
                            +3d
                        </Button>
                        <Button
                            type="button"
                            variant={
                                forecastMode === 'extended' ? 'soft' : 'plain'
                            }
                            aria-pressed={forecastMode === 'extended'}
                            className={buttonGroupItemClassName()}
                            disabled={!hasExtendedForecast}
                            title="Proširena prognoza"
                            onClick={() => applyForecastMode('extended')}
                        >
                            +{forecastDaysAvailable}d
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
                                variant={
                                    dateRangeSelected ? 'outlined' : 'plain'
                                }
                                size="sm"
                                aria-label="Odaberi raspon"
                                className={cx(
                                    !dateRangeSelected && 'size-8 px-0',
                                )}
                                startDecorator={<Calendar className="size-4" />}
                                title="Odaberi raspon"
                            >
                                {dateRangeSelected ? dateRangeLabel : null}
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
            <div className="mt-2">
                {renderChart(activeMetric, chartMessage)}
            </div>
        </Stack>
    );
}
