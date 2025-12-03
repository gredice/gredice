'use client';

import { useId, useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

type SensorMiniChartPoint = {
    timestamp: string;
    value: number;
};

interface SensorMiniChartProps {
    data: SensorMiniChartPoint[];
    color: string;
    unit?: string;
}

export function SensorMiniChart({
    data,
    color,
    unit = '',
}: SensorMiniChartProps) {
    const gradientId = useId();
    const chartData = useMemo(() => {
        return [...data]
            .map((point) => ({
                time: new Date(point.timestamp).getTime(),
                value: point.value,
            }))
            .filter((point) => Number.isFinite(point.value))
            .sort((a, b) => a.time - b.time);
    }, [data]);

    if (chartData.length === 0) {
        return <div className="h-16 w-full" />;
    }

    return (
        <div className="h-16 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={chartData}
                    margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
                >
                    <defs>
                        <linearGradient
                            id={gradientId}
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
                                stopOpacity={0.05}
                            />
                        </linearGradient>
                    </defs>
                    <XAxis
                        dataKey="time"
                        type="number"
                        hide
                        domain={['dataMin', 'dataMax']}
                    />
                    <Tooltip
                        cursor={{ stroke: color, strokeOpacity: 0.2 }}
                        formatter={(value: number | string) => [
                            `${value}${unit}`,
                            undefined,
                        ]}
                        labelFormatter={(label) =>
                            new Date(label as number).toLocaleString('hr-HR', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                            })
                        }
                    />
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        strokeWidth={2}
                        fill={`url(#${gradientId})`}
                        isAnimationActive={false}
                        dot={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
