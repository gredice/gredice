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

const pastelBlue = '#a9bfd4';
const pastelGreen = '#b8cdb7';
const pastelColors = [
    pastelBlue,
    pastelGreen,
    '#dac7a3',
    '#c8bdd8',
    '#d8b7bd',
    '#b4cdca',
    '#d2beb1',
    '#bdc2c9',
] as const;

const pastelTrend = '#8ea8c0';

const tooltipStyle = {
    border: '1px solid hsl(var(--border))',
    borderRadius: '0.5rem',
    backgroundColor: 'hsl(var(--background))',
};

function formatTimeWindowTick(label: string) {
    return label.split('–', 1)[0]?.trim() || label;
}

export function DeliveryRequestStatisticsCharts({
    statistics,
}: {
    statistics: DeliveryRequestStatistics;
}) {
    const hasDeliverySizeData = statistics.deliverySizes.length > 0;
    const hasTimeWindowData = statistics.deliveryTimeWindows.length > 0;
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
                                Veličina grupiranih dostava
                            </Typography>
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Broj dostava prema broju zahtjeva istog
                                korisnika u istom terminu
                            </Typography>
                        </Stack>
                        {!hasDeliverySizeData ? (
                            <Typography
                                level="body2"
                                className="text-muted-foreground"
                            >
                                Nema grupiranih dostava za prikaz.
                            </Typography>
                        ) : (
                            <div
                                className="h-72 w-full"
                                role="img"
                                aria-label="Stupčasti graf grupiranih dostava prema broju zahtjeva u dostavi"
                            >
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={statistics.deliverySizes}
                                        margin={{
                                            top: 8,
                                            right: 8,
                                            left: -16,
                                            bottom: 8,
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
                                            label={{
                                                value: 'Zahtjeva u dostavi',
                                                position: 'insideBottom',
                                                offset: -4,
                                                fontSize: 12,
                                            }}
                                            height={44}
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
                                                fill: 'hsl(var(--muted))',
                                            }}
                                            contentStyle={tooltipStyle}
                                            formatter={(value) => [
                                                `${value} dostava`,
                                                'Dostave',
                                            ]}
                                        />
                                        <Bar
                                            dataKey="count"
                                            fill={pastelBlue}
                                            radius={[6, 6, 0, 0]}
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
                                Dostave po danu u tjednu
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
                            aria-label="Stupčasti graf grupiranih dostava po danima u tjednu"
                        >
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={statistics.deliveryWeekdays}
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
                                            fill: 'hsl(var(--muted))',
                                        }}
                                        contentStyle={tooltipStyle}
                                        formatter={(value) => [
                                            `${value} dostava`,
                                            'Dostave',
                                        ]}
                                    />
                                    <Bar
                                        dataKey="count"
                                        fill={pastelBlue}
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
                                Dostave po vremenu termina
                            </Typography>
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Grupirane dostave po vremenskom rasponu termina
                            </Typography>
                        </Stack>
                        {!hasTimeWindowData ? (
                            <Typography
                                level="body2"
                                className="text-muted-foreground"
                            >
                                Nema grupiranih dostava povezanih s terminom.
                            </Typography>
                        ) : (
                            <div
                                className="h-72 w-full"
                                role="img"
                                aria-label="Stupčasti graf grupiranih dostava po vremenskim rasponima termina"
                            >
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={statistics.deliveryTimeWindows}
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
                                            interval={0}
                                            tickLine={false}
                                            axisLine={false}
                                            tick={{ fontSize: 11 }}
                                            tickFormatter={formatTimeWindowTick}
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
                                                fill: 'hsl(var(--muted))',
                                            }}
                                            contentStyle={tooltipStyle}
                                            formatter={(value) => [
                                                `${value} dostava`,
                                                'Dostave',
                                            ]}
                                        />
                                        <Bar
                                            dataKey="count"
                                            fill={pastelGreen}
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
                                                    stopColor={pastelTrend}
                                                    stopOpacity={0.3}
                                                />
                                                <stop
                                                    offset="95%"
                                                    stopColor={pastelTrend}
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
                                            stroke={pastelTrend}
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
                                                            pastelColors[
                                                                index %
                                                                    pastelColors.length
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
                                                            pastelColors[
                                                                (index + 1) %
                                                                    pastelColors.length
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
