'use client';

import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

export type SunflowersDailyData = {
    date: string;
    spent: number;
    gifted: number;
};

const dateFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: '2-digit',
    month: '2-digit',
});

function formatDate(date: string) {
    return dateFormatter.format(new Date(date));
}

export function SunflowersDailyCard({ data }: { data: SunflowersDailyData[] }) {
    const totalSpent = data.reduce((sum, day) => sum + day.spent, 0);
    const totalGifted = data.reduce((sum, day) => sum + day.gifted, 0);
    const hasData = data.some((day) => day.spent > 0 || day.gifted > 0);

    return (
        <Card>
            <CardOverflow>
                <Stack spacing={2} className="p-4">
                    <Stack spacing={0.5}>
                        <Typography level="body3">
                            Suncokreti po danu
                        </Typography>
                        <Typography level="h4" semiBold>
                            Potrošeno {totalSpent} · Poklonjeno {totalGifted}
                        </Typography>
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                        >
                            Prikaz potrošnje i poklona kroz odabrani period
                        </Typography>
                    </Stack>
                    {!hasData ? (
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            Nema podataka za odabrani period.
                        </Typography>
                    ) : (
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={data}
                                    margin={{
                                        top: 8,
                                        right: 8,
                                        left: -16,
                                        bottom: 0,
                                    }}
                                >
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        className="stroke-border"
                                    />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={formatDate}
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fontSize: 12 }}
                                    />
                                    <YAxis
                                        allowDecimals={false}
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fontSize: 12 }}
                                        width={28}
                                    />
                                    <Tooltip
                                        cursor={{
                                            fill: 'hsl(var(--primary) / 0.08)',
                                        }}
                                        labelFormatter={(value) =>
                                            formatDate(String(value))
                                        }
                                        contentStyle={{
                                            border: '1px solid hsl(var(--border))',
                                            borderRadius: '0.5rem',
                                            backgroundColor:
                                                'hsl(var(--background))',
                                        }}
                                    />
                                    <Bar
                                        dataKey="spent"
                                        name="Potrošeno"
                                        fill="hsl(var(--destructive) / 0.7)"
                                        radius={[4, 4, 0, 0]}
                                    />
                                    <Bar
                                        dataKey="gifted"
                                        name="Poklonjeno"
                                        fill="hsl(var(--primary) / 0.7)"
                                        radius={[4, 4, 0, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </Stack>
            </CardOverflow>
        </Card>
    );
}
