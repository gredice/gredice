'use client';

import {
    buildWeatherSeries,
    clampRangeToBounds,
    type WeatherForecastDay,
    type WeatherHistoryPoint,
    type WeatherMetricKey,
    weatherMetrics,
    windDirectionToDegrees,
} from '@gredice/js/weather';
import { Navigation } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
    Area,
    Bar,
    CartesianGrid,
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
import { Input } from '../Input/Input';
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
    payload?: Array<{ value?: number; payload?: Record<string, unknown> }>;
    label?: number;
    unit: string;
    showDirection?: boolean;
}) {
    if (!active || !payload?.length || label == null) return null;
    const point = payload[0]?.payload as
        | { windDirection?: string | null; source?: string }
        | undefined;
    const value = payload[0]?.value;
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
                    {value == null ? '—' : `${Number(value).toFixed(1)} ${unit}`}
                </Typography>
                {showDirection && degrees != null && (
                    <Navigation
                        className="size-3.5 text-muted-foreground"
                        style={{ transform: `rotate(${degrees + 180}deg)` }}
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

    const applyPreset = (fromOffsetDays: number, toOffsetDays: number) => {
        const now = new Date();
        onRangeChange(
            clampRangeToBounds(
                {
                    from: new Date(now.getTime() - fromOffsetDays * DAY_MS),
                    to: new Date(now.getTime() + toOffsetDays * DAY_MS),
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

        return (
            <div style={{ height: chartHeight }} className="w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={data}
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
                                fillOpacity={0.06}
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
                                radius={[3, 3, 0, 0]}
                                isAnimationActive={false}
                            />
                        ) : isWind ? (
                            <Line
                                type="monotone"
                                dataKey={dataKey}
                                stroke={color}
                                strokeWidth={2}
                                dot={false}
                                connectNulls
                                isAnimationActive={false}
                            />
                        ) : (
                            <Area
                                type="monotone"
                                dataKey={dataKey}
                                stroke={color}
                                strokeWidth={2}
                                fill={`url(#weather-${metricKey})`}
                                connectNulls
                                isAnimationActive={false}
                            />
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        );
    };

    const [internalMetric, setInternalMetric] =
        useState<WeatherMetricKey>('temperature');
    const activeMetric = metric ?? internalMetric;
    const handleMetricChange = (value: WeatherMetricKey) => {
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

    return (
        <Stack spacing={compact ? 1 : 2} className={cx('w-full', className)}>
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <Row spacing={1} className="flex-wrap">
                    <Input
                        type="date"
                        value={toDateInputValue(range.from)}
                        min={minInput}
                        max={maxInput}
                        onChange={(event) =>
                            handleFromChange(event.target.value)
                        }
                        label="Od"
                        className="max-w-40"
                    />
                    <Input
                        type="date"
                        value={toDateInputValue(range.to)}
                        min={minInput}
                        max={maxInput}
                        onChange={(event) => handleToChange(event.target.value)}
                        label="Do"
                        className="max-w-40"
                    />
                </Row>
                <Row spacing={1} className="flex-wrap">
                    <Button
                        variant="outlined"
                        size="sm"
                        onClick={() => applyPreset(1, 0)}
                    >
                        24 h
                    </Button>
                    <Button
                        variant="outlined"
                        size="sm"
                        onClick={() => applyPreset(7, 3)}
                    >
                        7 + 3 dana
                    </Button>
                    <Button
                        variant="outlined"
                        size="sm"
                        onClick={() => applyPreset(30, 3)}
                    >
                        30 dana
                    </Button>
                </Row>
            </div>

            <Tabs
                value={activeMetric}
                onValueChange={(value) =>
                    handleMetricChange(value as WeatherMetricKey)
                }
            >
                <TabsList>
                    {weatherMetrics.map((definition) => (
                        <TabsTrigger key={definition.key} value={definition.key}>
                            {definition.label}
                        </TabsTrigger>
                    ))}
                </TabsList>
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
