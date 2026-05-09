'use client';

import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
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

export type OperationsDurationPoint = {
    date: string;
    operationsMinutes: number;
    sowingMinutes: number;
    totalMinutes: number;
    byUser: {
        userId: string;
        userName: string;
        operationsMinutes: number;
    }[];
};

export type OperationsDurationData = {
    totalMinutes: number;
    operationsMinutes: number;
    sowingMinutes: number;
    byUser: {
        userId: string;
        userName: string;
        operationsMinutes: number;
        operationsCount: number;
    }[];
    daily: OperationsDurationPoint[];
};

const dateFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: '2-digit',
    month: '2-digit',
});

const USER_BAR_COLORS = [
    'hsl(var(--primary) / 0.8)',
    'hsl(221 83% 53% / 0.8)',
    'hsl(262 83% 58% / 0.8)',
    'hsl(16 84% 55% / 0.8)',
    'hsl(142 71% 45% / 0.8)',
    'hsl(338 80% 56% / 0.8)',
    'hsl(199 89% 48% / 0.8)',
    'hsl(32 95% 44% / 0.8)',
];

function formatTotalDuration(totalMinutes: number) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);

    if (hours <= 0) {
        return `${minutes} min`;
    }

    return `${hours} h ${minutes.toString().padStart(2, '0')} min`;
}

function formatTooltipDuration(minutes: number) {
    if (!minutes) {
        return '0 min';
    }

    if (minutes < 60) {
        return `${Math.round(minutes)} min`;
    }

    const hours = Math.floor(minutes / 60);
    const rest = Math.round(minutes % 60);
    return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`;
}

function formatDateLabel(date: string) {
    const parsed = new Date(date);
    return dateFormatter.format(parsed);
}

export function OperationsDurationCard({
    data,
}: {
    data: OperationsDurationData;
}) {
    const userSegments = data.byUser.map((user, index) => ({
        userId: user.userId,
        userName: user.userName,
        color: USER_BAR_COLORS[index % USER_BAR_COLORS.length],
    }));
    const chartData = data.daily.map((day) => {
        const valuesByUser = Object.fromEntries(
            day.byUser.map((user) => [user.userId, user.operationsMinutes]),
        );

        return {
            ...valuesByUser,
            date: day.date,
            label: formatDateLabel(day.date),
            sowingMinutes: day.sowingMinutes,
        };
    });
    const maxVisibleLabels = 10;
    const labelStep = Math.max(
        1,
        Math.ceil(Math.max(chartData.length, 1) / maxVisibleLabels),
    );

    return (
        <Card>
            <CardOverflow>
                <Stack spacing={2} className="p-4">
                    <Stack spacing={0.5}>
                        <Typography level="body3">
                            Ukupno trajanje radnji
                        </Typography>
                        <Typography level="h4" semiBold>
                            {formatTotalDuration(data.totalMinutes)}
                        </Typography>
                        <Row className="gap-4 text-xs text-muted-foreground">
                            <Row spacing={0.5} className="items-center">
                                <span className="h-2 w-2 rounded-sm bg-primary/60" />
                                <Typography level="body3">
                                    Radnje{' '}
                                    {formatTooltipDuration(
                                        data.operationsMinutes,
                                    )}
                                </Typography>
                            </Row>
                            <Row spacing={0.5} className="items-center">
                                <span className="h-2 w-2 rounded-sm bg-emerald-500/60" />
                                <Typography level="body3">
                                    Sijanje{' '}
                                    {formatTooltipDuration(data.sowingMinutes)}
                                </Typography>
                            </Row>
                        </Row>
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                        >
                            Prikazane su samo završene radnje
                        </Typography>
                    </Stack>
                    {chartData.length === 0 ? (
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            Nema podataka za odabrani period.
                        </Typography>
                    ) : (
                        <div className="h-56 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={chartData}
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
                                        interval={0}
                                        tick={({ x, y, payload, index }) => {
                                            if (
                                                index % labelStep !== 0 &&
                                                index !== chartData.length - 1
                                            ) {
                                                return null;
                                            }

                                            return (
                                                <text
                                                    x={x}
                                                    y={y + 12}
                                                    textAnchor="middle"
                                                    className="fill-muted-foreground text-xs"
                                                >
                                                    {payload.value}
                                                </text>
                                            );
                                        }}
                                    />
                                    <YAxis
                                        tickLine={false}
                                        axisLine={false}
                                        width={36}
                                        tick={{ fontSize: 12 }}
                                        tickFormatter={(value: number) =>
                                            `${Math.round(value)}m`
                                        }
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
                                        content={({
                                            active,
                                            payload,
                                            label,
                                        }) => {
                                            if (
                                                !active ||
                                                !payload ||
                                                payload.length === 0
                                            ) {
                                                return null;
                                            }

                                            const values = payload
                                                .map((item) =>
                                                    typeof item.value ===
                                                    'number'
                                                        ? item.value
                                                        : 0,
                                                )
                                                .filter((value) => value > 0);
                                            const totalMinutes = values.reduce(
                                                (sum, value) => sum + value,
                                                0,
                                            );
                                            const sowingEntry = payload.find(
                                                (item) =>
                                                    String(item.dataKey) ===
                                                    'sowingMinutes',
                                            );
                                            const sowingMinutes =
                                                typeof sowingEntry?.value ===
                                                'number'
                                                    ? sowingEntry.value
                                                    : 0;
                                            const byUserEntries = payload
                                                .filter(
                                                    (item) =>
                                                        String(item.dataKey) !==
                                                            'sowingMinutes' &&
                                                        typeof item.value ===
                                                            'number' &&
                                                        item.value > 0,
                                                )
                                                .sort(
                                                    (a, b) =>
                                                        Number(b.value) -
                                                        Number(a.value),
                                                );

                                            return (
                                                <Stack
                                                    spacing={0.5}
                                                    className="text-xs"
                                                >
                                                    <Typography level="body2">
                                                        {label}
                                                    </Typography>
                                                    <Typography
                                                        level="body3"
                                                        semiBold
                                                    >
                                                        Ukupno:{' '}
                                                        {formatTooltipDuration(
                                                            totalMinutes,
                                                        )}
                                                    </Typography>
                                                    {byUserEntries.length >
                                                    0 ? (
                                                        byUserEntries.map(
                                                            (user) => (
                                                                <Typography
                                                                    key={String(
                                                                        user.dataKey,
                                                                    )}
                                                                    level="body3"
                                                                    className="text-muted-foreground"
                                                                >
                                                                    {user.name}:{' '}
                                                                    {formatTooltipDuration(
                                                                        Number(
                                                                            user.value,
                                                                        ),
                                                                    )}
                                                                </Typography>
                                                            ),
                                                        )
                                                    ) : (
                                                        <Typography
                                                            level="body3"
                                                            className="text-muted-foreground"
                                                        >
                                                            Nema dodijeljenih
                                                            korisnika
                                                        </Typography>
                                                    )}
                                                    {sowingMinutes > 0 ? (
                                                        <Typography
                                                            level="body3"
                                                            className="text-muted-foreground"
                                                        >
                                                            Sijanje:{' '}
                                                            {formatTooltipDuration(
                                                                sowingMinutes,
                                                            )}
                                                        </Typography>
                                                    ) : null}
                                                </Stack>
                                            );
                                        }}
                                    />
                                    {userSegments.map((user) => (
                                        <Bar
                                            key={user.userId}
                                            dataKey={user.userId}
                                            stackId="duration"
                                            fill={user.color}
                                            radius={[4, 4, 0, 0]}
                                            name={user.userName}
                                        />
                                    ))}
                                    <Bar
                                        dataKey="sowingMinutes"
                                        stackId="duration"
                                        fill="hsl(142 71% 45% / 0.65)"
                                        name="Sijanje"
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                    {data.byUser.length > 0 ? (
                        <Stack spacing={1.5} className="pt-2">
                            <Typography level="body3" className="font-medium">
                                Po korisniku (dodijeljene radnje)
                            </Typography>
                            <Stack spacing={1}>
                                {data.byUser.map((user) => (
                                    <Row
                                        key={user.userId}
                                        className="items-center justify-between gap-3 rounded-md border border-border/40 px-2 py-1.5"
                                    >
                                        <Stack spacing={0}>
                                            <Typography level="body3" semiBold>
                                                {user.userName}
                                            </Typography>
                                            <Typography
                                                level="body3"
                                                className="text-muted-foreground"
                                            >
                                                Radnji: {user.operationsCount}
                                            </Typography>
                                        </Stack>
                                        <Typography level="body3" semiBold>
                                            {formatTooltipDuration(
                                                user.operationsMinutes,
                                            )}
                                        </Typography>
                                    </Row>
                                ))}
                            </Stack>
                        </Stack>
                    ) : null}
                </Stack>
            </CardOverflow>
        </Card>
    );
}
