'use client';

import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

export type ActiveUsersSeriesPoint = {
    date: string;
    count: number;
};

export interface ActiveUsersCardProps {
    title: string;
    subtitle: string;
    value: number;
    series: ActiveUsersSeriesPoint[];
    color?: string;
}

const DEFAULT_COLOR = '#2563eb';

export function ActiveUsersCard({
    title,
    subtitle,
    value,
    series,
    color = DEFAULT_COLOR,
}: ActiveUsersCardProps) {
    const chartData = useMemo(
        () =>
            series.map((point) => ({
                date: new Date(point.date),
                value: point.count,
                timestamp: new Date(point.date).getTime(),
            })),
        [series],
    );

    const formattedValue = useMemo(
        () => new Intl.NumberFormat('hr-HR').format(value),
        [value],
    );

    return (
        <Card>
            <CardOverflow>
                <Stack className="p-3" spacing={1}>
                    <Stack spacing={0.25}>
                        <Typography level="body2" className="text-muted-foreground">
                            {subtitle}
                        </Typography>
                        <Typography level="h4" semiBold>
                            {formattedValue}
                        </Typography>
                        <Typography level="body3" className="uppercase tracking-wide">
                            {title}
                        </Typography>
                    </Stack>
                    <div className="h-24 w-full">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart
                                    data={chartData}
                                    margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
                                >
                                    <defs>
                                        <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                                            <stop offset="100%" stopColor={color} stopOpacity={0.05} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis
                                        dataKey="timestamp"
                                        type="number"
                                        hide
                                        domain={['dataMin', 'dataMax']}
                                    />
                                    <Tooltip
                                        cursor={{ stroke: color, strokeOpacity: 0.2 }}
                                        formatter={(tooltipValue: number | string) => [
                                            `${tooltipValue}`,
                                            undefined,
                                        ]}
                                        labelFormatter={(label) =>
                                            new Date(Number(label)).toLocaleDateString(
                                                'hr-HR',
                                                {
                                                    day: '2-digit',
                                                    month: 'short',
                                                },
                                            )
                                        }
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="value"
                                        stroke={color}
                                        strokeWidth={2}
                                        fill={`url(#gradient-${title})`}
                                        isAnimationActive={false}
                                        dot={false}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full w-full" />
                        )}
                    </div>
                </Stack>
            </CardOverflow>
        </Card>
    );
}
