'use client';

import type {
    SurveyAnalyticsTrendInterval,
    SurveyAnalyticsTrendPoint,
} from '@gredice/storage';
import { Table } from '@gredice/ui/Table';
import { Typography } from '@gredice/ui/Typography';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { formatSurveyTrendBucket } from './surveyAnalyticsPresentation';

const tooltipStyle = {
    border: '1px solid hsl(var(--border))',
    borderRadius: '0.5rem',
    backgroundColor: 'hsl(var(--background))',
};

const chartMargin = { top: 8, right: 8, left: -16, bottom: 8 };
const axisTick = { fontSize: 12 };

export function SurveyResponseTrendChart({
    interval,
    points,
}: {
    interval: SurveyAnalyticsTrendInterval;
    points: SurveyAnalyticsTrendPoint[];
}) {
    const data = points.map((point) => ({
        ...point,
        label: formatSurveyTrendBucket(point.bucketKey, interval),
    }));

    return (
        <div className="grid min-w-0 gap-4">
            <div
                aria-label="Graf broja predanih odgovora kroz vrijeme"
                className="h-72 w-full"
                role="img"
            >
                <ResponsiveContainer height="100%" width="100%">
                    <AreaChart data={data} margin={chartMargin}>
                        <CartesianGrid
                            className="stroke-border"
                            strokeDasharray="3 3"
                        />
                        <XAxis
                            axisLine={false}
                            dataKey="label"
                            interval="preserveStartEnd"
                            minTickGap={24}
                            tick={axisTick}
                            tickLine={false}
                        />
                        <YAxis
                            allowDecimals={false}
                            axisLine={false}
                            tick={axisTick}
                            tickLine={false}
                            width={32}
                        />
                        <Tooltip
                            contentStyle={tooltipStyle}
                            formatter={(value) => [
                                `${value} odgovora`,
                                'Predano',
                            ]}
                        />
                        <Area
                            dataKey="count"
                            fill="#a9bfd4"
                            fillOpacity={0.35}
                            stroke="#7897b4"
                            strokeWidth={2}
                            type="monotone"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <div>
                <Typography level="body2" semiBold className="mb-2">
                    Točne vrijednosti
                </Typography>
                <Table>
                    <caption className="sr-only">
                        Predani odgovori po vremenskom razdoblju
                    </caption>
                    <Table.Header>
                        <Table.Row>
                            <Table.Head scope="col">Razdoblje</Table.Head>
                            <Table.Head scope="col" className="text-right">
                                Predano
                            </Table.Head>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {data.map((point) => (
                            <Table.Row key={point.bucketKey}>
                                <Table.Cell>{point.label}</Table.Cell>
                                <Table.Cell className="text-right tabular-nums">
                                    {point.count.toLocaleString('hr-HR')}
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            </div>
        </div>
    );
}
