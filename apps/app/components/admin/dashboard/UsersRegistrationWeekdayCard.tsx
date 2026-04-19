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

export type WeekdayRegistrationData = {
    label: string;
    count: number;
};

export function UsersRegistrationWeekdayCard({
    data,
}: {
    data: WeekdayRegistrationData[];
}) {
    const maxCount = Math.max(0, ...data.map((item) => item.count));
    const hasData = data.length > 0;
    const bestDay = data.find(
        (item) => item.count === maxCount && maxCount > 0,
    );

    return (
        <Card>
            <CardOverflow>
                <Stack spacing={2} className="p-4">
                    <Stack spacing={0.5}>
                        <Typography level="body3">
                            Registracije korisnika po danu u tjednu
                        </Typography>
                        <Typography level="h4" semiBold>
                            {bestDay
                                ? `${bestDay.label} (${bestDay.count})`
                                : 'Nema registracija'}
                        </Typography>
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                        >
                            Najčešći dan registracije u odabranom periodu
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
                                        dataKey="label"
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
                                        contentStyle={{
                                            border: '1px solid hsl(var(--border))',
                                            borderRadius: '0.5rem',
                                            backgroundColor:
                                                'hsl(var(--background))',
                                        }}
                                        formatter={(value) => [
                                            `${value} registracija`,
                                            'Korisnici',
                                        ]}
                                    />
                                    <Bar
                                        dataKey="count"
                                        fill="hsl(var(--primary) / 0.6)"
                                        radius={[6, 6, 0, 0]}
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
