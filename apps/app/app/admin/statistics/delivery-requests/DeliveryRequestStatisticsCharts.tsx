'use client';

import { Card, CardOverflow } from '@gredice/ui/Card';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type { DeliveryRequestStatistics } from './deliveryRequestStatistics';

const chartColors = [
    'hsl(var(--primary))',
    '#22c55e',
    '#3b82f6',
    '#f59e0b',
    '#8b5cf6',
    '#ec4899',
    '#ef4444',
    '#64748b',
];

const tooltipStyle = {
    border: '1px solid hsl(var(--border))',
    borderRadius: '0.5rem',
    backgroundColor: 'hsl(var(--background))',
};

export function DeliveryRequestStatisticsCharts({
    statistics,
}: {
    statistics: DeliveryRequestStatistics;
}) {
    const hasSlotData = statistics.popularSlots.length > 0;
    const hasTimeWindowData = statistics.timeWindows.length > 0;
    const hasTrendData = statistics.trend.length > 0;
    const hasStateData = statistics.states.length > 0;
    const hasModeData = statistics.modes.length > 0;

    return (
        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            <Card className="xl:col-span-2">
                <CardOverflow>
                    <Stack spacing={4} className="p-4">
                        <Stack spacing={1}>
                            <Typography level="h4" component="h2">
                                Najtraženiji pojedinačni termini
                            </Typography>
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Osam termina s najviše zahtjeva, prema
                                trenutačno odabranom terminu svakog zahtjeva
                            </Typography>
                        </Stack>
                        {!hasSlotData ? (
                            <Typography
                                level="body2"
                                className="text-muted-foreground"
                            >
                                Nema zahtjeva povezanih s terminom.
                            </Typography>
                        ) : (
                            <div
                                className="h-80 w-full"
                                role="img"
                                aria-label="Stupčasti graf najtraženijih pojedinačnih termina dostave"
                            >
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={statistics.popularSlots.toReversed()}
                                        layout="vertical"
                                        margin={{
                                            top: 8,
                                            right: 24,
                                            left: 8,
                                            bottom: 0,
                                        }}
                                    >
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            className="stroke-border"
                                            horizontal={false}
                                        />
                                        <XAxis
                                            type="number"
                                            allowDecimals={false}
                                            tickLine={false}
                                            axisLine={false}
                                            tick={{ fontSize: 12 }}
                                        />
                                        <YAxis
                                            type="category"
                                            dataKey="shortLabel"
                                            tickLine={false}
                                            axisLine={false}
                                            tick={{ fontSize: 12 }}
                                            width={184}
                                        />
                                        <Tooltip
                                            cursor={{
                                                fill: 'hsl(var(--primary) / 0.08)',
                                            }}
                                            contentStyle={tooltipStyle}
                                            formatter={(value) => [
                                                `${value} zahtjeva`,
                                                'Zahtjevi',
                                            ]}
                                        />
                                        <Bar
                                            dataKey="count"
                                            fill="hsl(var(--primary) / 0.72)"
                                            radius={[0, 6, 6, 0]}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </Stack>
                </CardOverflow>
            </Card>

            <Card>
                <CardOverflow>
                    <Stack spacing={4} className="p-4">
                        <Stack spacing={1}>
                            <Typography level="h4" component="h2">
                                Zahtjevi po danu u tjednu
                            </Typography>
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Dan početka odabranog termina
                            </Typography>
                        </Stack>
                        <div
                            className="h-72 w-full"
                            role="img"
                            aria-label="Stupčasti graf zahtjeva za dostavu po danima u tjednu"
                        >
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={statistics.weekdays}
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
                                        contentStyle={tooltipStyle}
                                        formatter={(value) => [
                                            `${value} zahtjeva`,
                                            'Zahtjevi',
                                        ]}
                                    />
                                    <Bar
                                        dataKey="count"
                                        fill="#3b82f6"
                                        radius={[6, 6, 0, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Stack>
                </CardOverflow>
            </Card>

            <Card>
                <CardOverflow>
                    <Stack spacing={4} className="p-4">
                        <Stack spacing={1}>
                            <Typography level="h4" component="h2">
                                Najtraženija vremena
                            </Typography>
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Zahtjevi grupirani po vremenskom rasponu termina
                            </Typography>
                        </Stack>
                        {!hasTimeWindowData ? (
                            <Typography
                                level="body2"
                                className="text-muted-foreground"
                            >
                                Nema zahtjeva povezanih s terminom.
                            </Typography>
                        ) : (
                            <div
                                className="h-72 w-full"
                                role="img"
                                aria-label="Stupčasti graf najtraženijih vremenskih raspona dostave"
                            >
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={statistics.timeWindows}
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
                                            contentStyle={tooltipStyle}
                                            formatter={(value) => [
                                                `${value} zahtjeva`,
                                                'Zahtjevi',
                                            ]}
                                        />
                                        <Bar
                                            dataKey="count"
                                            fill="#22c55e"
                                            radius={[6, 6, 0, 0]}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </Stack>
                </CardOverflow>
            </Card>

            <Card className="xl:col-span-2">
                <CardOverflow>
                    <Stack spacing={4} className="p-4">
                        <Stack spacing={1}>
                            <Typography level="h4" component="h2">
                                Zahtjevi kroz vrijeme
                            </Typography>
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Broj novih zahtjeva po mjesecu
                            </Typography>
                        </Stack>
                        {!hasTrendData ? (
                            <Typography
                                level="body2"
                                className="text-muted-foreground"
                            >
                                Nema zahtjeva za prikaz trenda.
                            </Typography>
                        ) : (
                            <div
                                className="h-72 w-full"
                                role="img"
                                aria-label="Površinski graf broja novih zahtjeva za dostavu po mjesecima"
                            >
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart
                                        data={statistics.trend}
                                        margin={{
                                            top: 8,
                                            right: 8,
                                            left: -16,
                                            bottom: 0,
                                        }}
                                    >
                                        <defs>
                                            <linearGradient
                                                id="deliveryRequestTrend"
                                                x1="0"
                                                y1="0"
                                                x2="0"
                                                y2="1"
                                            >
                                                <stop
                                                    offset="5%"
                                                    stopColor="hsl(var(--primary))"
                                                    stopOpacity={0.35}
                                                />
                                                <stop
                                                    offset="95%"
                                                    stopColor="hsl(var(--primary))"
                                                    stopOpacity={0.02}
                                                />
                                            </linearGradient>
                                        </defs>
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
                                            contentStyle={tooltipStyle}
                                            formatter={(value) => [
                                                `${value} zahtjeva`,
                                                'Zahtjevi',
                                            ]}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="count"
                                            stroke="hsl(var(--primary))"
                                            strokeWidth={2}
                                            fill="url(#deliveryRequestTrend)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </Stack>
                </CardOverflow>
            </Card>

            <Card>
                <CardOverflow>
                    <Stack spacing={4} className="p-4">
                        <Stack spacing={1}>
                            <Typography level="h4" component="h2">
                                Statusi zahtjeva
                            </Typography>
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Trenutačno stanje svih zahtjeva
                            </Typography>
                        </Stack>
                        {!hasStateData ? (
                            <Typography
                                level="body2"
                                className="text-muted-foreground"
                            >
                                Nema statusa za prikaz.
                            </Typography>
                        ) : (
                            <div
                                className="h-72 w-full"
                                role="img"
                                aria-label="Kružni graf statusa zahtjeva za dostavu"
                            >
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={statistics.states}
                                            dataKey="count"
                                            nameKey="label"
                                            innerRadius={56}
                                            outerRadius={88}
                                            paddingAngle={2}
                                        >
                                            {statistics.states.map(
                                                (state, index) => (
                                                    <Cell
                                                        key={state.label}
                                                        fill={
                                                            chartColors[
                                                                index %
                                                                    chartColors.length
                                                            ]
                                                        }
                                                    />
                                                ),
                                            )}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={tooltipStyle}
                                            formatter={(value) => [
                                                `${value} zahtjeva`,
                                                'Zahtjevi',
                                            ]}
                                        />
                                        <Legend
                                            iconType="circle"
                                            wrapperStyle={{ fontSize: 12 }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </Stack>
                </CardOverflow>
            </Card>

            <Card>
                <CardOverflow>
                    <Stack spacing={4} className="p-4">
                        <Stack spacing={1}>
                            <Typography level="h4" component="h2">
                                Način preuzimanja
                            </Typography>
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Omjer dostave na adresu i osobnog preuzimanja
                            </Typography>
                        </Stack>
                        {!hasModeData ? (
                            <Typography
                                level="body2"
                                className="text-muted-foreground"
                            >
                                Nema načina preuzimanja za prikaz.
                            </Typography>
                        ) : (
                            <div
                                className="h-72 w-full"
                                role="img"
                                aria-label="Kružni graf načina preuzimanja zahtjeva za dostavu"
                            >
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={statistics.modes}
                                            dataKey="count"
                                            nameKey="label"
                                            innerRadius={56}
                                            outerRadius={88}
                                            paddingAngle={2}
                                        >
                                            {statistics.modes.map(
                                                (mode, index) => (
                                                    <Cell
                                                        key={mode.label}
                                                        fill={
                                                            chartColors[
                                                                (index + 1) %
                                                                    chartColors.length
                                                            ]
                                                        }
                                                    />
                                                ),
                                            )}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={tooltipStyle}
                                            formatter={(value) => [
                                                `${value} zahtjeva`,
                                                'Zahtjevi',
                                            ]}
                                        />
                                        <Legend
                                            iconType="circle"
                                            wrapperStyle={{ fontSize: 12 }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </Stack>
                </CardOverflow>
            </Card>
        </div>
    );
}
